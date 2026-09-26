import { all } from '../db/index.ts';
import {
  CHARGE_TYPE_INFO, CHARGE_TYPES, SIGNAL_INFO, TARIFF,
  type ChargeType, type SignalLevel,
} from '../domain/reference.ts';
import { HOUR, hourStart, isoLocal, localHour, nowEpoch, quantile, round } from '../lib/util.ts';
import { getPld } from './market.ts';
import { region, type RegionRow } from './regions.ts';
import { activeSignalFor } from './signals.ts';

type SupplierRow = {
  id: string;
  name: string;
  product: string;
  spread_kwh: number;
  tusd_discount: number;
  peak_premium_kwh: number;
  window_start: number | null;
  window_end: number | null;
  regions: string | null;
};

let suppliersCache: SupplierRow[] | null = null;
function suppliers(): SupplierRow[] {
  suppliersCache ??= all<SupplierRow>('SELECT * FROM suppliers ORDER BY id');
  return suppliersCache;
}

export type TariffPost = 'ponta' | 'intermediario' | 'fora_ponta';

export function tariffPost(hour: number): TariffPost {
  if ((TARIFF.peakHours as readonly number[]).includes(hour)) return 'ponta';
  if ((TARIFF.intermediateHours as readonly number[]).includes(hour)) return 'intermediario';
  return 'fora_ponta';
}

const POST_FACTOR: Record<TariffPost, number> = {
  ponta: TARIFF.peakFactor,
  intermediario: TARIFF.intermediateFactor,
  fora_ponta: 1,
};

export type OfferQuote = {
  supplierId: string;
  supplierName: string;
  product: string;
  energyKwh: number;
  wireKwh: number;
  chargesKwh: number;
  taxesKwh: number;
  totalKwh: number;
};

/** Cotação de cada oferta disponível para a região/hora — base do "melhor preço" do mercado livre. */
export function quoteOffers(reg: RegionRow, t: number): OfferQuote[] {
  const h = localHour(t);
  const post = tariffPost(h);
  const pldKwh = getPld(reg.submarket, t) / 1000;
  const taxRate = TARIFF.icms + TARIFF.pisCofins;

  return suppliers()
    .filter((s) => !s.regions || s.regions.split(',').includes(reg.id))
    .filter((s) => s.window_start === null || (h >= s.window_start && h < (s.window_end ?? 24)))
    .map((s) => {
      const energy = pldKwh + s.spread_kwh + (post === 'ponta' ? s.peak_premium_kwh : 0);
      const wire = reg.tusd_kwh * POST_FACTOR[post] * (1 - s.tusd_discount);
      const net = energy + wire + TARIFF.encargosKwh;
      const gross = net / (1 - taxRate); // tributos "por dentro"
      return {
        supplierId: s.id,
        supplierName: s.name,
        product: s.product,
        energyKwh: round(energy, 4),
        wireKwh: round(wire, 4),
        chargesKwh: TARIFF.encargosKwh,
        taxesKwh: round(gross - net, 4),
        totalKwh: round(gross, 4),
      };
    })
    .sort((a, b) => a.totalKwh - b.totalKwh);
}

export type HourPrice = {
  hourEpoch: number;
  localTime: string;
  localHour: number;
  pldMwh: number;
  tariffPost: TariffPost;
  best: OfferQuote;
  signal: {
    level: SignalLevel;
    source: 'automatico' | 'gestor';
    signalId?: string;
    title?: string;
    multiplier: number;
    creditBonusKwh: number;
  };
  consumerPrices: Record<ChargeType, number>;
};

const autoLevelCache = new Map<string, { p30: number; p75: number }>();

/** Nível automático: percentis do custo do dia local — verde no terço mais barato, vermelho no quartil mais caro ou na ponta. */
function autoLevel(reg: RegionRow, t: number, total: number): SignalLevel {
  const dayStart = hourStart(t) - localHour(t) * HOUR;
  const key = `${reg.id}:${dayStart}`;
  let bands = autoLevelCache.get(key);
  if (!bands) {
    const totals = Array.from({ length: 24 }, (_, i) => quoteOffers(reg, dayStart + i * HOUR)[0].totalKwh).sort((a, b) => a - b);
    bands = { p30: quantile(totals, 0.3), p75: quantile(totals, 0.75) };
    if (autoLevelCache.size > 500) autoLevelCache.clear();
    autoLevelCache.set(key, bands);
  }
  if (tariffPost(localHour(t)) === 'ponta' || total >= bands.p75) return 'vermelho';
  if (total <= bands.p30) return 'verde';
  return 'amarelo';
}

export function priceAt(regionId: string, epoch: number): HourPrice {
  const reg = region(regionId);
  const t = hourStart(epoch);
  const offers = quoteOffers(reg, t);
  const best = offers[0];
  const manual = activeSignalFor(reg.id, epoch);
  const level = manual?.level ?? autoLevel(reg, t, best.totalKwh);
  const multiplier = manual?.multiplier ?? SIGNAL_INFO[level].multiplier;
  const creditBonusKwh = manual?.credit_bonus_kwh ?? SIGNAL_INFO[level].creditBonusKwh;

  const consumerPrices = Object.fromEntries(
    CHARGE_TYPES.map((ct) => [ct, round((best.totalKwh + CHARGE_TYPE_INFO[ct].marginKwh) * multiplier, 2)]),
  ) as Record<ChargeType, number>;

  return {
    hourEpoch: t,
    localTime: isoLocal(t),
    localHour: localHour(t),
    pldMwh: getPld(reg.submarket, t),
    tariffPost: tariffPost(localHour(t)),
    best,
    signal: {
      level,
      source: manual ? 'gestor' : 'automatico',
      signalId: manual?.id,
      title: manual?.title,
      multiplier,
      creditBonusKwh,
    },
    consumerPrices,
  };
}

export function priceSeries(regionId: string, hours: number, from = nowEpoch()): HourPrice[] {
  return Array.from({ length: hours }, (_, i) => priceAt(regionId, hourStart(from) + i * HOUR));
}

/** Melhores janelas contíguas para carregar nas próximas `hours` horas. */
export function bestWindows(regionId: string, chargeType: ChargeType, hours = 24, windowLen = 2) {
  const series = priceSeries(regionId, hours);
  const windows = [];
  for (let i = 0; i + windowLen <= series.length; i++) {
    const slice = series.slice(i, i + windowLen);
    const avg = slice.reduce((s, p) => s + p.consumerPrices[chargeType], 0) / windowLen;
    windows.push({
      startsAt: slice[0].localTime,
      startHour: slice[0].localHour,
      endHour: (slice[slice.length - 1].localHour + 1) % 24,
      avgPriceKwh: round(avg, 2),
      level: slice.every((p) => p.signal.level === 'verde') ? 'verde' : slice.some((p) => p.signal.level === 'vermelho') ? 'vermelho' : 'amarelo',
    });
  }
  return windows.sort((a, b) => a.avgPriceKwh - b.avgPriceKwh).slice(0, 3);
}

export function clearPricingCaches() {
  autoLevelCache.clear();
  suppliersCache = null;
}
