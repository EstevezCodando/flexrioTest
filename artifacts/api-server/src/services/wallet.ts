import { all, get } from '../db/index.ts';
import { isoLocal } from '../lib/util.ts';

export function walletBalanceCents(userId: string): number {
  return get<{ s: number | null }>('SELECT SUM(amount_cents) AS s FROM wallet_ledger WHERE user_id = ?', userId)?.s ?? 0;
}

export function walletSummary(userId: string) {
  const ledger = all<{ id: string; amount_cents: number; description: string; created_at: number }>(
    'SELECT id, amount_cents, description, created_at FROM wallet_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    userId,
  );
  const stats = get<{ sessions: number; kwh: number | null; green_kwh: number | null; cost: number | null; flex: number }>(
    `SELECT COUNT(*) AS sessions, SUM(energy_kwh) AS kwh,
            SUM(CASE WHEN signal_level = 'verde' OR flex_accepted = 1 THEN energy_kwh ELSE 0 END) AS green_kwh,
            SUM(cost) AS cost, SUM(flex_accepted) AS flex
     FROM charging_sessions WHERE user_id = ? AND status = 'completed'`,
    userId,
  )!;
  const balance = walletBalanceCents(userId);
  const flexKwh = stats.green_kwh ?? 0;
  return {
    balance: balance / 100,
    credits: balance, // 1 crédito = R$ 0,01
    stats: {
      sessions: stats.sessions,
      energyKwh: Math.round((stats.kwh ?? 0) * 10) / 10,
      flexibleEnergyKwh: Math.round(flexKwh * 10) / 10,
      totalSpent: Math.round((stats.cost ?? 0) * 100) / 100,
      flexEventsAccepted: stats.flex ?? 0,
      // Fator ilustrativo: térmica marginal evitada ao deslocar consumo para janelas renováveis.
      co2AvoidedKg: Math.round(flexKwh * 0.4 * 10) / 10,
    },
    ledger: ledger.map((l) => ({
      id: l.id,
      amount: l.amount_cents / 100,
      type: l.amount_cents >= 0 ? 'credit' : 'debit',
      description: l.description,
      createdAt: isoLocal(l.created_at),
    })),
  };
}
