export type Vehicle = {
  manufacturer: string;
  model: string;
  batteryCapacityKwh: number;
  currentSoc: number;
  targetSoc: number;
  connector: string;
  maxDcPowerKw: number;
  estimatedRangeKm: number;
};

export type CarOption = {
  model: string;
  mfg: string;
  battery: number;
  dc: number;
  range: number;
};
