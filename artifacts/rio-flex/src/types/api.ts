/** Tipos dos contratos da API Rio Flex (espelham os DTOs do backend). */

export type Role = 'consumer' | 'manager';
export type ChargeType = 'ac_lenta' | 'ac_semirrapida' | 'dc_rapida' | 'dc_ultrarrapida';
export type SignalLevel = 'verde' | 'amarelo' | 'vermelho';

export type Vehicle = {
  manufacturer: string;
  model: string;
  batteryKwh: number;
  soc: number;
  targetSoc: number;
  connector: string;
  maxDcKw: number;
  maxAcKw: number;
  rangeKm: number;
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  regionId: string | null;
  vehicle: Vehicle | null;
};

export type RegionMeta = { id: string; name: string; distributor: string; submarket: string; lat: number; lng: number };

export type Meta = {
  chargeTypes: { id: ChargeType; label: string; description: string; marginKwh: number; typicalKw: number }[];
  signalLevels: { id: SignalLevel; label: string; multiplier: number; creditBonusKwh: number }[];
  regions: RegionMeta[];
  dataset: { snapshot: string; source: string; stats: StationsStats };
};

export type StationsStats = {
  stations: number;
  publicStations: number;
  maintenance: number;
  inactiveOrConstruction: number;
  connectors: number;
  connectorsByChargeType: Record<ChargeType, number>;
  dcStations: number;
  publishedPrices: { count: number; min: number | null; median: number | null; max: number | null };
  priceConflicts: number;
};

export type StationStatus = 'operacional' | 'manutencao' | 'inativa' | 'em_obra';

export type StationSummary = {
  id: number;
  name: string;
  city: string | null;
  regionId: string;
  address: string | null;
  lat: number;
  lng: number;
  isPublic: boolean;
  access: string | null;
  status: StationStatus;
  network: string | null;
  placeType: string | null;
  maxPowerKw: number | null;
  chargeTypes: ChargeType[];
  connectorTypes: string[];
  connectors: { total: number; available: number };
  publishedPriceKwh: number | null;
  activationFee: number | null;
  priceConflict: boolean;
  prices: Partial<Record<ChargeType, number>>;
  cheapest: { chargeType: ChargeType; priceKwh: number };
  signalLevel: SignalLevel;
  distanceKm: number | null;
  score: number;
};

export type StationMarker = { id: number; lat: number; lng: number; n: string; dc: boolean; st: StationStatus; av: number; tot: number; pub: boolean };

export type Signal = {
  level: SignalLevel;
  source: 'automatico' | 'gestor';
  signalId?: string;
  title?: string;
  multiplier: number;
  creditBonusKwh: number;
};

export type StationDetail = StationSummary & {
  regionName: string;
  distributor: string;
  openingHours: string | null;
  priceLabel: string | null;
  sourceUrl: string | null;
  snapshotId: string;
  updatedAt: string | null;
  quality: { code: string; note: string | null }[];
  connectorsDetail: {
    id: number;
    evseId: number;
    type: string;
    current: 'AC' | 'DC';
    powerKw: number;
    powerKnown: boolean;
    chargeType: ChargeType;
    chargeTypeLabel: string;
    status: 'disponivel' | 'ocupado' | 'indisponivel';
    priceKwh: number;
  }[];
  energyNow: {
    pldMwh: number;
    tariffPost: string;
    supplier: string;
    product: string;
    breakdown: { energiaKwh: number; fioKwh: number; encargosKwh: number; tributosKwh: number; custoEnergiaKwh: number };
    signal: Signal;
    regionalLoadPct: number;
  };
  forecast: { localTime: string; localHour: number; level: SignalLevel; prices: Partial<Record<ChargeType, number>> }[];
};

export type Offer = {
  supplierId: string;
  supplierName: string;
  product: string;
  energyKwh: number;
  wireKwh: number;
  chargesKwh: number;
  taxesKwh: number;
  totalKwh: number;
};

export type SignalDto = {
  id: string;
  regionId: string;
  level: SignalLevel;
  startsAt: string;
  endsAt: string;
  status: 'agendado' | 'ativo' | 'encerrado';
  multiplier: number;
  creditBonusKwh: number;
  title: string;
  message: string;
  createdAt: string;
};

export type PriceNow = {
  region: { id: string; name: string; distributor: string; submarket: string };
  hourEpoch: number;
  localTime: string;
  localHour: number;
  pldMwh: number;
  tariffPost: 'ponta' | 'intermediario' | 'fora_ponta';
  best: Offer;
  signal: Signal;
  consumerPrices: Record<ChargeType, number>;
  offers: Offer[];
  chargeTypes: { id: ChargeType; label: string; description: string; typicalKw: number; priceKwh: number }[];
  bestWindows: { startsAt: string; startHour: number; endHour: number; avgPriceKwh: number; level: SignalLevel }[];
  activeSignals: SignalDto[];
  disclaimer: string;
};

export type ForecastPoint = {
  localTime: string;
  localHour: number;
  pldMwh: number;
  tariffPost: string;
  energyCostKwh: number;
  supplier: string;
  level: SignalLevel;
  signalSource: string;
  consumerPrices: Record<ChargeType, number>;
};

export type RegionPrice = { regionId: string; regionName: string; level: SignalLevel; energyCostKwh: number; supplier: string; consumerPrices: Record<ChargeType, number> };

export type Alert = {
  id: string;
  regionId: string;
  regionName: string;
  stationId: number | null;
  stationName: string | null;
  chargeType: ChargeType;
  chargeTypeLabel: string;
  maxPriceKwh: number | null;
  notifyGreenWindow: boolean;
  active: boolean;
  lastTriggeredAt: string | null;
  currentPriceKwh: number;
  currentLevel: SignalLevel;
};

export type Notification = { id: string; kind: string; title: string; body: string; data: Record<string, unknown> | null; createdAt: string; read: boolean };

export type ChargingSession = {
  id: string;
  status: 'active' | 'completed' | 'cancelled';
  station: { id: number; name: string; address: string | null; regionId: string };
  connector: { id: number; type: string; current: 'AC' | 'DC'; chargeType: ChargeType; chargeTypeLabel: string } | null;
  startedAt: string;
  endedAt: string | null;
  startSoc: number;
  targetSoc: number;
  soc: number;
  powerKw: number;
  priceKwh: number;
  signalLevel: SignalLevel;
  flexAccepted: boolean;
  energyKwh: number;
  cost: number;
  credits: number;
  elapsedMin: number;
  remainingMin: number;
  readyToFinish: boolean;
  flexOffer: { reducedPowerKw: number; bonus: number; reason: string } | null;
};

export type Wallet = {
  balance: number;
  credits: number;
  stats: { sessions: number; energyKwh: number; flexibleEnergyKwh: number; totalSpent: number; flexEventsAccepted: number; co2AvoidedKg: number };
  ledger: { id: string; amount: number; type: 'credit' | 'debit'; description: string; createdAt: string }[];
};

export type ManagerOverview = {
  generatedAt: string;
  totals: StationsStats & { consumers: number; activeAlerts: number; activeSessions: number; sessions7d: number; energy7dKwh: number; flexEvents7d: number };
  regions: {
    regionId: string;
    regionName: string;
    level: SignalLevel;
    signalSource: string;
    energyCostKwh: number;
    dcPriceKwh: number;
    demandMw: number;
    loadFactorPct: number;
    evLoadMw: number;
    busyConnectors: number;
    totalConnectors: number;
    stations: number;
    maintenance: number;
  }[];
  signals: SignalDto[];
};

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

export type WeatherPoint = {
  localTime: string;
  localHour: number;
  temperatureC: number;
  cloudCoverPct: number;
  irradianceWm2: number;
  rainProbabilityPct: number;
  windKmh: number;
  condition: string;
};

export type SignalProposal = {
  regionId: string;
  regionName: string;
  level: SignalLevel;
  startsAt: string;
  endsAt: string;
  title: string;
  message: string;
};

export type FlexiaMessage = {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  meta?: { engine: 'claude' | 'local'; toolsUsed: string[]; proposal?: SignalProposal; note?: string } | null;
  createdAt?: string;
};

export type KnowledgeEntry = { id: string; category: string; title: string; authority: string; summary: string; relevance: string; tags: string[]; reference: string };
