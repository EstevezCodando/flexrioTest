import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.ts';
import { notFound } from './lib/http.ts';
import {
  csrfGuard, errorHandler, globalLimiter, loadUser, requireAuth, requireRole,
} from './middleware/security.ts';
import { authRouter } from './routes/auth.ts';
import { consumerRouter, notificationsRouter } from './routes/consumer.ts';
import { managerRouter } from './routes/manager.ts';
import { catalogRouter, metaRouter } from './routes/public.ts';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Atrás de proxy reverso (Vercel/NGINX), confiar no primeiro salto para obter o IP real.
  app.set('trust proxy', config.isProd ? 1 : false);

  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  app.use(compression());
  app.use(globalLimiter);
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());

  // CORS restrito às origens configuradas (em dev o Vite faz proxy e a origem é a mesma).
  app.use((req, res, next) => {
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

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

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

  app.use((_req, _res, next) => next(notFound('Rota não encontrada')));
  app.use(errorHandler);
  return app;
}
