import { Router } from 'express';
import { z } from 'zod';
import { CHARGE_TYPES } from '../domain/reference.ts';
import { handler, parse } from '../lib/http.ts';
import { createAlert, deleteAlert, listAlerts, updateAlert } from '../services/alerts.ts';
import { acceptFlex, activeSession, getSessionDto, sessionHistory, startSession, stopSession } from '../services/charging.ts';
import { listNotifications, markRead } from '../services/notifications.ts';
import { isRegion } from '../services/regions.ts';
import { walletSummary } from '../services/wallet.ts';

const idParam = z.object({ id: z.string().regex(/^[a-z]{3}_[A-Za-z0-9_-]{6,20}$/) });

/** Notificações servem consumidor e gestor. */
export const notificationsRouter = Router();

notificationsRouter.get('/', (req, res) => {
  res.json(listNotifications(req.user!.id));
});
notificationsRouter.post('/read-all', (req, res) => {
  markRead(req.user!.id);
  res.status(204).end();
});
notificationsRouter.post('/:id/read', handler((req, res) => {
  const { id } = parse(idParam, req.params);
  markRead(req.user!.id, id);
  res.status(204).end();
}));

/** Recursos exclusivos do consumidor. */
export const consumerRouter = Router();

const alertSchema = z.object({
  regionId: z.string().refine(isRegion, 'região inválida'),
  stationId: z.number().int().positive().nullable().optional(),
  chargeType: z.enum(CHARGE_TYPES),
  maxPriceKwh: z.number().min(0.1).max(20).nullable().optional(),
  notifyGreenWindow: z.boolean().default(false),
});

consumerRouter.get('/alerts', (req, res) => res.json(listAlerts(req.user!.id)));
consumerRouter.post('/alerts', handler((req, res) => {
  res.status(201).json(createAlert(req.user!.id, parse(alertSchema, req.body)));
}));
consumerRouter.patch('/alerts/:id', handler((req, res) => {
  const { id } = parse(idParam, req.params);
  const body = parse(z.object({ active: z.boolean().optional(), maxPriceKwh: z.number().min(0.1).max(20).nullable().optional() }), req.body);
  res.json(updateAlert(req.user!.id, id, body));
}));
consumerRouter.delete('/alerts/:id', handler((req, res) => {
  const { id } = parse(idParam, req.params);
  deleteAlert(req.user!.id, id);
  res.status(204).end();
}));

consumerRouter.get('/charging/active', (req, res) => res.json({ session: activeSession(req.user!.id) }));
consumerRouter.get('/charging/history', (req, res) => res.json(sessionHistory(req.user!.id)));
consumerRouter.get('/charging/:id', handler((req, res) => {
  const { id } = parse(idParam, req.params);
  res.json(getSessionDto(req.user!.id, id));
}));
consumerRouter.post('/charging', handler((req, res) => {
  const body = parse(
    z.object({ stationId: z.number().int().positive(), connectorId: z.number().int().positive(), targetSoc: z.number().min(20).max(100).optional() }),
    req.body,
  );
  res.status(201).json(startSession(req.user!.id, body, req.ip));
}));
consumerRouter.post('/charging/:id/flex', handler((req, res) => {
  const { id } = parse(idParam, req.params);
  res.json(acceptFlex(req.user!.id, id));
}));
consumerRouter.post('/charging/:id/stop', handler((req, res) => {
  const { id } = parse(idParam, req.params);
  const body = parse(z.object({ useCredits: z.boolean().default(false) }), req.body ?? {});
  res.json(stopSession(req.user!.id, id, body, req.ip));
}));

consumerRouter.get('/wallet', (req, res) => res.json(walletSummary(req.user!.id)));
