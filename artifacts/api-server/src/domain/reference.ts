/**
 * Dados de referência do mock. Valores ILUSTRATIVOS — não são tarifas homologadas.
 * A estrutura foi pensada para ser substituída por fontes reais (ANEEL, CCEE, ONS, INMET).
 */

export type Region = {
  id: string;
  name: string;
  distributor: string;
  submarket: 'SE' | 'S' | 'NE' | 'N';
  lat: number;
  lng: number;
  /** Componente fio (TUSD) mock em R$/kWh, fora de ponta. */
  tusdKwh: number;
  baseDemandMw: number;
  baseTempC: number;
  municipalities: string[];
};

export const REGIONS: Region[] = [
  {
    id: 'capital', name: 'Rio de Janeiro (Capital)', distributor: 'Light (ilustrativo)', submarket: 'SE',
    lat: -22.9068, lng: -43.1729, tusdKwh: 0.42, baseDemandMw: 5200, baseTempC: 25,
    municipalities: ['rio de janeiro'],
  },
  {
    id: 'baixada', name: 'Baixada Fluminense', distributor: 'Light (ilustrativo)', submarket: 'SE',
    lat: -22.759, lng: -43.451, tusdKwh: 0.44, baseDemandMw: 1600, baseTempC: 26,
    municipalities: ['duque de caxias', 'nova iguaçu', 'são joão de meriti', 'belford roxo', 'nilópolis', 'mesquita', 'queimados', 'japeri', 'magé', 'guapimirim', 'seropédica', 'paracambi', 'itaguaí'],
  },
  {
    id: 'leste', name: 'Leste Metropolitano', distributor: 'Enel RJ (ilustrativo)', submarket: 'SE',
    lat: -22.8832, lng: -43.1034, tusdKwh: 0.47, baseDemandMw: 1300, baseTempC: 25,
    municipalities: ['niterói', 'são gonçalo', 'itaboraí', 'maricá', 'tanguá', 'rio bonito'],
  },
  {
    id: 'lagos', name: 'Região dos Lagos', distributor: 'Enel RJ (ilustrativo)', submarket: 'SE',
    lat: -22.8894, lng: -42.0286, tusdKwh: 0.49, baseDemandMw: 620, baseTempC: 24,
    municipalities: ['cabo frio', 'búzios', 'armação dos búzios', 'arraial do cabo', 'são pedro da aldeia', 'saquarema', 'araruama', 'iguaba grande', 'silva jardim', 'casimiro de abreu', 'rio das ostras'],
  },
  {
    id: 'serra', name: 'Região Serrana', distributor: 'Enel RJ (ilustrativo)', submarket: 'SE',
    lat: -22.5112, lng: -43.1779, tusdKwh: 0.46, baseDemandMw: 480, baseTempC: 18,
    municipalities: ['petrópolis', 'teresópolis', 'nova friburgo', 'cordeiro', 'cantagalo', 'carmo', 'sumidouro', 'bom jardim', 'duas barras', 'são josé do vale do rio preto', 'macuco', 'santa maria madalena', 'trajano de moraes'],
  },
  {
    id: 'costa-verde', name: 'Costa Verde', distributor: 'Enel RJ (ilustrativo)', submarket: 'SE',
    lat: -23.0067, lng: -44.318, tusdKwh: 0.5, baseDemandMw: 320, baseTempC: 24,
    municipalities: ['angra dos reis', 'paraty', 'mangaratiba'],
  },
  {
    id: 'medio-paraiba', name: 'Médio Paraíba', distributor: 'Light (ilustrativo)', submarket: 'SE',
    lat: -22.5231, lng: -44.1042, tusdKwh: 0.43, baseDemandMw: 900, baseTempC: 22,
    municipalities: ['volta redonda', 'barra mansa', 'resende', 'itatiaia', 'porto real', 'quatis', 'pinheiral', 'piraí', 'barra do piraí', 'valença', 'rio claro', 'rio das flores'],
  },
  {
    id: 'centro-sul', name: 'Centro-Sul Fluminense', distributor: 'Light (ilustrativo)', submarket: 'SE',
    lat: -22.4056, lng: -43.6636, tusdKwh: 0.45, baseDemandMw: 260, baseTempC: 21,
    municipalities: ['vassouras', 'miguel pereira', 'paty do alferes', 'mendes', 'engenheiro paulo de frontin', 'paraíba do sul', 'três rios', 'sapucaia', 'areal', 'comendador levy gasparian'],
  },
  {
    id: 'norte', name: 'Norte Fluminense', distributor: 'Enel RJ (ilustrativo)', submarket: 'SE',
    lat: -22.3708, lng: -41.7869, tusdKwh: 0.48, baseDemandMw: 720, baseTempC: 25,
    municipalities: ['macaé', 'campos dos goytacazes', 'são joão da barra', 'são francisco de itabapoana', 'carapebus', 'quissamã', 'conceição de macabu', 'cardoso moreira', 'são fidélis'],
  },
  {
    id: 'noroeste', name: 'Noroeste Fluminense', distributor: 'Enel RJ (ilustrativo)', submarket: 'SE',
    lat: -21.2066, lng: -41.8878, tusdKwh: 0.51, baseDemandMw: 190, baseTempC: 25,
    municipalities: ['itaperuna', 'santo antônio de pádua', 'bom jesus do itabapoana', 'miracema', 'natividade', 'porciúncula', 'varre-sai', 'laje do muriaé', 'italva', 'cambuci', 'aperibé', 'são josé de ubá'],
  },
];

/**
 * Comercializadoras FICTÍCIAS do mercado livre, usadas para demonstrar a busca do
 * melhor preço por região. Produtos: convencional ou incentivada (desconto na TUSD).
 */
export type SupplierSeed = {
  id: string;
  name: string;
  product: 'convencional' | 'incentivada_50' | 'incentivada_100';
  spreadKwh: number;
  tusdDiscount: number;
  peakPremiumKwh: number;
  window: [number, number] | null; // janela de horas locais [início, fim) em que a oferta vale
  regions: string[] | null; // null = todas
};

export const SUPPLIERS: SupplierSeed[] = [
  { id: 'alfa', name: 'Alfa Comercializadora (fictícia)', product: 'convencional', spreadKwh: 0.045, tusdDiscount: 0, peakPremiumKwh: 0, window: null, regions: null },
  { id: 'brisa', name: 'Brisa Renováveis (fictícia)', product: 'incentivada_50', spreadKwh: 0.088, tusdDiscount: 0.5, peakPremiumKwh: 0.02, window: null, regions: null },
  { id: 'solcarioca', name: 'Sol Carioca Energia (fictícia)', product: 'incentivada_100', spreadKwh: 0.115, tusdDiscount: 1, peakPremiumKwh: 0, window: [9, 16], regions: null },
  { id: 'guanabara', name: 'Guanabara Trading (fictícia)', product: 'convencional', spreadKwh: 0.028, tusdDiscount: 0, peakPremiumKwh: 0.09, window: null, regions: ['capital', 'baixada', 'leste'] },
  { id: 'serraverde', name: 'Serra Verde Energia (fictícia)', product: 'incentivada_50', spreadKwh: 0.072, tusdDiscount: 0.5, peakPremiumKwh: 0.03, window: null, regions: ['serra', 'centro-sul', 'medio-paraiba', 'noroeste', 'norte'] },
];

export const CHARGE_TYPES = ['ac_lenta', 'ac_semirrapida', 'dc_rapida', 'dc_ultrarrapida'] as const;
export type ChargeType = (typeof CHARGE_TYPES)[number];

export const CHARGE_TYPE_INFO: Record<ChargeType, { label: string; description: string; marginKwh: number; typicalKw: number }> = {
  ac_lenta: { label: 'AC lenta', description: 'Corrente alternada até 7,4 kW (wallbox, Tipo 2/J-1772)', marginKwh: 0.7, typicalKw: 7 },
  ac_semirrapida: { label: 'AC semirrápida', description: 'Corrente alternada de 7,4 a 22 kW (Tipo 2 trifásico)', marginKwh: 0.9, typicalKw: 22 },
  dc_rapida: { label: 'DC rápida', description: 'Corrente contínua até 100 kW (CCS2, CHAdeMO, GB/T)', marginKwh: 1.3, typicalKw: 60 },
  dc_ultrarrapida: { label: 'DC ultrarrápida', description: 'Corrente contínua acima de 100 kW (CCS2)', marginKwh: 1.6, typicalKw: 150 },
};

export const SIGNAL_LEVELS = ['verde', 'amarelo', 'vermelho'] as const;
export type SignalLevel = (typeof SIGNAL_LEVELS)[number];

export const SIGNAL_INFO: Record<SignalLevel, { label: string; multiplier: number; creditBonusKwh: number }> = {
  verde: { label: 'Janela verde — energia abundante e barata', multiplier: 0.88, creditBonusKwh: 0.15 },
  amarelo: { label: 'Janela amarela — condição normal', multiplier: 1, creditBonusKwh: 0 },
  vermelho: { label: 'Janela vermelha — rede pressionada', multiplier: 1.22, creditBonusKwh: 0 },
};

/** Componentes regulatórios mock (R$/kWh e alíquotas) para composição do custo. */
export const TARIFF = {
  encargosKwh: 0.035,
  icms: 0.2, // ICMS + FECP (ilustrativo)
  pisCofins: 0.0465,
  pldFloor: 58.6,
  pldCeiling: 1611.04,
  /** Postos tarifários inspirados na Tarifa Branca (horas locais). */
  peakHours: [18, 19, 20],
  intermediateHours: [17, 21],
  peakFactor: 1.9,
  intermediateFactor: 1.25,
} as const;
