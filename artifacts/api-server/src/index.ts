import { createApp } from './app.ts';
import { config } from './config.ts';
import { run } from './db/index.ts';
import { importProvenanceIfMissing, seedIfEmpty } from './db/seed.ts';
import { evaluateAlerts, evaluateManagerAlerts } from './services/alerts.ts';
import { ingestMarketData } from './services/market.ts';
import { clearPricingCaches } from './services/pricing.ts';
import { setSignalsChangedHook } from './services/signals.ts';
import { refreshActiveConnectors, stationCount } from './services/stations.ts';

await seedIfEmpty();
importProvenanceIfMissing();
await ingestMarketData();
refreshActiveConnectors();
setSignalsChangedHook(clearPricingCaches);

/** Jobs em processo. Em produção, mover para um worker/cron dedicado. */
function every(ms: number, name: string, fn: () => unknown) {
  const tick = async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[job:${name}]`, err);
    }
  };
  setInterval(tick, ms).unref();
}
every(15 * 60_000, 'ingest-market', ingestMarketData);
every(60_000, 'alerts', () => {
  const n = evaluateAlerts();
  if (n) console.log(`[job:alerts] ${n} alerta(s) disparado(s)`);
});
every(60_000, 'manager-alerts', () => {
  const n = evaluateManagerAlerts();
  if (n) console.log(`[job:manager-alerts] ${n} alerta(s) operacional(is) para gestores`);
});
every(60 * 60_000, 'cleanup', () => {
  const now = Math.floor(Date.now() / 1000);
  run('DELETE FROM auth_sessions WHERE expires_at < ?', now);
  run('DELETE FROM notifications WHERE created_at < ? AND read_at IS NOT NULL', now - 60 * 86400);
});
evaluateAlerts();

const server = createApp().listen(config.port, () => {
  console.log(`[api] Rio Flex API em http://localhost:${config.port}/api/v1 — ${stationCount()} estações carregadas`);
  console.log(`[api] FlexIA: ${config.anthropicApiKey ? `Claude (${config.flexiaModel})` : 'motor local (sem ANTHROPIC_API_KEY)'}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
