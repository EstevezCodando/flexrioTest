import { config } from '../config.ts';
import { all, audit, get, run, transaction } from '../db/index.ts';
import { CHARGE_TYPE_INFO } from '../domain/reference.ts';
import { newId } from '../lib/crypto.ts';
import { badRequest, conflict, notFound } from '../lib/http.ts';
import { clamp, isoLocal, nowEpoch, round } from '../lib/util.ts';
import { getUser, type Vehicle } from './auth.ts';
import { notify } from './notifications.ts';
import { priceAt } from './pricing.ts';
import { getStationRaw, refreshActiveConnectors, stationDetail } from './stations.ts';
import { walletBalanceCents } from './wallet.ts';

const FLEX_BONUS = 2.5;
const FLEX_POWER_FACTOR = 0.6;

type SessionRow = {
  id: string;
  user_id: string;
  station_id: number;
  connector_id: number;
  status: 'active' | 'completed' | 'cancelled';
  started_at: number;
  ended_at: number | null;
  start_soc: number;
  target_soc: number;
  battery_kwh: number;
  power_kw: number;
  price_kwh: number;
  signal_level: 'verde' | 'amarelo' | 'vermelho';
  flex_accepted: number;
  /** Enquanto ativa: energia/custo/créditos acumulados em segmentos anteriores (antes de uma modulação). */
  energy_kwh: number | null;
  cost: number | null;
  credits: number | null;
};

/** Estado simulado da sessão no instante `now` (a simulação é acelerada por CHARGING_SIM_SPEED). */
function progress(s: SessionRow, now = nowEpoch()) {
  const priorKwh = s.energy_kwh ?? 0;
  const neededKwh = Math.max(0, ((s.target_soc - s.start_soc) / 100) * s.battery_kwh);
  if (s.status !== 'active') {
    return { energyKwh: priorKwh, soc: s.target_soc, done: true, remainingMin: 0, elapsedMin: 0 };
  }
  const simHours = ((now - s.started_at) * config.chargingSimSpeed) / 3600;
  const segmentKwh = Math.min(neededKwh, s.power_kw * simHours);
  const soc = clamp(s.start_soc + (segmentKwh / s.battery_kwh) * 100, 0, 100);
  const remainingKwh = neededKwh - segmentKwh;
  return {
    energyKwh: round(priorKwh + segmentKwh, 2),
    soc: round(soc, 1),
    done: remainingKwh <= 0.001,
    remainingMin: Math.ceil((remainingKwh / s.power_kw) * 60),
    elapsedMin: Math.round(simHours * 60),
  };
}

function toDto(s: SessionRow) {
  const station = getStationRaw(s.station_id);
  const connector = station.connectors.find((c) => c.id === s.connector_id);
  const p = progress(s);
  const regionPrice = s.status === 'active' ? priceAt(station.region_id, nowEpoch()) : null;
  return {
    id: s.id,
    status: s.status,
    station: { id: station.id, name: station.name, address: station.address, regionId: station.region_id },
    connector: connector
      ? { id: connector.id, type: connector.type_name, current: connector.current, chargeType: connector.charge_type,
          chargeTypeLabel: CHARGE_TYPE_INFO[connector.charge_type].label }
      : null,
    startedAt: isoLocal(s.started_at),
    endedAt: s.ended_at ? isoLocal(s.ended_at) : null,
    startSoc: s.start_soc,
    targetSoc: s.target_soc,
    soc: s.status === 'active' ? p.soc : s.target_soc,
    powerKw: s.power_kw,
    priceKwh: s.price_kwh,
    signalLevel: s.signal_level,
    flexAccepted: s.flex_accepted === 1,
    energyKwh: s.status === 'active' ? p.energyKwh : s.energy_kwh ?? 0,
    cost: s.status === 'active' ? round(p.energyKwh * s.price_kwh, 2) : s.cost ?? 0,
    credits: s.credits ?? 0,
    elapsedMin: p.elapsedMin,
    remainingMin: p.remainingMin,
    readyToFinish: p.done,
    // Oferta de modulação: aparece quando a rede está pressionada e a recarga é DC.
    flexOffer:
      s.status === 'active' && s.flex_accepted === 0 && connector?.current === 'DC' && regionPrice && regionPrice.signal.level !== 'verde'
        ? {
            reducedPowerKw: round(s.power_kw * FLEX_POWER_FACTOR, 1),
            bonus: FLEX_BONUS,
            reason: regionPrice.signal.level === 'vermelho'
              ? 'Pico de demanda na sua região: reduzir a potência alivia a rede.'
              : 'Demanda subindo na região: modular agora evita o pico.',
          }
        : null,
  };
}

function getSession(userId: string, id: string): SessionRow {
  const s = get<SessionRow>('SELECT * FROM charging_sessions WHERE id = ? AND user_id = ?', id, userId);
  if (!s) throw notFound('Sessão de recarga não encontrada');
  return s;
}

export function startSession(userId: string, input: { stationId: number; connectorId: number; targetSoc?: number }, ip?: string) {
  const user = getUser(userId);
  const vehicle: Vehicle | null = user.vehicle_json ? JSON.parse(user.vehicle_json) : null;
  if (!vehicle) throw badRequest('Cadastre seu veículo no perfil antes de iniciar uma recarga');
  if (get("SELECT 1 FROM charging_sessions WHERE user_id = ? AND status = 'active'", userId)) {
    throw conflict('Você já tem uma recarga em andamento');
  }
  const detail = stationDetail(input.stationId);
  const connector = detail.connectorsDetail.find((c) => c.id === input.connectorId);
  if (!connector) throw notFound('Conector não encontrado nesta estação');
  if (connector.status !== 'disponivel') throw conflict('Conector indisponível no momento');

  const targetSoc = clamp(input.targetSoc ?? vehicle.targetSoc ?? 80, 20, 100);
  if (targetSoc <= vehicle.soc) throw badRequest('A meta de carga deve ser maior que a carga atual');
  const vehicleMax = connector.current === 'DC' ? vehicle.maxDcKw : vehicle.maxAcKw;
  const power = Math.max(1, Math.min(connector.powerKw, vehicleMax || connector.powerKw));
  const price = priceAt(detail.regionId, nowEpoch());

  const id = newId('chg');
  run(
    `INSERT INTO charging_sessions (id, user_id, station_id, connector_id, status, started_at, start_soc, target_soc, battery_kwh,
      power_kw, price_kwh, signal_level, energy_kwh, cost, credits)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
    id, userId, input.stationId, input.connectorId, nowEpoch(), vehicle.soc, targetSoc, vehicle.batteryKwh, power,
    price.consumerPrices[connector.chargeType], price.signal.level,
  );
  refreshActiveConnectors();
  audit(userId, 'charging.start', `${id} station=${input.stationId}`, ip);
  return toDto(getSession(userId, id));
}

export function activeSession(userId: string) {
  const s = get<SessionRow>("SELECT * FROM charging_sessions WHERE user_id = ? AND status = 'active'", userId);
  return s ? toDto(s) : null;
}

/** Consumidor aceita reduzir a potência durante o pico — o sinal da rede vira crédito. */
export function acceptFlex(userId: string, id: string) {
  const s = getSession(userId, id);
  if (s.status !== 'active') throw badRequest('A sessão não está ativa');
  const dto = toDto(s);
  if (!dto.flexOffer) throw badRequest('Não há oferta de modulação disponível agora');
  const p = progress(s);
  const now = nowEpoch();
  // Fecha o segmento atual e inicia outro com potência reduzida.
  run(
    `UPDATE charging_sessions SET flex_accepted = 1, power_kw = ?, started_at = ?, start_soc = ?, energy_kwh = ?, credits = ?
     WHERE id = ?`,
    round(s.power_kw * FLEX_POWER_FACTOR, 1), now, p.soc, p.energyKwh, (s.credits ?? 0) + FLEX_BONUS, id,
  );
  return toDto(getSession(userId, id));
}

export function stopSession(userId: string, id: string, opts: { useCredits: boolean }, ip?: string) {
  const s = getSession(userId, id);
  if (s.status !== 'active') throw badRequest('A sessão já foi encerrada');
  const p = progress(s);
  const station = getStationRaw(s.station_id);
  const bonusKwh = priceAt(station.region_id, s.started_at).signal.creditBonusKwh;
  const energy = p.energyKwh;
  const cost = round(energy * s.price_kwh, 2);
  const credits = round((s.credits ?? 0) + energy * bonusKwh, 2);

  const result = transaction(() => {
    run(`UPDATE charging_sessions SET status = 'completed', ended_at = ?, energy_kwh = ?, cost = ?, credits = ? WHERE id = ?`,
      nowEpoch(), energy, cost, credits, id);
    if (credits > 0) {
      run('INSERT INTO wallet_ledger (id, user_id, amount_cents, description, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        newId('led'), userId, Math.round(credits * 100),
        s.flex_accepted ? 'Bônus de flexibilidade (modulação aceita)' : 'Bônus de recarga em janela verde', id, nowEpoch());
    }
    let creditsUsed = 0;
    if (opts.useCredits) {
      const balance = walletBalanceCents(userId);
      creditsUsed = Math.min(balance, Math.round(cost * 100)) / 100;
      if (creditsUsed > 0) {
        run('INSERT INTO wallet_ledger (id, user_id, amount_cents, description, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          newId('led'), userId, -Math.round(creditsUsed * 100), `Abatimento na recarga em ${station.name}`, id, nowEpoch());
      }
    }
    // Atualiza o SOC do veículo com o resultado da recarga.
    const user = getUser(userId);
    if (user.vehicle_json) {
      const v = JSON.parse(user.vehicle_json) as Vehicle;
      const newSoc = Math.round(clamp(p.soc, 0, 100));
      v.rangeKm = Math.round((v.rangeKm / Math.max(1, v.soc)) * newSoc);
      v.soc = newSoc;
      run('UPDATE users SET vehicle_json = ? WHERE id = ?', JSON.stringify(v), userId);
    }
    notify(userId, {
      kind: 'charging',
      title: 'Recarga concluída',
      body: `${energy.toFixed(1).replace('.', ',')} kWh em ${station.name}. Total R$ ${cost.toFixed(2).replace('.', ',')}${
        credits > 0 ? ` · +R$ ${credits.toFixed(2).replace('.', ',')} em créditos` : ''}.`,
      data: { sessionId: id },
    });
    return { creditsUsed };
  });
  refreshActiveConnectors();
  audit(userId, 'charging.stop', id, ip);
  return { session: toDto(getSession(userId, id)), amountDue: round(cost - result.creditsUsed, 2), creditsUsed: result.creditsUsed };
}

export function sessionHistory(userId: string, limit = 20) {
  return all<SessionRow>(
    "SELECT * FROM charging_sessions WHERE user_id = ? AND status <> 'active' ORDER BY started_at DESC LIMIT ?",
    userId, limit,
  ).map(toDto);
}

export function getSessionDto(userId: string, id: string) {
  return toDto(getSession(userId, id));
}
