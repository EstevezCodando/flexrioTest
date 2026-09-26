import fs from 'node:fs';
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

const DEFAULT_SEED = {
  consumerEmail: 'marcos@rioflex.dev',
  consumerPassword: 'RioFlex@2026',
  managerEmail: 'gestora@rioflex.dev',
  managerPassword: 'Gestor@2026',
};

/** Backend da FlexIA: AgentCore (FlexIA da AWS), Claude direto (API Anthropic) ou motor local. */
export type FlexiaBackend = 'agentcore' | 'claude' | 'local';

function resolveFlexiaBackend(): FlexiaBackend {
  const raw = (process.env.FLEXIA_BACKEND ?? 'auto').trim().toLowerCase();
  if (raw === 'agentcore' || raw === 'claude' || raw === 'local') return raw;
  if (process.env.FLEXIA_RUNTIME_ARN?.trim()) return 'agentcore';
  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'claude';
  return 'local';
}

const webDistEnv = process.env.WEB_DIST?.trim();
const webDistDefault = path.resolve(ROOT_DIR, '../rio-flex/dist');

export const config = {
  isProd,
  port: int('PORT', 5000),
  dbPath: path.resolve(ROOT_DIR, process.env.DB_PATH ?? './data/rioflex.db'),
  datasetDir: path.resolve(ROOT_DIR, process.env.DATASET_DIR ?? './data/carregados_rj'),
  /** Frontend compilado servido na mesma origem (produção). Vazio/inexistente = só API. */
  webDist: webDistEnv ? path.resolve(webDistEnv) : fs.existsSync(path.join(webDistDefault, 'index.html')) && isProd ? webDistDefault : null,
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  /** Saltos de proxy confiáveis (ALB/NGINX = 1). 0 = conexão direta. */
  trustProxy: Number(process.env.TRUST_PROXY ?? (isProd ? 1 : 0)),
  sessionTtlHours: int('SESSION_TTL_HOURS', 12),
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd,
  chargingSimSpeed: int('CHARGING_SIM_SPEED', 30),
  logLevel: (process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug')) as 'debug' | 'info' | 'warn' | 'error',
  flexia: {
    backend: resolveFlexiaBackend(),
    runtimeArn: process.env.FLEXIA_RUNTIME_ARN?.trim() || null,
    timeoutMs: int('FLEXIA_TIMEOUT_MS', 90_000),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
    model: process.env.FLEXIA_MODEL?.trim() || 'claude-opus-5',
  },
  /** Token público do Mapbox (pk.*). Vazio = mapa com tiles CARTO. Entregue ao front via /meta. */
  mapboxToken: (process.env.MAPBOX_TOKEN?.trim() || '').startsWith('pk.') ? process.env.MAPBOX_TOKEN!.trim() : null,
  /** Contas de demonstração com senha padrão só são aceitas em produção se explicitamente liberadas. */
  demoAccounts: process.env.DEMO_ACCOUNTS === 'true',
  seed: {
    consumerEmail: process.env.SEED_CONSUMER_EMAIL ?? DEFAULT_SEED.consumerEmail,
    consumerPassword: process.env.SEED_CONSUMER_PASSWORD ?? DEFAULT_SEED.consumerPassword,
    managerEmail: process.env.SEED_MANAGER_EMAIL ?? DEFAULT_SEED.managerEmail,
    managerPassword: process.env.SEED_MANAGER_PASSWORD ?? DEFAULT_SEED.managerPassword,
  },
  /** Em desenvolvimento, aceita qualquer origem localhost (o Vite pode subir em porta dinâmica). */
  isAllowedOrigin(origin: string): boolean {
    if ((this.allowedOrigins as readonly string[]).includes(origin)) return true;
    return !isProd && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  },
  /** Fuso do RJ: UTC-3, sem horário de verão desde 2019. */
  tzOffsetHours: -3,
} as const;

/** Falha cedo com mensagem clara quando a configuração de produção é insegura ou incompleta. */
export function validateConfig(): string[] {
  const warnings: string[] = [];
  if (config.isProd) {
    const usesDefaultPasswords =
      config.seed.consumerPassword === DEFAULT_SEED.consumerPassword || config.seed.managerPassword === DEFAULT_SEED.managerPassword;
    if (usesDefaultPasswords && !config.demoAccounts) {
      throw new Error(
        'Produção com senhas de demonstração padrão. Defina SEED_CONSUMER_PASSWORD/SEED_MANAGER_PASSWORD ' +
          'ou, apenas para demonstração ao vivo, DEMO_ACCOUNTS=true.',
      );
    }
    if (usesDefaultPasswords) warnings.push('DEMO_ACCOUNTS=true: contas de demonstração com senha padrão ativas.');
    if (!config.cookieSecure) warnings.push('COOKIE_SECURE=false em produção: use apenas atrás de túnel/HTTPS confiável.');
  }
  if (config.flexia.backend === 'agentcore' && !config.flexia.runtimeArn) {
    throw new Error('FLEXIA_BACKEND=agentcore exige FLEXIA_RUNTIME_ARN.');
  }
  if (config.flexia.backend === 'claude' && !config.flexia.anthropicApiKey) {
    throw new Error('FLEXIA_BACKEND=claude exige ANTHROPIC_API_KEY.');
  }
  if (config.webDist && !fs.existsSync(path.join(config.webDist, 'index.html'))) {
    throw new Error(`WEB_DIST aponta para ${config.webDist}, mas não há index.html (rode o build do frontend).`);
  }
  return warnings;
}
