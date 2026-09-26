import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..');

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Variável ${name} inválida: "${raw}"`);
  return n;
}

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  isProd,
  port: int('PORT', 5000),
  dbPath: path.resolve(ROOT_DIR, process.env.DB_PATH ?? './data/rioflex.db'),
  datasetDir: path.resolve(ROOT_DIR, process.env.DATASET_DIR ?? './data/carregados_rj'),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  sessionTtlHours: int('SESSION_TTL_HOURS', 12),
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd,
  chargingSimSpeed: int('CHARGING_SIM_SPEED', 30),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
  flexiaModel: process.env.FLEXIA_MODEL?.trim() || 'claude-opus-5',
  seed: {
    consumerEmail: process.env.SEED_CONSUMER_EMAIL ?? 'marcos@rioflex.dev',
    consumerPassword: process.env.SEED_CONSUMER_PASSWORD ?? 'RioFlex@2026',
    managerEmail: process.env.SEED_MANAGER_EMAIL ?? 'gestora@rioflex.dev',
    managerPassword: process.env.SEED_MANAGER_PASSWORD ?? 'Gestor@2026',
  },
  /** Em desenvolvimento, aceita qualquer origem localhost (o Vite pode subir em porta dinâmica). */
  isAllowedOrigin(origin: string): boolean {
    if ((this.allowedOrigins as readonly string[]).includes(origin)) return true;
    return !isProd && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  },
  /** Fuso do RJ: UTC-3, sem horário de verão desde 2019. */
  tzOffsetHours: -3,
} as const;
