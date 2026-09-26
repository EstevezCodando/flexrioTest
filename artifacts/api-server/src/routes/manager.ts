import { Router } from 'express';
import { z } from 'zod';
import { all, get } from '../db/index.ts';
import { SIGNAL_LEVELS } from '../domain/reference.ts';
import { chat, deleteConversation, flexiaStatus, getConversation, listConversations } from '../flexia/agent.ts';
import { KNOWLEDGE, searchKnowledge } from '../flexia/knowledge.ts';
import { handler, parse } from '../lib/http.ts';
import { isoLocal, nowEpoch } from '../lib/util.ts';
import { flexiaLimiter } from '../middleware/security.ts';
import { datasetSnapshots, stationLineage } from '../services/lineage.ts';
import { gridSeries, weatherSeries } from '../services/grid.ts';
import { priceAt } from '../services/pricing.ts';
import { isRegion, regions } from '../services/regions.ts';
import { cancelSignal, createSignal, listSignals } from '../services/signals.ts';
import { estimatedChargingLoadMw, stationsStats } from '../services/stations.ts';

const regionParam = z.string().refine(isRegion, 'região inválida');

export const managerRouter = Router();

/** Visão geral: KPIs agregados por região (sem dados individuais de consumidores — LGPD). */
managerRouter.get('/overview', (_req, res) => {
  const now = nowEpoch();
  const byRegion = regions().map((r) => {
    const p = priceAt(r.id, now);
    const g = gridSeries(r.id, 1)[0];
    const ev = estimatedChargingLoadMw(r.id);
    const st = stationsStats(r.id);
    return {
      regionId: r.id,
      regionName: r.name,
      level: p.signal.level,
      signalSource: p.signal.source,
      energyCostKwh: p.best.totalKwh,
      dcPriceKwh: p.consumerPrices.dc_rapida,
      demandMw: g.regionalDemandMw,
      loadFactorPct: g.loadFactorPct,
      evLoadMw: ev.mw,
      busyConnectors: ev.busyConnectors,
      totalConnectors: ev.totalConnectors,
      stations: st.stations,
      maintenance: st.maintenance,
    };
  });
  const users = get<{ consumers: number; managers: number }>(
    "SELECT SUM(role = 'consumer') AS consumers, SUM(role = 'manager') AS managers FROM users",
  )!;
  const since = now - 7 * 86400;
  const charging = get<{ sessions: number; kwh: number | null; flex: number | null; active: number }>(
    `SELECT COUNT(*) AS sessions, SUM(energy_kwh) AS kwh, SUM(flex_accepted) AS flex,
            (SELECT COUNT(*) FROM charging_sessions WHERE status = 'active') AS active
     FROM charging_sessions WHERE started_at >= ?`,
    since,
  )!;
  const alerts = get<{ n: number }>('SELECT COUNT(*) AS n FROM price_alerts WHERE active = 1')!.n;
  res.json({
    generatedAt: isoLocal(now),
    totals: {
      consumers: users.consumers ?? 0,
      activeAlerts: alerts,
      activeSessions: charging.active,
      sessions7d: charging.sessions,
      energy7dKwh: Math.round((charging.kwh ?? 0) * 10) / 10,
      flexEvents7d: charging.flex ?? 0,
      ...stationsStats(),
    },
    regions: byRegion,
    signals: listSignals(),
  });
});

managerRouter.get('/grid/:region', handler((req, res) => {
  const { region } = parse(z.object({ region: regionParam }), req.params);
  const q = parse(z.object({ hours: z.coerce.number().int().min(1).max(48).default(24) }), req.query);
  res.json({ region, grid: gridSeries(region, q.hours), weather: weatherSeries(region, q.hours), evLoad: estimatedChargingLoadMw(region) });
}));

const signalSchema = z.object({
  regionId: regionParam,
  level: z.enum(SIGNAL_LEVELS),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  title: z.string().trim().min(3).max(80),
  message: z.string().trim().min(10).max(280),
  multiplier: z.number().min(0.5).max(2).optional(),
  creditBonusKwh: z.number().min(0).max(1).optional(),
  notifyConsumers: z.boolean().default(true),
});

managerRouter.get('/signals', handler((req, res) => {
  const q = parse(z.object({ region: regionParam.optional(), past: z.enum(['true', 'false']).optional() }), req.query);
  res.json(listSignals({ regionId: q.region, includePast: q.past === 'true' }));
}));
managerRouter.post('/signals', handler((req, res) => {
  const b = parse(signalSchema, req.body);
  const toEpoch = (s: string) => Math.floor(new Date(s).getTime() / 1000);
  res.status(201).json(createSignal({ ...b, startsAt: toEpoch(b.startsAt), endsAt: toEpoch(b.endsAt) }, req.user!.id, req.ip));
}));
managerRouter.delete('/signals/:id', handler((req, res) => {
  const { id } = parse(z.object({ id: z.string().regex(/^sig_[A-Za-z0-9_-]{6,20}$/) }), req.params);
  cancelSignal(id, req.user!.id, req.ip);
  res.status(204).end();
}));

managerRouter.get('/knowledge', handler((req, res) => {
  const q = parse(z.object({ q: z.string().max(120).optional() }), req.query);
  res.json(q.q ? searchKnowledge(q.q, 10) : KNOWLEDGE);
}));

/** Rastreabilidade: manifestos dos snapshots importados e cadeia de lineage por estação. */
managerRouter.get('/lineage/datasets', (_req, res) => res.json(datasetSnapshots()));
managerRouter.get('/lineage/stations/:id', handler((req, res) => {
  const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
  res.json(stationLineage(id));
}));

managerRouter.get('/audit', (_req, res) => {
  res.json(
    all<{ id: number; user_id: string | null; action: string; detail: string | null; created_at: number }>(
      'SELECT id, user_id, action, detail, created_at FROM audit_log ORDER BY id DESC LIMIT 100',
    ).map((a) => ({ ...a, createdAt: isoLocal(a.created_at) })),
  );
});

// --- FlexIA -----------------------------------------------------------------
managerRouter.get('/flexia/status', (_req, res) => res.json(flexiaStatus()));
managerRouter.get('/flexia/conversations', (req, res) => res.json(listConversations(req.user!.id)));
managerRouter.get('/flexia/conversations/:id', handler((req, res) => {
  const { id } = parse(z.object({ id: z.string().regex(/^cnv_[A-Za-z0-9_-]{6,20}$/) }), req.params);
  res.json(getConversation(req.user!.id, id));
}));
managerRouter.delete('/flexia/conversations/:id', handler((req, res) => {
  const { id } = parse(z.object({ id: z.string().regex(/^cnv_[A-Za-z0-9_-]{6,20}$/) }), req.params);
  deleteConversation(req.user!.id, id);
  res.status(204).end();
}));
managerRouter.post('/flexia/chat', flexiaLimiter, handler(async (req, res) => {
  const body = parse(
    z.object({ conversationId: z.string().regex(/^cnv_[A-Za-z0-9_-]{6,20}$/).optional(), message: z.string().trim().min(2).max(2000) }),
    req.body,
  );
  res.json(await chat(req.user!.id, body, req.user!.regionId ?? 'capital'));
}));
