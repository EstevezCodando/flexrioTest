import { randomUUID } from 'node:crypto';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.ts';
import { get } from './db/index.ts';
import { flexiaStatus } from './flexia/agent.ts';
import { notFound } from './lib/http.ts';
import { log } from './lib/logger.ts';
import {
  csrfGuard, errorHandler, globalLimiter, loadUser, requireAuth, requireRole,
} from './middleware/security.ts';
import { authRouter } from './routes/auth.ts';
import { consumerRouter, notificationsRouter } from './routes/consumer.ts';
import { managerRouter } from './routes/manager.ts';
import { catalogRouter, metaRouter } from './routes/public.ts';

const startedAt = Date.now();

/** CSP da API: nada é renderizado a partir de respostas JSON. */
const apiHelmet = helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } });

/**
 * CSP do frontend: só scripts próprios (sem inline), estilos próprios + inline (React/Leaflet usam
 * atributo style), fontes do Google Fonts e tiles do mapa (CARTO). Conexões só para a própria origem.
 */
const webHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://*.basemaps.cartocdn.com', 'https://api.mapbox.com'],
      connectSrc: ["'self'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: config.cookieSecure ? [] : null,
    },
  },
  // HSTS só faz sentido quando o acesso é por HTTPS.
  hsts: config.cookieSecure,
});

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // Correlação: todo request ganha um ID (aceita o do balanceador) devolvido no cabeçalho e nos logs.
  app.use((req, res, next) => {
    const incoming = req.get('x-request-id');
    const id = incoming && /^[\w.-]{8,100}$/.test(incoming) ? incoming : randomUUID();
    res.locals.requestId = id;
    res.set('X-Request-Id', id);
    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      if (!req.path.startsWith('/api/')) return;
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      log[res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'debug']('http', {
        requestId: id, method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms), user: req.user?.id,
      });
    });
    next();
  });

  app.use(compression({
    // Não comprimir streams SSE (a compressão bufferiza e atrasa os tokens da FlexIA).
    filter: (req, res) => !String(res.getHeader('Content-Type') ?? '').includes('text/event-stream') && compression.filter(req, res),
  }));
  // express.json() precisa rodar antes de apiHelmet/globalLimiter: sob o Lambda Function URL
  // (@codegenie/serverless-express), rodar o rate limiter antes do parser de JSON faz o
  // corpo chegar às rotas como Buffer bruto em vez de objeto — mesmo em requests normais,
  // fora do Lambda. Não reproduz com Docker/EC2 (servidor HTTP real), só nesse ambiente.
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', apiHelmet);
  app.use('/api', globalLimiter);
  app.use(cookieParser());

  // CORS restrito às origens configuradas (em dev o Vite faz proxy; em produção front e API são a mesma origem).
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    if (origin && config.isAllowedOrigin(origin)) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        Vary: 'Origin',
      });
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Liveness: o processo responde. Readiness: banco, dados e FlexIA prontos para receber tráfego.
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  app.get('/api/ready', (_req, res) => {
    const checks: Record<string, unknown> = {};
    let ok = true;
    try {
      checks.stations = get<{ n: number }>('SELECT COUNT(*) AS n FROM stations')?.n ?? 0;
      checks.marketHours = get<{ n: number }>('SELECT COUNT(*) AS n FROM market_prices')?.n ?? 0;
      if (!checks.stations || !checks.marketHours) ok = false;
    } catch {
      ok = false;
      checks.database = 'erro';
    }
    checks.flexia = flexiaStatus().engine;
    checks.uptimeS = Math.round((Date.now() - startedAt) / 1000);
    res.status(ok ? 200 : 503).json({ status: ok ? 'ready' : 'not_ready', checks });
  });

  const api = express.Router();
  // Respostas dependem do usuário da sessão: nada de cache por padrão (rotas de catálogo sobrescrevem).
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use(loadUser, csrfGuard);
  api.use('/auth', authRouter);
  api.use('/', metaRouter);
  api.use('/notifications', requireAuth, notificationsRouter);
  api.use('/me', requireRole('consumer'), consumerRouter);
  api.use('/manager', requireRole('manager'), managerRouter);
  api.use('/', requireAuth, catalogRouter);
  app.use('/api/v1', api);
  app.use('/api', (_req, _res, next) => next(notFound('Rota não encontrada')));

  // Frontend na mesma origem: dispensa CDN/API Gateway e mantém o cookie SameSite=Strict funcionando.
  if (config.webDist) {
    const dist = config.webDist;
    app.use(webHelmet);
    app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', index: false }));
    app.use(express.static(dist, {
      index: false,
      setHeaders: (res, file) => {
        // sw.js e index.html sempre revalidados, para que novas versões cheguem na hora.
        if (file.endsWith('sw.js') || file.endsWith('.html') || file.endsWith('.webmanifest')) res.set('Cache-Control', 'no-cache');
      },
    }));
    // Fallback da SPA: qualquer GET que não seja API nem arquivo devolve o index.html.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use((_req, _res, next) => next(notFound('Rota não encontrada')));
  app.use(errorHandler);
  return app;
}
