import { all, run, transaction } from '../db/index.ts';
import { TARIFF } from '../domain/reference.ts';
import { clamp, dayOfYear, HOUR, hourStart, localDay, localHour, noise, nowEpoch, round } from '../lib/util.ts';

export type Submarket = 'SE' | 'S' | 'NE' | 'N';
export const SUBMARKETS: Submarket[] = ['SE', 'S', 'NE', 'N'];

export type PldPoint = { submarket: Submarket; hourEpoch: number; pldMwh: number };

/**
 * Contrato de integração com o mercado de energia. Hoje há apenas o provedor mock;
 * um provedor real (ex.: API de dados abertos da CCEE para PLD horário) implementa a
 * mesma interface e é trocado em `activeProvider` sem alterar o restante do sistema.
 */
export interface MarketDataProvider {
  readonly id: string;
  fetchHourlyPld(submarket: Submarket, fromEpoch: number, hours: number): Promise<PldPoint[]>;
}

/** Perfil horário relativo do PLD (vale solar ao meio-dia, rampa e pico no início da noite). */
const HOURLY_PROFILE = [
  0.82, 0.78, 0.76, 0.75, 0.77, 0.84, 0.95, 1.02, 0.9, 0.7, 0.55, 0.48,
  0.46, 0.47, 0.52, 0.62, 0.85, 1.35, 1.9, 2.15, 1.95, 1.45, 1.1, 0.92,
];
const SUBMARKET_FACTOR: Record<Submarket, number> = { SE: 1, S: 0.94, NE: 0.78, N: 0.86 };

export class MockMarketProvider implements MarketDataProvider {
  readonly id = 'mock-ccee-v1';

  async fetchHourlyPld(submarket: Submarket, fromEpoch: number, hours: number): Promise<PldPoint[]> {
    const out: PldPoint[] = [];
    for (let i = 0; i < hours; i++) {
      const t = hourStart(fromEpoch) + i * HOUR;
      out.push({ submarket, hourEpoch: t, pldMwh: this.pldAt(submarket, t) });
    }
    return out;
  }

  pldAt(submarket: Submarket, t: number): number {
    // Sazonalidade hidrológica: período seco (jun–nov) encarece a energia.
    const hydro = 0.95 + 0.45 * Math.sin((2 * Math.PI * (dayOfYear(t) - 110)) / 365);
    const dayShock = 0.85 + 0.35 * noise(`pld-day-${submarket}-${localDay(t)}`);
    const hourNoise = 1 + 0.16 * (noise(`pld-${submarket}-${t}`) - 0.5);
    const base = 175 * hydro * dayShock * HOURLY_PROFILE[localHour(t)] * hourNoise * SUBMARKET_FACTOR[submarket];
    return round(clamp(base, TARIFF.pldFloor, TARIFF.pldCeiling), 2);
  }
}

export const activeProvider: MarketDataProvider = new MockMarketProvider();

/**
 * Job de ingestão: garante preços de 24 h para trás até 48 h à frente em todos os
 * submercados. Idempotente (INSERT OR IGNORE) — pode rodar a qualquer momento.
 */
export async function ingestMarketData(provider: MarketDataProvider = activeProvider): Promise<number> {
  const from = hourStart(nowEpoch()) - 24 * HOUR;
  const batches = await Promise.all(SUBMARKETS.map((s) => provider.fetchHourlyPld(s, from, 72)));
  const ingestedAt = nowEpoch();
  let inserted = 0;
  transaction(() => {
    for (const p of batches.flat()) {
      const r = run(
        'INSERT OR IGNORE INTO market_prices (submarket, hour_epoch, pld_mwh, source, ingested_at) VALUES (?, ?, ?, ?, ?)',
        p.submarket, p.hourEpoch, p.pldMwh, provider.id, ingestedAt,
      );
      inserted += Number(r.changes);
    }
    // retenção: mantém 30 dias de histórico
    run('DELETE FROM market_prices WHERE hour_epoch < ?', from - 30 * 86400);
  });
  pldCache.clear();
  return inserted;
}

const pldCache = new Map<string, Map<number, number>>();

/** PLD horário (R$/MWh) do banco, com cache em memória por submercado. */
export function getPldSeries(submarket: Submarket, fromEpoch: number, hours: number): PldPoint[] {
  const from = hourStart(fromEpoch);
  const to = from + hours * HOUR;
  const key = `${submarket}:${from}:${hours}`;
  let series = pldCache.get(key);
  if (!series) {
    const rows = all<{ hour_epoch: number; pld_mwh: number }>(
      'SELECT hour_epoch, pld_mwh FROM market_prices WHERE submarket = ? AND hour_epoch >= ? AND hour_epoch < ? ORDER BY hour_epoch',
      submarket, from, to,
    );
    series = new Map(rows.map((r) => [r.hour_epoch, r.pld_mwh]));
    if (pldCache.size > 200) pldCache.clear();
    pldCache.set(key, series);
  }
  const mock = activeProvider instanceof MockMarketProvider ? activeProvider : new MockMarketProvider();
  const out: PldPoint[] = [];
  for (let t = from; t < to; t += HOUR) {
    // Lacuna na ingestão: cai para o cálculo do provedor mock para não quebrar a resposta.
    out.push({ submarket, hourEpoch: t, pldMwh: series.get(t) ?? mock.pldAt(submarket, t) });
  }
  return out;
}

export function getPld(submarket: Submarket, epoch: number): number {
  return getPldSeries(submarket, epoch, 1)[0].pldMwh;
}
