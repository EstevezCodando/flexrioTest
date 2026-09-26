import { Router } from 'express';
import { z } from 'zod';
import { CHARGE_TYPE_INFO, CHARGE_TYPES, SIGNAL_INFO } from '../domain/reference.ts';
import { handler, parse } from '../lib/http.ts';
import { nowEpoch } from '../lib/util.ts';
import { getPldSeries } from '../services/market.ts';
import { bestWindows, priceAt, priceSeries, quoteOffers } from '../services/pricing.ts';
import { isRegion, nearestRegion, region, regions } from '../services/regions.ts';
import { listSignals } from '../services/signals.ts';
import { listStations, stationDetail, stationMarkers, stationsStats } from '../services/stations.ts';

const regionParam = z.string().refine(isRegion, 'região inválida');
const coerceNum = (min: number, max: number) => z.coerce.number().min(min).max(max);
const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

/** Endpoints de consulta (exigem sessão, mas servem consumidor e gestor). */
export const catalogRouter = Router();

catalogRouter.get('/meta', (_req, res) => {
  res.set('Cache-Control', 'private, max-age=3600');
  res.json({
    chargeTypes: CHARGE_TYPES.map((id) => ({ id, ...CHARGE_TYPE_INFO[id] })),
    signalLevels: Object.entries(SIGNAL_INFO).map(([id, v]) => ({ id, ...v })),
    regions: regions().map((r) => ({ id: r.id, name: r.name, distributor: r.distributor, submarket: r.submarket, lat: r.lat, lng: r.lng })),
    dataset: { snapshot: 'carregados_rj_2026-09-22', source: 'https://carregados.com.br', stats: stationsStats() },
  });
});

catalogRouter.get('/regions/nearest', handler((req, res) => {
  const q = parse(z.object({ lat: coerceNum(-90, 90), lng: coerceNum(-180, 180) }), req.query);
  const r = nearestRegion(q.lat, q.lng);
  res.json({ id: r.id, name: r.name });
}));

catalogRouter.get('/stations', handler((req, res) => {
  const q = parse(
    z.object({
      region: regionParam.optional(),
      q: z.string().max(80).optional(),
      chargeType: z.enum(CHARGE_TYPES).optional(),
      connector: z.string().max(30).optional(),
      available: bool.optional(),
      public: bool.optional(),
      operational: bool.optional(),
      maxPrice: coerceNum(0, 20).optional(),
      lat: coerceNum(-90, 90).optional(),
      lng: coerceNum(-180, 180).optional(),
      radiusKm: coerceNum(0.1, 300).optional(),
      sort: z.enum(['recomendado', 'distancia', 'preco', 'potencia']).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(30),
      offset: z.coerce.number().int().min(0).max(5000).default(0),
    }),
    req.query,
  );
  res.set('Cache-Control', 'private, max-age=30');
  res.json(
    listStations({
      regionId: q.region, q: q.q, chargeType: q.chargeType, connectorType: q.connector, availableOnly: q.available,
      publicOnly: q.public, operationalOnly: q.operational, maxPrice: q.maxPrice, lat: q.lat, lng: q.lng,
      radiusKm: q.radiusKm, sort: q.sort, limit: q.limit, offset: q.offset,
    }),
  );
}));

catalogRouter.get('/stations/markers', handler((req, res) => {
  const q = parse(z.object({ region: regionParam.optional() }), req.query);
  res.set('Cache-Control', 'private, max-age=60');
  res.json(stationMarkers(q.region));
}));

catalogRouter.get('/stations/:id', handler((req, res) => {
  const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
  const q = parse(z.object({ lat: coerceNum(-90, 90).optional(), lng: coerceNum(-180, 180).optional() }), req.query);
  res.json(stationDetail(id, q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : undefined));
}));

/** Preço da energia agora + composição + preço por tipo de recarga (visão do consumidor). */
catalogRouter.get('/prices/:region/now', handler((req, res) => {
  const { region: id } = parse(z.object({ region: regionParam }), req.params);
  const p = priceAt(id, nowEpoch());
  res.set('Cache-Control', 'private, max-age=60');
  res.json({
    region: { id, name: region(id).name, distributor: region(id).distributor, submarket: region(id).submarket },
    ...p,
    offers: quoteOffers(region(id), p.hourEpoch),
    chargeTypes: CHARGE_TYPES.map((ct) => ({ id: ct, ...CHARGE_TYPE_INFO[ct], priceKwh: p.consumerPrices[ct] })),
    bestWindows: bestWindows(id, 'dc_rapida', 24),
    activeSignals: listSignals({ regionId: id }),
    disclaimer: 'Valores simulados (mock). Arquitetura preparada para PLD da CCEE e ofertas reais de comercializadoras.',
  });
}));

catalogRouter.get('/prices/:region/forecast', handler((req, res) => {
  const { region: id } = parse(z.object({ region: regionParam }), req.params);
  const q = parse(z.object({ hours: z.coerce.number().int().min(1).max(48).default(24) }), req.query);
  res.set('Cache-Control', 'private, max-age=60');
  res.json({
    region: id,
    points: priceSeries(id, q.hours).map((p) => ({
      localTime: p.localTime,
      localHour: p.localHour,
      pldMwh: p.pldMwh,
      tariffPost: p.tariffPost,
      energyCostKwh: p.best.totalKwh,
      supplier: p.best.supplierName,
      level: p.signal.level,
      signalSource: p.signal.source,
      consumerPrices: p.consumerPrices,
    })),
  });
}));

/** Comparativo do melhor preço agora em todas as regiões. */
catalogRouter.get('/prices', handler((_req, res) => {
  const now = nowEpoch();
  res.set('Cache-Control', 'private, max-age=60');
  res.json(
    regions().map((r) => {
      const p = priceAt(r.id, now);
      return { regionId: r.id, regionName: r.name, level: p.signal.level, energyCostKwh: p.best.totalKwh, supplier: p.best.supplierName, consumerPrices: p.consumerPrices };
    }),
  );
}));

catalogRouter.get('/market/pld', handler((req, res) => {
  const q = parse(
    z.object({ submarket: z.enum(['SE', 'S', 'NE', 'N']).default('SE'), hours: z.coerce.number().int().min(1).max(48).default(24) }),
    req.query,
  );
  res.set('Cache-Control', 'private, max-age=300');
  res.json({ submarket: q.submarket, source: 'mock-ccee-v1', points: getPldSeries(q.submarket, nowEpoch(), q.hours) });
}));

catalogRouter.get('/signals', handler((req, res) => {
  const q = parse(z.object({ region: regionParam.optional() }), req.query);
  res.json(listSignals({ regionId: q.region }));
}));
