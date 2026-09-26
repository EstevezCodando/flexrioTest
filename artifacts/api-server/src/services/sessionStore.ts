import { DeleteItemCommand, DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { config } from '../config.ts';
import { get, run } from '../db/index.ts';
import { nowEpoch } from '../lib/util.ts';

const client = config.sessionStore === 'dynamodb' ? new DynamoDBClient({}) : null;

export async function createSession(
  tokenHash: string,
  userId: string,
  ttlSeconds: number,
  ip?: string | null,
  userAgent?: string | null,
) {
  const now = nowEpoch();
  const expiresAt = now + ttlSeconds;
  if (client) {
    await client.send(
      new PutItemCommand({
        TableName: config.sessionsTable!,
        Item: {
          tokenHash: { S: tokenHash },
          userId: { S: userId },
          createdAt: { N: String(now) },
          expiresAt: { N: String(expiresAt) },
          ...(ip ? { ip: { S: ip } } : {}),
          ...(userAgent ? { userAgent: { S: userAgent.slice(0, 200) } } : {}),
        },
      }),
    );
    return;
  }
  run('DELETE FROM auth_sessions WHERE user_id = ? AND expires_at < ?', userId, now);
  run(
    'INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    tokenHash,
    userId,
    now,
    expiresAt,
    ip ?? null,
    userAgent?.slice(0, 200) ?? null,
  );
}

export async function findUserIdByToken(tokenHash: string): Promise<string | undefined> {
  if (client) {
    const out = await client.send(
      new GetItemCommand({ TableName: config.sessionsTable!, Key: { tokenHash: { S: tokenHash } } }),
    );
    const expiresAt = Number(out.Item?.expiresAt?.N ?? 0);
    if (!out.Item || expiresAt <= nowEpoch()) return undefined;
    return out.Item.userId?.S;
  }
  const row = get<{ user_id: string }>(
    'SELECT user_id FROM auth_sessions WHERE token_hash = ? AND expires_at > ?',
    tokenHash,
    nowEpoch(),
  );
  return row?.user_id;
}

export async function deleteSession(tokenHash: string) {
  if (client) {
    await client.send(new DeleteItemCommand({ TableName: config.sessionsTable!, Key: { tokenHash: { S: tokenHash } } }));
    return;
  }
  run('DELETE FROM auth_sessions WHERE token_hash = ?', tokenHash);
}
