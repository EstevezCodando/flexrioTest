import { config } from '../config.ts';

/**
 * Logger estruturado (JSON por linha em produção, legível em dev). O formato JSON é o que o
 * CloudWatch Logs/Container Insights indexa sem parser adicional.
 */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[config.logLevel]) return;
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  if (config.isProd) {
    out.write(JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields }) + '\n');
  } else {
    const extra = fields && Object.keys(fields).length ? ' ' + JSON.stringify(fields) : '';
    out.write(`[${level}] ${msg}${extra}\n`);
  }
}

export const log = {
  debug: (msg: string, f?: Record<string, unknown>) => emit('debug', msg, f),
  info: (msg: string, f?: Record<string, unknown>) => emit('info', msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => emit('warn', msg, f),
  error: (msg: string, f?: Record<string, unknown>) => emit('error', msg, f),
};

export function errorFields(err: unknown): Record<string, unknown> {
  if (err instanceof Error) return { error: err.message, errorName: err.name, stack: config.isProd ? undefined : err.stack };
  return { error: String(err) };
}
