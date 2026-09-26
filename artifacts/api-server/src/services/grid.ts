import { HOUR, hourStart, isoLocal, localDay, localHour, noise, nowEpoch, round } from '../lib/util.ts';
import { region, type RegionRow } from './regions.ts';

/**
 * Mock de operação da rede e clima. Estrutura pronta para ser alimentada por:
 *  - ONS (carga e geração por fonte do subsistema SE/CO)
 *  - INMET / modelos numéricos (temperatura, irradiância, chuva, vento)
 *  - distribuidora (carga por região/alimentador)
 */

export type WeatherPoint = {
  localTime: string;
  localHour: number;
  temperatureC: number;
  cloudCoverPct: number;
  irradianceWm2: number;
  rainProbabilityPct: number;
  windKmh: number;
  condition: 'ensolarado' | 'parcialmente nublado' | 'nublado' | 'chuva';
};

export function weatherAt(reg: RegionRow, t: number): WeatherPoint {
  const h = localHour(t);
  const day = localDay(t);
  const dayCloud = noise(`cloud-${reg.id}-${day}`);
  const cloud = Math.min(100, Math.max(0, dayCloud * 80 + (noise(`cloud-${reg.id}-${t}`) - 0.5) * 30));
  const sun = Math.max(0, Math.sin((Math.PI * (h - 6)) / 12.5));
  const dayTempShift = (noise(`temp-${reg.id}-${day}`) - 0.5) * 5;
  const temp = reg.base_temp_c + dayTempShift + 4.5 * Math.sin((Math.PI * (h - 9)) / 12) - (cloud / 100) * 2;
  const rain = Math.max(0, cloud - 45) * 1.6 * (0.6 + 0.4 * noise(`rain-${reg.id}-${t}`));
  const condition: WeatherPoint['condition'] =
    rain > 55 ? 'chuva' : cloud > 70 ? 'nublado' : cloud > 35 ? 'parcialmente nublado' : 'ensolarado';
  return {
    localTime: isoLocal(t),
    localHour: h,
    temperatureC: round(temp, 1),
    cloudCoverPct: Math.round(cloud),
    irradianceWm2: Math.round(1000 * sun * (1 - 0.72 * (cloud / 100))),
    rainProbabilityPct: Math.min(100, Math.round(rain)),
    windKmh: round(8 + 18 * noise(`wind-${reg.id}-${t}`), 1),
    condition,
  };
}

const LOAD_PROFILE = [
  0.66, 0.62, 0.6, 0.59, 0.6, 0.64, 0.72, 0.8, 0.86, 0.9, 0.92, 0.94,
  0.95, 0.95, 0.96, 0.95, 0.94, 0.96, 1.0, 1.0, 0.97, 0.9, 0.8, 0.72,
];

export type GridPoint = {
  localTime: string;
  localHour: number;
  regionalDemandMw: number;
  regionalCapacityMw: number;
  loadFactorPct: number;
  submarket: {
    demandGw: number;
    generationGw: { hidraulica: number; solar: number; eolica: number; termica: number; nuclear: number };
    renewableSharePct: number;
  };
};

export function gridAt(reg: RegionRow, t: number): GridPoint {
  const h = localHour(t);
  const w = weatherAt(reg, t);
  // Cada grau acima de 24 °C eleva a carga (ar-condicionado).
  const tempFactor = 1 + 0.014 * Math.max(0, w.temperatureC - 24);
  const demand = reg.base_demand_mw * LOAD_PROFILE[h] * tempFactor * (0.97 + 0.06 * noise(`dem-${reg.id}-${t}`));
  const capacity = reg.base_demand_mw * 1.18;

  // Subsistema SE/CO (GW) — ordem de grandeza realista, valores mock.
  const seDemand = 46 * LOAD_PROFILE[h] * (0.97 + 0.05 * noise(`se-${t}`));
  const solar = Math.max(0, 15.5 * Math.sin((Math.PI * (h - 6)) / 12.5)) * (1 - 0.5 * (w.cloudCoverPct / 100));
  const wind = 1.8 + 2.4 * noise(`se-wind-${t}`);
  const nuclear = 1.99;
  const thermal = Math.max(3, 4 + (LOAD_PROFILE[h] > 0.95 ? 5 : 0) + 2 * noise(`se-term-${localDay(t)}`));
  const hydro = Math.max(10, seDemand - solar - wind - nuclear - thermal);
  const total = hydro + solar + wind + nuclear + thermal;

  return {
    localTime: isoLocal(t),
    localHour: h,
    regionalDemandMw: Math.round(demand),
    regionalCapacityMw: Math.round(capacity),
    loadFactorPct: round((demand / capacity) * 100, 1),
    submarket: {
      demandGw: round(seDemand, 2),
      generationGw: {
        hidraulica: round(hydro, 2),
        solar: round(solar, 2),
        eolica: round(wind, 2),
        termica: round(thermal, 2),
        nuclear,
      },
      renewableSharePct: round(((hydro + solar + wind) / total) * 100, 1),
    },
  };
}

export function gridSeries(regionId: string, hours: number, from = nowEpoch()) {
  const reg = region(regionId);
  return Array.from({ length: hours }, (_, i) => gridAt(reg, hourStart(from) + i * HOUR));
}

export function weatherSeries(regionId: string, hours: number, from = nowEpoch()) {
  const reg = region(regionId);
  return Array.from({ length: hours }, (_, i) => weatherAt(reg, hourStart(from) + i * HOUR));
}
