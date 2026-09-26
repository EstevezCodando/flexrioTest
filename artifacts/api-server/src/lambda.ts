import serverlessExpress from '@codegenie/serverless-express';
import { createApp } from './app.ts';
import { validateConfig } from './config.ts';
import { importProvenanceIfMissing, seedIfEmpty } from './db/seed.ts';
import { log } from './lib/logger.ts';
import { ingestMarketData } from './services/market.ts';
import { refreshActiveConnectors } from './services/stations.ts';

// Handler para AWS Lambda Function URL. Empacotado como CommonJS (build:lambda) porque
// @codegenie/serverless-express usa require() internamente, o que quebra em bundle ESM
// ("Dynamic require of ... is not supported").
//
// Esta função Lambda serve só a API (config.webDist fica null: o build do frontend não é
// copiado para este pacote). O frontend é publicado separadamente em outra origem (S3), e
// ALLOWED_ORIGINS + os cookies de sessão (sameSite=none quando COOKIE_SECURE=true) cobrem
// esse cenário cross-origin — ver src/app.ts e src/routes/auth.ts.
//
// Diferente de index.ts (processo de longa duração no EC2/Docker): aqui rodamos só a
// preparação de uma vez por ambiente de execução do Lambda (seed do banco, proveniência,
// primeira carga de preços de mercado) — sem os jobs periódicos via setInterval, que não
// fazem sentido no modelo de execução por invocação do Lambda.
for (const w of validateConfig()) log.warn('config', { warning: w });

const ready = (async () => {
  await seedIfEmpty((m) => log.info(m));
  importProvenanceIfMissing((m) => log.info(m));
  await ingestMarketData();
  refreshActiveConnectors();
})();

const expressHandler = serverlessExpress({ app: createApp() });

export const handler = async (event: unknown, context: unknown, callback: unknown) => {
  await ready;
  // @ts-expect-error — repassa os args do Lambda direto para o handler do serverless-express.
  return expressHandler(event, context, callback);
};
