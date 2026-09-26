import { all, audit, run, transaction } from '../db/index.ts';
import { SIGNAL_INFO, type SignalLevel } from '../domain/reference.ts';
import { newId } from '../lib/crypto.ts';
import { badRequest, notFound } from '../lib/http.ts';
import { isoLocal, nowEpoch } from '../lib/util.ts';
import { notifyMany } from './notifications.ts';
import { region } from './regions.ts';

export type SignalRow = {
  id: string;
  region_id: string;
  level: SignalLevel;
  starts_at: number;
  ends_at: number;
  multiplier: number;
  credit_bonus_kwh: number;
  title: string;
  message: string;
  created_by: string;
  created_at: number;
  cancelled_at: number | null;
};

/** Sinais do gestor em memória: consultados a cada cálculo de preço, então evitamos ir ao banco. */
let cache: SignalRow[] | null = null;
function load(): SignalRow[] {
  cache ??= all<SignalRow>('SELECT * FROM price_signals WHERE cancelled_at IS NULL AND ends_at > ? ORDER BY starts_at', nowEpoch() - 86400);
  return cache;
}
export function invalidateSignals() {
  cache = null;
}

export function activeSignalFor(regionId: string, epoch: number): SignalRow | undefined {
  // O mais recente vence quando há sobreposição.
  let found: SignalRow | undefined;
  for (const s of load()) {
    if (s.region_id === regionId && s.starts_at <= epoch && epoch < s.ends_at) {
      if (!found || s.created_at > found.created_at) found = s;
    }
  }
  return found;
}

export function listSignals(opts: { regionId?: string; includePast?: boolean } = {}) {
  const now = nowEpoch();
  return load()
    .filter((s) => !opts.regionId || s.region_id === opts.regionId)
    .filter((s) => opts.includePast || s.ends_at > now)
    .map(toDto);
}

export function toDto(s: SignalRow) {
  const now = nowEpoch();
  return {
    id: s.id,
    regionId: s.region_id,
    level: s.level,
    startsAt: isoLocal(s.starts_at),
    endsAt: isoLocal(s.ends_at),
    status: s.starts_at > now ? 'agendado' : s.ends_at > now ? 'ativo' : 'encerrado',
    multiplier: s.multiplier,
    creditBonusKwh: s.credit_bonus_kwh,
    title: s.title,
    message: s.message,
    createdAt: isoLocal(s.created_at),
  };
}

export type CreateSignalInput = {
  regionId: string;
  level: SignalLevel;
  startsAt: number;
  endsAt: number;
  title: string;
  message: string;
  multiplier?: number;
  creditBonusKwh?: number;
  notifyConsumers: boolean;
};

/**
 * Publica um sinal de preço do gestor. É isto que "repassa o sinal ao consumidor":
 * altera o preço dinâmico da região na janela e notifica os consumidores afetados.
 */
export function createSignal(input: CreateSignalInput, managerId: string, ip?: string) {
  region(input.regionId);
  if (input.endsAt <= input.startsAt) throw badRequest('O fim do sinal deve ser posterior ao início');
  if (input.endsAt - input.startsAt > 7 * 86400) throw badRequest('Um sinal pode durar no máximo 7 dias');
  if (input.endsAt <= nowEpoch()) throw badRequest('O sinal termina no passado');

  const row: SignalRow = {
    id: newId('sig'),
    region_id: input.regionId,
    level: input.level,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    multiplier: input.multiplier ?? SIGNAL_INFO[input.level].multiplier,
    credit_bonus_kwh: input.creditBonusKwh ?? SIGNAL_INFO[input.level].creditBonusKwh,
    title: input.title,
    message: input.message,
    created_by: managerId,
    created_at: nowEpoch(),
    cancelled_at: null,
  };

  const notified = transaction(() => {
    run(
      `INSERT INTO price_signals (id, region_id, level, starts_at, ends_at, multiplier, credit_bonus_kwh, title, message, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id, row.region_id, row.level, row.starts_at, row.ends_at, row.multiplier, row.credit_bonus_kwh,
      row.title, row.message, row.created_by, row.created_at,
    );
    audit(managerId, 'signal.create', `${row.id} ${row.region_id} ${row.level}`, ip);
    if (!input.notifyConsumers) return 0;
    const consumers = all<{ id: string }>("SELECT id FROM users WHERE role = 'consumer' AND region_id = ?", row.region_id);
    notifyMany(
      consumers.map((c) => c.id),
      { kind: 'price_signal', title: row.title, body: row.message, data: { signalId: row.id, level: row.level, regionId: row.region_id } },
    );
    return consumers.length;
  });
  invalidateSignals();
  onSignalsChanged();
  return { signal: toDto(row), notifiedConsumers: notified };
}

export function cancelSignal(id: string, managerId: string, ip?: string) {
  const r = run('UPDATE price_signals SET cancelled_at = ? WHERE id = ? AND cancelled_at IS NULL', nowEpoch(), id);
  if (Number(r.changes) === 0) throw notFound('Sinal não encontrado ou já cancelado');
  audit(managerId, 'signal.cancel', id, ip);
  invalidateSignals();
  onSignalsChanged();
}

/** Hook para limpar caches de preço dependentes (registrado pelo módulo de preços, evitando import circular em tempo de carga). */
let onSignalsChanged: () => void = () => {};
export function setSignalsChangedHook(fn: () => void) {
  onSignalsChanged = fn;
}
