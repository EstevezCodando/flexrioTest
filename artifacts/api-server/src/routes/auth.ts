import { Router, type Response } from 'express';
import { z } from 'zod';
import { config } from '../config.ts';
import { handler, parse } from '../lib/http.ts';
import { loginLimiter, requireAuth, SESSION_COOKIE } from '../middleware/security.ts';
import { login, logout, registerConsumer, updateProfile } from '../services/auth.ts';
import { isRegion } from '../services/regions.ts';

const email = z.string().trim().toLowerCase().email().max(120);

export const vehicleSchema = z.object({
  manufacturer: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(60),
  batteryKwh: z.number().min(10).max(250),
  soc: z.number().min(0).max(100),
  targetSoc: z.number().min(20).max(100),
  connector: z.string().trim().min(2).max(20),
  maxDcKw: z.number().min(0).max(400),
  maxAcKw: z.number().min(0).max(43),
  rangeKm: z.number().min(0).max(1200),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
  portal: z.enum(['consumer', 'manager']),
});

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password: z
    .string()
    .min(10, 'mínimo de 10 caracteres')
    .max(200)
    .regex(/[A-Za-z]/, 'inclua letras')
    .regex(/\d/, 'inclua números'),
  regionId: z.string().refine(isRegion, 'região inválida'),
  vehicle: vehicleSchema.optional(),
});

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    // SameSite=None exige Secure=true. Front (S3) e API (Lambda Function URL)
    // são origens diferentes nesta implantação, então em produção (HTTPS)
    // o cookie precisa ser enviado cross-site; em dev (HTTP local, mesma
    // origem via proxy do Vite) 'strict' continua correto e mais seguro.
    sameSite: config.cookieSecure ? 'none' : 'strict',
    path: '/api',
    maxAge: config.sessionTtlHours * 3600 * 1000,
  });
}

export const authRouter = Router();

authRouter.post('/login', loginLimiter, handler(async (req, res) => {
  const body = parse(loginSchema, req.body);
  const { token, user } = await login(body.email, body.password, body.portal, req.ip, req.get('user-agent'));
  setSessionCookie(res, token);
  res.json({ user });
}));

authRouter.post('/register', loginLimiter, handler(async (req, res) => {
  const body = parse(registerSchema, req.body);
  const { token, user } = await registerConsumer(body, req.ip);
  setSessionCookie(res, token);
  res.status(201).json({ user });
}));

authRouter.post('/logout', handler(async (req, res) => {
  if (req.sessionToken) await logout(req.sessionToken);
  res.clearCookie(SESSION_COOKIE, { path: '/api' });
  res.status(204).end();
}));

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.patch('/me', requireAuth, handler((req, res) => {
  const body = parse(
    z.object({
      name: z.string().trim().min(2).max(80).optional(),
      regionId: z.string().refine(isRegion, 'região inválida').optional(),
      vehicle: vehicleSchema.optional(),
    }),
    req.body,
  );
  res.json({ user: updateProfile(req.user!.id, body) });
}));
