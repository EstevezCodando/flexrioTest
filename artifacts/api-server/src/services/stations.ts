import { all } from '../db/index.ts';
import { CHARGE_TYPE_INFO, CHARGE_TYPES, type ChargeType } from '../domain/reference.ts';
import { notFound } from '../lib/http.ts';
import { haversineKm, localHour, normalizeText, nowEpoch, noise, round } from '../lib/util.ts';
import { gridAt } from './grid.ts';
import { priceAt, priceSeries, type HourPrice } from './pricing.ts';
import { region } from './regions.ts';

type StationRow = {
  id: number;
  name: string;
  city: string | null;
  region_id: string;
  address: string | null;
  lat: number;
  lng: number;
  access: string | null;
  is_public: number;
  maintenance: number;
  inactive: number;
  under_construction: number;
  charge_group: string | null;
  network: string | null;
  place_type: string | null;
  max_power_kw: number | null;
  avg_power_kw: number | null;
  published_price_kwh: number | null;
  activation_fee: number | null;
  price_label: string | null;
  price_conflict: number;
  opening_hours: string | null;
  source_url: string | null;
  updated_at: string | null;
  snapshot_id: string;
};

type ConnectorRow = {
  id: number;
  station_id: number;
  evse_id: number;
  type_name: string;
  current: 'AC' | 'DC';
  power_kw: number;
  power_known: number;
  charge_type: ChargeType;
};

type Station = StationRow & {
  connectors: ConnectorRow[];
  chargeTypes: ChargeType[];
  connectorTypes: string[];
  searchText: string;
  quality: { code: string; note: string | null }[];
};

/** A base de estações é um snapshot estático: carregada uma vez e indexada em memória. */
let stationsCache: Map<number, Station> | null = null;

function load(): Map<number, Station> {
  if (stationsCache) return stationsCache;
  const connectors = all<ConnectorRow>('SELECT * FROM connectors ORDER BY station_id, id');
  const quality = all<{ station_id: number; code: string; note: string | null }>('SELECT * FROM station_quality');
  const byStation = new Map<number, ConnectorRow[]>();
  for (const c of connectors) {
    const list = byStation.get(c.station_id) ?? [];
    list.push(c);
    byStation.set(c.station_id, list);
  }
  const qByStation = new Map<number, { code: string; note: string | null }[]>();
  for (const q of quality) {
    const list = qByStation.get(q.station_id) ?? [];
    list.push({ code: q.code, note: q.note });
    qByStation.set(q.station_id, list);
  }
  stationsCache = new Map(
    all<StationRow>('SELECT * FROM stations').map((s) => {
      const conns = byStation.get(s.id) ?? [];
      return [
        s.id,
        {
          ...s,
          connectors: conns,
          chargeTypes: CHARGE_TYPES.filter((ct) => conns.some((c) => c.charge_type === ct)),
          connectorTypes: [...new Set(conns.map((c) => c.type_name))],
          searchText: normalizeText(`${s.name} ${s.address ?? ''} ${s.city ?? ''} ${s.network ?? ''}`),
          quality: qByStation.get(s.id) ?? [],
        },
      ];
    }),
  );
  return stationsCache;
}

export function stationCount() {
  return load().size;
}

export type ConnectorStatus = 'disponivel' | 'ocupado' | 'indisponivel';

let activeSessionConnectors = new Set<number>();
export function refreshActiveConnectors() {
  activeSessionConnectors = new Set(
    all<{ connector_id: number }>("SELECT connector_id FROM charging_sessions WHERE status = 'active'").map((r) => r.connector_id),
  );
}

function stationStatus(s: Station): 'operacional' | 'manutencao' | 'inativa' | 'em_obra' {
  if (s.under_construction) return 'em_obra';
  if (s.inactive) return 'inativa';
  if (s.maintenance) return 'manutencao';
  return 'operacional';
}

/** Ocupação simulada: muda a cada 10 min e acompanha o fator de carga da região. */
function connectorStatus(s: Station, c: ConnectorRow, now: number): ConnectorStatus {
  if (stationStatus(s) !== 'operacional') return 'indisponivel';
  if (activeSessionConnectors.has(c.id)) return 'ocupado';
  if (noise(`fault-${c.id}-${Math.floor(now / 86400)}`) < 0.04) return 'indisponivel';
  const bucket = Math.floor(now / 600);
  const h = localHour(now);
  const base = h >= 7 && h <= 22 ? 0.32 : 0.1;
  const busy = base + (c.current === 'DC' ? 0.12 : 0) + (s.region_id === 'capital' ? 0.05 : 0);
  return noise(`occ-${c.id}-${bucket}`) < busy ? 'ocupado' : 'disponivel';
}

export type StationFilters = {
  regionId?: string;
  q?: string;
  chargeType?: ChargeType;
  connectorType?: string;
  availableOnly?: boolean;
  publicOnly?: boolean;
  operationalOnly?: boolean;
  maxPrice?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sort?: 'recomendado' | 'distancia' | 'preco' | 'potencia';
  limit: number;
  offset: number;
};

function summarize(s: Station, price: HourPrice, now: number, origin?: { lat: number; lng: number }) {
  const statuses = s.connectors.map((c) => connectorStatus(s, c, now));
  const available = statuses.filter((x) => x === 'disponivel').length;
  const types = s.chargeTypes.length > 0 ? s.chargeTypes : (['ac_lenta'] as ChargeType[]);
  const cheapestType = types.reduce((a, b) => (price.consumerPrices[a] <= price.consumerPrices[b] ? a : b));
  const fastestType = types[types.length - 1];
  const distanceKm = origin ? round(haversineKm(origin.lat, origin.lng, s.lat, s.lng), 2) : null;
  const status = stationStatus(s);

  // Score de recomendação (0–100): preço, disponibilidade, potência, sinal e distância.
  const priceScore = Math.max(0, 1 - (price.consumerPrices[fastestType] - 1.2) / 2.5);
  const availScore = s.connectors.length ? available / s.connectors.length : 0.3;
  const powerScore = Math.min(1, (s.max_power_kw ?? 7) / 150);
  const signalScore = price.signal.level === 'verde' ? 1 : price.signal.level === 'amarelo' ? 0.6 : 0.2;
  const distScore = distanceKm === null ? 0.5 : Math.max(0, 1 - distanceKm / 25);
  const score =
    status !== 'operacional' ? 0 :
    Math.round(100 * (0.25 * priceScore + 0.2 * availScore + 0.15 * powerScore + 0.15 * signalScore + 0.25 * distScore));

  return {
    id: s.id,
    name: s.name,
    city: s.city,
    regionId: s.region_id,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    isPublic: s.is_public === 1,
    access: s.access,
    status,
    network: s.network,
    placeType: s.place_type,
    maxPowerKw: s.max_power_kw,
    chargeTypes: s.chargeTypes,
    connectorTypes: s.connectorTypes,
    connectors: { total: s.connectors.length, available },
    publishedPriceKwh: s.published_price_kwh,
    activationFee: s.activation_fee,
    priceConflict: s.price_conflict === 1,
    prices: Object.fromEntries(types.map((t) => [t, price.consumerPrices[t]])) as Partial<Record<ChargeType, number>>,
    cheapest: { chargeType: cheapestType, priceKwh: price.consumerPrices[cheapestType] },
    signalLevel: price.signal.level,
    distanceKm,
    score,
  };
}

export type StationSummary = ReturnType<typeof summarize>;

export function listStations(f: StationFilters) {
  const now = nowEpoch();
  const priceByRegion = new Map<string, HourPrice>();
  const priceFor = (regionId: string) => {
    let p = priceByRegion.get(regionId);
    if (!p) {
      p = priceAt(regionId, now);
      priceByRegion.set(regionId, p);
    }
    return p;
  };
  const origin = f.lat !== undefined && f.lng !== undefined ? { lat: f.lat, lng: f.lng } : undefined;
  const q = f.q ? normalizeText(f.q) : null;
  const connType = f.connectorType ? normalizeText(f.connectorType) : null;

  let items: StationSummary[] = [];
  for (const s of load().values()) {
    if (f.regionId && s.region_id !== f.regionId) continue;
    if (f.publicOnly && !s.is_public) continue;
    if (q && !s.searchText.includes(q)) continue;
    if (f.chargeType && !s.chargeTypes.includes(f.chargeType)) continue;
    if (connType && !s.connectorTypes.some((t) => normalizeText(t).includes(connType))) continue;
    if (origin && f.radiusKm && haversineKm(origin.lat, origin.lng, s.lat, s.lng) > f.radiusKm) continue;
    const sum = summarize(s, priceFor(s.region_id), now, origin);
    if (f.operationalOnly && sum.status !== 'operacional') continue;
    if (f.availableOnly && sum.connectors.available === 0) continue;
    if (f.maxPrice !== undefined) {
      const p = f.chargeType ? sum.prices[f.chargeType] : sum.cheapest.priceKwh;
      if (p === undefined || p > f.maxPrice) continue;
    }
    items.push(sum);
  }

  const sort = f.sort ?? (origin ? 'recomendado' : 'recomendado');
  const priceKey = (s: StationSummary) => (f.chargeType ? s.prices[f.chargeType] ?? 99 : s.cheapest.priceKwh);
  items.sort((a, b) => {
    switch (sort) {
      case 'distancia':
        return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
      case 'preco':
        return priceKey(a) - priceKey(b) || b.score - a.score;
      case 'potencia':
        return (b.maxPowerKw ?? 0) - (a.maxPowerKw ?? 0);
      default:
        return b.score - a.score;
    }
  });
  const total = items.length;
  items = items.slice(f.offset, f.offset + f.limit);
  return { total, limit: f.limit, offset: f.offset, items };
}

/** Marcadores leves para o mapa (todas as estações de uma vez, ~40 KB gzip). */
export function stationMarkers(regionId?: string) {
  const now = nowEpoch();
  const out = [];
  for (const s of load().values()) {
    if (regionId && s.region_id !== regionId) continue;
    const status = stationStatus(s);
    const available = s.connectors.filter((c) => connectorStatus(s, c, now) === 'disponivel').length;
    out.push({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      n: s.name,
      dc: s.chargeTypes.some((t) => t.startsWith('dc')),
      st: status,
      av: available,
      tot: s.connectors.length,
      pub: s.is_public === 1,
    });
  }
  return out;
}

export function getStationRaw(id: number): Station {
  const s = load().get(id);
  if (!s) throw notFound('Estação não encontrada');
  return s;
}

export function stationDetail(id: number, origin?: { lat: number; lng: number }) {
  const s = getStationRaw(id);
  const now = nowEpoch();
  const price = priceAt(s.region_id, now);
  const summary = summarize(s, price, now, origin);
  const forecast = priceSeries(s.region_id, 24, now).map((p) => ({
    localTime: p.localTime,
    localHour: p.localHour,
    level: p.signal.level,
    prices: Object.fromEntries(summary.chargeTypes.map((t) => [t, p.consumerPrices[t]])),
  }));
  const reg = region(s.region_id);
  const grid = gridAt(reg, now);

  return {
    ...summary,
    regionName: reg.name,
    distributor: reg.distributor,
    openingHours: s.opening_hours,
    priceLabel: s.price_label,
    sourceUrl: s.source_url,
    snapshotId: s.snapshot_id,
    updatedAt: s.updated_at,
    quality: s.quality,
    connectorsDetail: s.connectors.map((c) => ({
      id: c.id,
      evseId: c.evse_id,
      type: c.type_name,
      current: c.current,
      powerKw: c.power_kw,
      powerKnown: c.power_known === 1,
      chargeType: c.charge_type,
      chargeTypeLabel: CHARGE_TYPE_INFO[c.charge_type].label,
      status: connectorStatus(s, c, now),
      priceKwh: price.consumerPrices[c.charge_type],
    })),
    energyNow: {
      pldMwh: price.pldMwh,
      tariffPost: price.tariffPost,
      supplier: price.best.supplierName,
      product: price.best.product,
      breakdown: {
        energiaKwh: price.best.energyKwh,
        fioKwh: price.best.wireKwh,
        encargosKwh: price.best.chargesKwh,
        tributosKwh: price.best.taxesKwh,
        custoEnergiaKwh: price.best.totalKwh,
      },
      signal: price.signal,
      regionalLoadPct: grid.loadFactorPct,
    },
    forecast,
  };
}

export function stationsStats(regionId?: string) {
  const list = [...load().values()].filter((s) => !regionId || s.region_id === regionId);
  const prices = list.map((s) => s.published_price_kwh).filter((p): p is number => p !== null && p > 0).sort((a, b) => a - b);
  const byType = Object.fromEntries(
    CHARGE_TYPES.map((t) => [t, list.reduce((n, s) => n + s.connectors.filter((c) => c.charge_type === t).length, 0)]),
  );
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : null;
  return {
    stations: list.length,
    publicStations: list.filter((s) => s.is_public).length,
    maintenance: list.filter((s) => s.maintenance).length,
    inactiveOrConstruction: list.filter((s) => s.inactive || s.under_construction).length,
    connectors: list.reduce((n, s) => n + s.connectors.length, 0),
    connectorsByChargeType: byType,
    dcStations: list.filter((s) => s.chargeTypes.some((t) => t.startsWith('dc'))).length,
    publishedPrices: { count: prices.length, min: prices[0] ?? null, median, max: prices[prices.length - 1] ?? null },
    priceConflicts: list.filter((s) => s.price_conflict).length,
  };
}

/** Estimativa de carga de recarga (MW) em uso agora numa região — insumo do painel do gestor. */
export function estimatedChargingLoadMw(regionId: string) {
  const now = nowEpoch();
  let kw = 0;
  let busy = 0;
  let total = 0;
  for (const s of load().values()) {
    if (s.region_id !== regionId) continue;
    for (const c of s.connectors) {
      total++;
      if (connectorStatus(s, c, now) === 'ocupado') {
        busy++;
        kw += Math.min(c.power_kw, c.current === 'DC' ? 80 : 7) * 0.8;
      }
    }
  }
  return { mw: round(kw / 1000, 3), busyConnectors: busy, totalConnectors: total };
}
