import { createApp } from './app.ts';
import { config, validateConfig } from './config.ts';
import { db, run } from './db/index.ts';
import { errorFields, log } from './lib/logger.ts';
import { importProvenanceIfMissing, seedIfEmpty } from './db/seed.ts';
import { evaluateAlerts, evaluateManagerAlerts } from './services/alerts.ts';
import { ingestMarketData } from './services/market.ts';
import { clearPricingCaches } from './services/pricing.ts';
import { setSignalsChangedHook } from './services/signals.ts';
import { refreshActiveConnectors, stationCount } from './services/stations.ts';

for (const w of validateConfig()) log.warn('config', { warning: w });

await seedIfEmpty((m) => log.info(m));
importProvenanceIfMissing((m) => log.info(m));
await ingestMarketData();
refreshActiveConnectors();
setSignalsChangedHook(clearPricingCaches);

/** Jobs em processo. Em produção, mover para um worker/cron dedicado. */
function every(ms: number, name: string, fn: () => unknown) {
  const tick = async () => {
    try {
      await fn();
    } catch (err) {
      log.error('job.failed', { job: name, ...errorFields(err) });
    }
  };
  setInterval(tick, ms).unref();
}
every(15 * 60_000, 'ingest-market', ingestMarketData);
every(60_000, 'alerts', () => {
  const n = evaluateAlerts();
  if (n) log.info('job.alerts', { fired: n });
});
every(60_000, 'manager-alerts', () => {
  const n = evaluateManagerAlerts();
  if (n) log.info('job.manager_alerts', { fired: n });
});
every(60 * 60_000, 'cleanup', () => {
  const now = Math.floor(Date.now() / 1000);
  run('DELETE FROM auth_sessions WHERE expires_at < ?', now);
  run('DELETE FROM notifications WHERE created_at < ? AND read_at IS NOT NULL', now - 60 * 86400);
});
evaluateAlerts();

const server = createApp().listen(config.port, () => {
  log.info('api.started', {
    url: `http://localhost:${config.port}`,
    stations: stationCount(),
    web: config.webDist ? 'servido na mesma origem' : 'não (use o Vite em dev)',
    flexia: config.flexia.backend,
    env: config.isProd ? 'production' : 'development',
  });
});
// Streams longos da FlexIA não podem ser cortados pelo timeout padrão de requisição.
server.requestTimeout = config.flexia.timeoutMs + 30_000;
server.keepAliveTimeout = 65_000; // acima do idle timeout de 60 s do ALB

// Encerramento limpo: para de aceitar conexões, conclui as em andamento e fecha o SQLite (checkpoint do WAL).
let closing = false;
function shutdown(sig: string) {
  if (closing) return;
  closing = true;
  log.info('api.stopping', { signal: sig });
  server.close(() => {
    try {
      db.close();
    } catch {
      /* já fechado */
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => shutdown(sig));
process.on('unhandledRejection', (err) => log.error('unhandledRejection', errorFields(err)));
