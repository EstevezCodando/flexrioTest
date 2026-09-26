import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { config } from '../config.ts';
import { forbidden, HttpError, unauthorized } from '../lib/http.ts';
import { errorFields, log } from '../lib/logger.ts';
import { toPublicUser, userFromToken, type PublicUser, type Role } from '../services/auth.ts';

export const SESSION_COOKIE = 'rf_session';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: PublicUser;
      sessionToken?: string;
    }
  }
}

/** Resolve o usuário a partir do cookie httpOnly de sessão (token opaco, só o hash fica no banco). */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === 'string' && token.length >= 20 && token.length <= 100) {
    const u = await userFromToken(token);
    if (u) {
      req.user = toPublicUser(u);
      req.sessionToken = token;
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

export const requireRole =
  (role: Role) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role !== role) return next(forbidden('Seu perfil não tem acesso a este recurso'));
    next();
  };

/**
 * Proteção CSRF em camadas para requisições que alteram estado:
 *  1) cookie SameSite=Strict;
 *  2) cabeçalho customizado obrigatório (formulários cross-site não conseguem enviá-lo sem preflight CORS);
 *  3) se houver Origin, ele precisa estar na lista permitida.
 */
/** Front e API servidos pelo mesmo host (produção): a origem do navegador é o próprio host. */
function sameHost(origin: string, host: string | undefined): boolean {
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'RioFlex') return next(forbidden('Requisição sem cabeçalho de origem da aplicação'));
  const origin = req.get('origin');
  if (origin && !config.isAllowedOrigin(origin) && !sameHost(origin, req.get('host'))) return next(forbidden('Origem não permitida'));
  next();
}

export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Muitas requisições. Aguarde um instante.' } },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Muitas tentativas de login. Tente em alguns minutos.' } },
});

export const flexiaLimiter = rateLimit({
  windowMs: 60_000,
  limit: 15,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? '0.0.0.0'),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Limite de perguntas à FlexIA por minuto atingido.' } },
});

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  // JSON malformado ou corpo grande demais (body-parser)
  const status = typeof err?.status === 'number' ? err.status : 500;
  if (status >= 400 && status < 500) {
    res.status(status).json({ error: { code: 'bad_request', message: 'Requisição inválida' } });
    return;
  }
  log.error('http.unhandled', { method: req.method, path: req.path, requestId: res.locals.requestId, ...errorFields(err) });
  res.status(500).json({ error: { code: 'internal', message: 'Erro interno. Tente novamente.' } });
};
