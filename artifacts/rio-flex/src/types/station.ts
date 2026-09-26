export type ConnectorType = 'CCS2' | 'Type2' | 'CHAdeMO';

export type StationSpecs = {
  maxPowerKw: number;
  network: string;
  parking: string;
  amenities: string[];
  description: string;
};

export type StationConnector = {
  type: ConnectorType;
  powerKw: number;
  available: boolean;
};

export type StationIncentive = {
  label: string;
  value: number;
};

export type ChargingStation = {
  id: string;
  name: string;
  operator: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  etaMinutes: number;
  pricePerKwh: number;
  availableConnectors: number;
  totalConnectors: number;
  connectors: StationConnector[];
  renewableShare: number;
  estimatedQueueMinutes: number;
  incentive?: StationIncentive;
  score: number;
  specs: StationSpecs;
};
