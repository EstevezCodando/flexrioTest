import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'error',
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg, 'bad_request');
export const notFound = (msg = 'Recurso não encontrado') => new HttpError(404, msg, 'not_found');
export const forbidden = (msg = 'Acesso negado') => new HttpError(403, msg, 'forbidden');
export const unauthorized = (msg = 'Autenticação necessária') => new HttpError(401, msg, 'unauthorized');
export const conflict = (msg: string) => new HttpError(409, msg, 'conflict');

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

/** Express 5 já propaga rejeições; mantemos o wrapper para tipagem uniforme. */
export const handler =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/** Valida e converte entrada com zod; erros viram 400 com detalhes seguros. */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const detail = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || 'entrada'}: ${i.message}`)
      .join('; ');
    throw badRequest(`Dados inválidos — ${detail}`);
  }
  return result.data;
}
