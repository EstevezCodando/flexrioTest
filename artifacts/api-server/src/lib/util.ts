import { config } from '../config.ts';

/** Hash FNV-1a 32 bits → número determinístico em [0, 1). Base de todo o mock reprodutível. */
export function noise(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // mistura final (avalanche)
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export const HOUR = 3600;

export function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

/** Início da hora (UTC epoch) que contém `epoch`. */
export function hourStart(epoch: number): number {
  return epoch - (epoch % HOUR);
}

/** Hora local do RJ (0–23) para um epoch. */
export function localHour(epoch: number): number {
  return new Date((epoch + config.tzOffsetHours * HOUR) * 1000).getUTCHours();
}

/** Data local AAAA-MM-DD, usada como semente diária. */
export function localDay(epoch: number): string {
  return new Date((epoch + config.tzOffsetHours * HOUR) * 1000).toISOString().slice(0, 10);
}

export function dayOfYear(epoch: number): number {
  const d = new Date((epoch + config.tzOffsetHours * HOUR) * 1000);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86_400_000);
}

export function isoLocal(epoch: number): string {
  const d = new Date((epoch + config.tzOffsetHours * HOUR) * 1000);
  return d.toISOString().replace('Z', '-03:00').replace('.000', '');
}

export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
