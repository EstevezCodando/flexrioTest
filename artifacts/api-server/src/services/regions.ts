import { all } from '../db/index.ts';
import { notFound } from '../lib/http.ts';
import { haversineKm } from '../lib/util.ts';
import type { Submarket } from './market.ts';

export type RegionRow = {
  id: string;
  name: string;
  distributor: string;
  submarket: Submarket;
  lat: number;
  lng: number;
  tusd_kwh: number;
  base_demand_mw: number;
  base_temp_c: number;
};

let cache: Map<string, RegionRow> | null = null;

export function regions(): RegionRow[] {
  cache ??= new Map(all<RegionRow>('SELECT * FROM regions ORDER BY base_demand_mw DESC').map((r) => [r.id, r]));
  return [...cache.values()];
}

export function region(id: string): RegionRow {
  regions();
  const r = cache!.get(id);
  if (!r) throw notFound(`Região "${id}" não encontrada`);
  return r;
}

export function isRegion(id: string): boolean {
  regions();
  return cache!.has(id);
}

export function nearestRegion(lat: number, lng: number): RegionRow {
  return regions().reduce((best, r) =>
    haversineKm(lat, lng, r.lat, r.lng) < haversineKm(lat, lng, best.lat, best.lng) ? r : best,
  );
}
