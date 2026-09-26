import { all, audit, run, transaction } from '../db/index.ts';
import { GUARDRAILS, SIGNAL_INFO, type SignalLevel } from '../domain/reference.ts';
import { newId } from '../lib/crypto.ts';
import { badRequest, conflict, notFound } from '../lib/http.ts';
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
  origin: 'manual' | 'flexia';
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
    origin: s.origin,
    approvedBy: s.created_by,
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
  origin?: 'manual' | 'flexia';
};

/**
 * Publica um sinal de preço do gestor. É isto que "repassa o sinal ao consumidor":
 * altera o preço dinâmico da região na janela e notifica os consumidores afetados.
 */
export function createSignal(input: CreateSignalInput, managerId: string, ip?: string) {
  region(input.regionId);
  const now = nowEpoch();
  const G = GUARDRAILS;
  if (input.endsAt <= input.startsAt) throw badRequest('O fim do sinal deve ser posterior ao início');
  if (input.endsAt <= now) throw badRequest('O sinal termina no passado');
  if (input.endsAt - input.startsAt > G.maxDurationHours * 3600) {
    throw badRequest(`Guard rail: um sinal pode durar no máximo ${G.maxDurationHours} h`);
  }
  const multiplier = input.multiplier ?? SIGNAL_INFO[input.level].multiplier;
  const bonus = input.creditBonusKwh ?? SIGNAL_INFO[input.level].creditBonusKwh;
  if (multiplier < G.multiplierMin || multiplier > G.multiplierMax) {
    throw badRequest(`Guard rail: o multiplicador de preço deve ficar entre ${G.multiplierMin} e ${G.multiplierMax}`);
  }
  if (bonus > G.creditBonusMaxKwh) throw badRequest(`Guard rail: o bônus de crédito não pode passar de R$ ${G.creditBonusMaxKwh}/kWh`);
  // Coerência: verde nunca encarece, vermelho nunca barateia, e só o verde concede bônus.
  if (input.level === 'verde' && multiplier > 1) throw badRequest('Guard rail: sinal verde não pode aumentar o preço');
  if (input.level === 'vermelho' && multiplier < 1) throw badRequest('Guard rail: sinal vermelho não pode reduzir o preço');
  if (input.level !== 'verde' && bonus > 0) throw badRequest('Guard rail: bônus de crédito só é permitido em sinal verde');
  // Um único sinal por região e janela: evita instruções contraditórias aos consumidores.
  const overlap = load().find((x) => x.region_id === input.regionId && x.starts_at < input.endsAt && input.startsAt < x.ends_at);
  if (overlap) throw conflict(`Já existe o sinal "${overlap.title}" nesta região e janela. Cancele-o antes de publicar outro.`);

  const row: SignalRow = {
    id: newId('sig'),
    region_id: input.regionId,
    level: input.level,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    multiplier,
    credit_bonus_kwh: bonus,
    title: input.title,
    message: input.message,
    created_by: managerId,
    created_at: now,
    cancelled_at: null,
    origin: input.origin ?? 'manual',
  };

  const notified = transaction(() => {
    run(
      `INSERT INTO price_signals (id, region_id, level, starts_at, ends_at, multiplier, credit_bonus_kwh, title, message, created_by, created_at, origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id, row.region_id, row.level, row.starts_at, row.ends_at, row.multiplier, row.credit_bonus_kwh,
      row.title, row.message, row.created_by, row.created_at, row.origin,
    );
    audit(managerId, 'signal.create', `${row.id} ${row.region_id} ${row.level} x${row.multiplier} origem=${row.origin}`, ip);
    // Os demais gestores são avisados de que um sinal foi aprovado e por quem (controle cruzado).
    const others = all<{ id: string }>("SELECT id FROM users WHERE role = 'manager' AND id <> ?", managerId);
    notifyMany(others.map((m) => m.id), {
      kind: 'manager_signal',
      title: `Sinal ${row.level} publicado em ${row.region_id}`,
      body: `"${row.title}" (×${row.multiplier}, origem: ${row.origin === 'flexia' ? 'proposta da FlexIA aprovada por gestor' : 'gestor'}).`,
      data: { signalId: row.id, regionId: row.region_id },
    });
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
