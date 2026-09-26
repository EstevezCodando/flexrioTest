import { all, get, run, transaction } from '../db/index.ts';
import { newId } from '../lib/crypto.ts';
import { isoLocal, nowEpoch } from '../lib/util.ts';

export type NotificationInput = { kind: string; title: string; body: string; data?: Record<string, unknown> };

export function notify(userId: string, n: NotificationInput) {
  run(
    'INSERT INTO notifications (id, user_id, kind, title, body, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    newId('ntf'), userId, n.kind, n.title, n.body, n.data ? JSON.stringify(n.data) : null, nowEpoch(),
  );
}

export function notifyMany(userIds: string[], n: NotificationInput) {
  transaction(() => userIds.forEach((id) => notify(id, n)));
}

type Row = { id: string; kind: string; title: string; body: string; data_json: string | null; created_at: number; read_at: number | null };

export function listNotifications(userId: string, limit = 30) {
  const items = all<Row>(
    'SELECT id, kind, title, body, data_json, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    userId, limit,
  ).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    data: r.data_json ? JSON.parse(r.data_json) : null,
    createdAt: isoLocal(r.created_at),
    read: r.read_at !== null,
  }));
  const unread = get<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', userId)?.n ?? 0;
  return { unread, items };
}

export function markRead(userId: string, id?: string) {
  if (id) run('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL', nowEpoch(), id, userId);
  else run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', nowEpoch(), userId);
}
