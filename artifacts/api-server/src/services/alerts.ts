import { all, get, run, transaction } from '../db/index.ts';
import { CHARGE_TYPE_INFO, type ChargeType } from '../domain/reference.ts';
import { newId } from '../lib/crypto.ts';
import { badRequest, notFound } from '../lib/http.ts';
import { isoLocal, nowEpoch } from '../lib/util.ts';
import { notify } from './notifications.ts';
import { priceAt } from './pricing.ts';
import { region } from './regions.ts';
import { getStationRaw } from './stations.ts';

type AlertRow = {
  id: string;
  user_id: string;
  region_id: string;
  station_id: number | null;
  charge_type: ChargeType;
  max_price_kwh: number | null;
  notify_green_window: number;
  active: number;
  last_triggered_at: number | null;
  created_at: number;
};

const COOLDOWN = 3 * 3600;
const MAX_ALERTS_PER_USER = 20;

function toDto(a: AlertRow) {
  const price = priceAt(a.region_id, nowEpoch());
  return {
    id: a.id,
    regionId: a.region_id,
    regionName: region(a.region_id).name,
    stationId: a.station_id,
    stationName: a.station_id ? getStationRaw(a.station_id).name : null,
    chargeType: a.charge_type,
    chargeTypeLabel: CHARGE_TYPE_INFO[a.charge_type].label,
    maxPriceKwh: a.max_price_kwh,
    notifyGreenWindow: a.notify_green_window === 1,
    active: a.active === 1,
    lastTriggeredAt: a.last_triggered_at ? isoLocal(a.last_triggered_at) : null,
    currentPriceKwh: price.consumerPrices[a.charge_type],
    currentLevel: price.signal.level,
  };
}

export function listAlerts(userId: string) {
  return all<AlertRow>('SELECT * FROM price_alerts WHERE user_id = ? ORDER BY created_at DESC', userId).map(toDto);
}

export type AlertInput = {
  regionId: string;
  stationId?: number | null;
  chargeType: ChargeType;
  maxPriceKwh?: number | null;
  notifyGreenWindow: boolean;
};

export function createAlert(userId: string, input: AlertInput) {
  region(input.regionId);
  if (input.stationId) {
    const s = getStationRaw(input.stationId);
    if (s.region_id !== input.regionId) throw badRequest('A estação não pertence à região escolhida');
  }
  if (!input.maxPriceKwh && !input.notifyGreenWindow) throw badRequest('Defina um preço máximo ou ative o aviso de janela verde');
  const count = get<{ n: number }>('SELECT COUNT(*) AS n FROM price_alerts WHERE user_id = ?', userId)?.n ?? 0;
  if (count >= MAX_ALERTS_PER_USER) throw badRequest(`Limite de ${MAX_ALERTS_PER_USER} alertas atingido`);
  const id = newId('alr');
  run(
    `INSERT INTO price_alerts (id, user_id, region_id, station_id, charge_type, max_price_kwh, notify_green_window, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    id, userId, input.regionId, input.stationId ?? null, input.chargeType, input.maxPriceKwh ?? null,
    input.notifyGreenWindow ? 1 : 0, nowEpoch(),
  );
  return toDto(get<AlertRow>('SELECT * FROM price_alerts WHERE id = ?', id)!);
}

export function updateAlert(userId: string, id: string, patch: { active?: boolean; maxPriceKwh?: number | null }) {
  const a = get<AlertRow>('SELECT * FROM price_alerts WHERE id = ? AND user_id = ?', id, userId);
  if (!a) throw notFound('Alerta não encontrado');
  run('UPDATE price_alerts SET active = ?, max_price_kwh = ? WHERE id = ?',
    patch.active === undefined ? a.active : patch.active ? 1 : 0,
    patch.maxPriceKwh === undefined ? a.max_price_kwh : patch.maxPriceKwh,
    id);
  return toDto(get<AlertRow>('SELECT * FROM price_alerts WHERE id = ?', id)!);
}

export function deleteAlert(userId: string, id: string) {
  const r = run('DELETE FROM price_alerts WHERE id = ? AND user_id = ?', id, userId);
  if (Number(r.changes) === 0) throw notFound('Alerta não encontrado');
}

/**
 * Avaliador periódico: compara o preço dinâmico atual com cada alerta ativo e gera
 * notificações persistidas (com cooldown de 3 h por alerta para não gerar spam).
 */
export function evaluateAlerts(): number {
  const now = nowEpoch();
  const alerts = all<AlertRow>(
    'SELECT * FROM price_alerts WHERE active = 1 AND (last_triggered_at IS NULL OR last_triggered_at < ?)',
    now - COOLDOWN,
  );
  let fired = 0;
  transaction(() => {
    for (const a of alerts) {
      const p = priceAt(a.region_id, now);
      const price = p.consumerPrices[a.charge_type];
      const label = CHARGE_TYPE_INFO[a.charge_type].label;
      const where = a.station_id ? getStationRaw(a.station_id).name : region(a.region_id).name;
      const hitPrice = a.max_price_kwh !== null && price <= a.max_price_kwh;
      const hitGreen = a.notify_green_window === 1 && p.signal.level === 'verde';
      if (!hitPrice && !hitGreen) continue;
      notify(a.user_id, {
        kind: 'price_alert',
        title: hitGreen ? `Janela verde em ${where}` : `Preço abaixo do seu alvo em ${where}`,
        body: `${label}: R$ ${price.toFixed(2).replace('.', ',')}/kWh agora${
          a.max_price_kwh ? ` (alvo R$ ${a.max_price_kwh.toFixed(2).replace('.', ',')})` : ''
        }. ${hitGreen ? 'Energia abundante e créditos extras por kWh.' : ''}`.trim(),
        data: { alertId: a.id, regionId: a.region_id, stationId: a.station_id, priceKwh: price, level: p.signal.level },
      });
      run('UPDATE price_alerts SET last_triggered_at = ? WHERE id = ?', now, a.id);
      fired++;
    }
  });
  return fired;
}
