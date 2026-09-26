import type { CarOption, Vehicle } from '@/types/vehicle';

export const initialVehicle: Vehicle = {
  manufacturer: 'BYD',
  model: 'Dolphin GS',
  batteryCapacityKwh: 44.9,
  currentSoc: 62,
  targetSoc: 80,
  connector: 'CCS2',
  maxDcPowerKw: 80,
  estimatedRangeKm: 210,
};

export const carOptions: CarOption[] = [
  { model: 'Dolphin GS', mfg: 'BYD', battery: 44.9, dc: 80, range: 210 },
  { model: 'Ora 03 Skin', mfg: 'GWM', battery: 48.0, dc: 64, range: 230 },
  { model: 'EX30 Core', mfg: 'Volvo', battery: 51.0, dc: 134, range: 260 },
  { model: 'Kwid E-Tech', mfg: 'Renault', battery: 26.8, dc: 30, range: 140 },
];
