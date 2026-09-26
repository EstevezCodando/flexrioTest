import { config } from '../config.ts';
import { audit, get, run } from '../db/index.ts';
import { getDummyHash, hashPassword, newId, newToken, sha256, verifyPassword } from '../lib/crypto.ts';
import { conflict, HttpError } from '../lib/http.ts';
import { nowEpoch } from '../lib/util.ts';

export type Role = 'consumer' | 'manager';

export type Vehicle = {
  manufacturer: string;
  model: string;
  batteryKwh: number;
  soc: number;
  targetSoc: number;
  connector: string;
  maxDcKw: number;
  maxAcKw: number;
  rangeKm: number;
};

export type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  region_id: string | null;
  vehicle_json: string | null;
  failed_attempts: number;
  locked_until: number | null;
  created_at: number;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  regionId: string | null;
  vehicle: Vehicle | null;
};

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    regionId: u.region_id,
    vehicle: u.vehicle_json ? (JSON.parse(u.vehicle_json) as Vehicle) : null,
  };
}

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 15 * 60;
const INVALID = () => new HttpError(401, 'E-mail ou senha inválidos', 'invalid_credentials');

/**
 * Login por portal: o consumidor só entra pelo portal do usuário e o gestor só pelo
 * portal de gestão. A mensagem de erro é sempre genérica (não revela se o e-mail existe
 * nem o papel da conta) e o tempo de resposta é equalizado com um hash fantasma.
 */
export async function login(email: string, password: string, portal: Role, ip?: string, userAgent?: string) {
  const user = get<UserRow>('SELECT * FROM users WHERE email = ?', email);
  const now = nowEpoch();

  if (!user) {
    await verifyPassword(password, await getDummyHash());
    audit(null, 'auth.login_failed', `unknown:${sha256(email.toLowerCase()).slice(0, 12)}`, ip);
    throw INVALID();
  }
  if (user.locked_until && user.locked_until > now) {
    audit(user.id, 'auth.login_locked', null, ip);
    throw new HttpError(429, 'Muitas tentativas. Tente novamente em alguns minutos.', 'locked');
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok || user.role !== portal) {
    const attempts = user.failed_attempts + 1;
    run('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?',
      attempts >= MAX_ATTEMPTS ? 0 : attempts, attempts >= MAX_ATTEMPTS ? now + LOCK_SECONDS : null, user.id);
    audit(user.id, ok ? 'auth.wrong_portal' : 'auth.login_failed', portal, ip);
    throw INVALID();
  }

  run('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', user.id);
  // Limpa sessões expiradas do usuário a cada login.
  run('DELETE FROM auth_sessions WHERE user_id = ? AND expires_at < ?', user.id, now);
  const token = newToken();
  run('INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    sha256(token), user.id, now, now + config.sessionTtlHours * 3600, ip ?? null, userAgent?.slice(0, 200) ?? null);
  audit(user.id, 'auth.login', portal, ip);
  return { token, user: toPublicUser(user) };
}

export async function registerConsumer(input: { name: string; email: string; password: string; regionId: string; vehicle?: Vehicle }, ip?: string) {
  if (get('SELECT 1 FROM users WHERE email = ?', input.email)) throw conflict('Já existe uma conta com este e-mail');
  const id = newId('usr');
  run(
    `INSERT INTO users (id, email, name, password_hash, role, region_id, vehicle_json, created_at)
     VALUES (?, ?, ?, ?, 'consumer', ?, ?, ?)`,
    id, input.email, input.name, await hashPassword(input.password), input.regionId,
    input.vehicle ? JSON.stringify(input.vehicle) : null, nowEpoch(),
  );
  audit(id, 'auth.register', null, ip);
  return login(input.email, input.password, 'consumer', ip);
}

export function userFromToken(token: string): UserRow | undefined {
  return get<UserRow>(
    `SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    sha256(token), nowEpoch(),
  );
}

export function logout(token: string) {
  run('DELETE FROM auth_sessions WHERE token_hash = ?', sha256(token));
}

export function getUser(id: string): UserRow {
  const u = get<UserRow>('SELECT * FROM users WHERE id = ?', id);
  if (!u) throw new HttpError(404, 'Usuário não encontrado', 'not_found');
  return u;
}

export function updateProfile(userId: string, patch: { name?: string; regionId?: string; vehicle?: Vehicle }) {
  const u = getUser(userId);
  run('UPDATE users SET name = ?, region_id = ?, vehicle_json = ? WHERE id = ?',
    patch.name ?? u.name,
    patch.regionId ?? u.region_id,
    patch.vehicle ? JSON.stringify(patch.vehicle) : u.vehicle_json,
    userId);
  return toPublicUser(getUser(userId));
}
