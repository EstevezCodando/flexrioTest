import type { Vehicle } from '@/types/api';

/** Catálogo de modelos populares no Brasil (valores aproximados de ficha técnica). */
export type CarOption = { model: string; mfg: string; battery: number; dc: number; ac: number; range: number };

export const carOptions: CarOption[] = [
  { model: 'Dolphin GS', mfg: 'BYD', battery: 44.9, dc: 80, ac: 7, range: 210 },
  { model: 'Dolphin Mini', mfg: 'BYD', battery: 38, dc: 40, ac: 6.6, range: 180 },
  { model: 'Ora 03 Skin', mfg: 'GWM', battery: 48, dc: 64, ac: 6.6, range: 230 },
  { model: 'EX30 Core', mfg: 'Volvo', battery: 51, dc: 134, ac: 11, range: 260 },
  { model: 'Kwid E-Tech', mfg: 'Renault', battery: 26.8, dc: 30, ac: 7, range: 140 },
  { model: 'Seal', mfg: 'BYD', battery: 82.5, dc: 150, ac: 11, range: 370 },
];

export function toVehicle(c: CarOption, soc: number, targetSoc = 80): Vehicle {
  return {
    manufacturer: c.mfg,
    model: c.model,
    batteryKwh: c.battery,
    soc,
    targetSoc,
    connector: 'CCS2',
    maxDcKw: c.dc,
    maxAcKw: c.ac,
    rangeKm: Math.round((c.range * soc) / 100),
  };
}
