import { z } from 'zod';
import { CHARGE_TYPE_INFO, SIGNAL_INFO, SIGNAL_LEVELS } from '../domain/reference.ts';
import { HOUR, hourStart, isoLocal, localHour, nowEpoch, round } from '../lib/util.ts';
import { gridSeries, weatherSeries } from '../services/grid.ts';
import { getPldSeries, SUBMARKETS } from '../services/market.ts';
import { bestWindows, priceAt, priceSeries, quoteOffers } from '../services/pricing.ts';
import { isRegion, region, regions } from '../services/regions.ts';
import { listSignals } from '../services/signals.ts';
import { estimatedChargingLoadMw, stationsStats } from '../services/stations.ts';
import { searchKnowledge } from './knowledge.ts';

const regionId = z.string().refine(isRegion, 'região inválida — use listar_regioes');
const hours = z.number().int().min(1).max(48).default(24);

export type SignalProposal = {
  regionId: string;
  regionName: string;
  level: (typeof SIGNAL_LEVELS)[number];
  startsAt: string;
  endsAt: string;
  title: string;
  message: string;
};

type ToolDef = {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  schema: z.ZodTypeAny;
  run: (input: any) => unknown;
};

const REGION_PROP = { type: 'string', description: 'ID da região (ex.: capital, baixada, leste, lagos, serra, costa-verde, medio-paraiba, centro-sul, norte, noroeste)' };
const HOURS_PROP = { type: 'integer', minimum: 1, maximum: 48, description: 'Horizonte em horas a partir de agora (padrão 24)' };

export const TOOLS: ToolDef[] = [
  {
    name: 'listar_regioes',
    description: 'Lista as regiões do RJ atendidas, com distribuidora (ilustrativa), submercado e número de estações.',
    input_schema: { type: 'object', properties: {} },
    schema: z.object({}),
    run: () => regions().map((r) => ({ id: r.id, nome: r.name, distribuidora: r.distributor, submercado: r.submarket, estacoes: stationsStats(r.id).stations })),
  },
  {
    name: 'consultar_preco_energia',
    description:
      'Preço da energia para recarga numa região: PLD, melhor oferta do mercado livre, composição do custo (energia, fio, encargos, tributos), nível do sinal (verde/amarelo/vermelho) e preço ao consumidor por tipo de recarga, hora a hora, além das melhores janelas.',
    input_schema: { type: 'object', properties: { regiao: REGION_PROP, horas: HOURS_PROP }, required: ['regiao'] },
    schema: z.object({ regiao: regionId, horas: hours }),
    run: ({ regiao, horas }) => {
      const series = priceSeries(regiao, horas);
      const now = series[0];
      return {
        regiao: region(regiao).name,
        agora: {
          hora: now.localTime,
          pld_mwh: now.pldMwh,
          posto_tarifario: now.tariffPost,
          melhor_oferta: now.best,
          outras_ofertas: quoteOffers(region(regiao), now.hourEpoch).slice(1).map((o) => ({ fornecedor: o.supplierName, produto: o.product, total_kwh: o.totalKwh })),
          sinal: now.signal,
          precos_consumidor: now.consumerPrices,
        },
        serie: series.map((p) => ({ hora: p.localHour, pld: p.pldMwh, custo_kwh: p.best.totalKwh, nivel: p.signal.level, dc_rapida: p.consumerPrices.dc_rapida, ac_lenta: p.consumerPrices.ac_lenta })),
        melhores_janelas_dc: bestWindows(regiao, 'dc_rapida', horas),
      };
    },
  },
  {
    name: 'consultar_mercado_pld',
    description: 'Série horária do PLD (R$/MWh) de um submercado (SE, S, NE, N), com mínimo, máximo e média.',
    input_schema: { type: 'object', properties: { submercado: { type: 'string', enum: SUBMARKETS }, horas: HOURS_PROP }, required: ['submercado'] },
    schema: z.object({ submercado: z.enum(['SE', 'S', 'NE', 'N']), horas: hours }),
    run: ({ submercado, horas }) => {
      const s = getPldSeries(submercado, nowEpoch(), horas);
      const v = s.map((p) => p.pldMwh);
      return {
        submercado,
        fonte: 'mock (integração futura: CCEE)',
        min: Math.min(...v),
        max: Math.max(...v),
        media: round(v.reduce((a, b) => a + b, 0) / v.length, 2),
        serie: s.map((p) => ({ hora: localHour(p.hourEpoch), pld: p.pldMwh })),
      };
    },
  },
  {
    name: 'consultar_rede',
    description: 'Demanda regional (MW) vs. capacidade, geração por fonte do subsistema SE/CO (GW), participação renovável e carga estimada de recarga de VE na região.',
    input_schema: { type: 'object', properties: { regiao: REGION_PROP, horas: HOURS_PROP }, required: ['regiao'] },
    schema: z.object({ regiao: regionId, horas: hours }),
    run: ({ regiao, horas }) => {
      const g = gridSeries(regiao, horas);
      const peak = g.reduce((a, b) => (b.regionalDemandMw > a.regionalDemandMw ? b : a));
      return {
        regiao: region(regiao).name,
        fonte: 'mock (integração futura: ONS e distribuidora)',
        agora: g[0],
        pico_previsto: { hora: peak.localTime, demanda_mw: peak.regionalDemandMw, fator_carga_pct: peak.loadFactorPct },
        recarga_ve_agora: estimatedChargingLoadMw(regiao),
        serie: g.map((p) => ({ hora: p.localHour, demanda_mw: p.regionalDemandMw, fator_carga_pct: p.loadFactorPct, solar_gw: p.submarket.generationGw.solar, renovavel_pct: p.submarket.renewableSharePct })),
      };
    },
  },
  {
    name: 'consultar_clima',
    description: 'Previsão horária de clima na região: temperatura, nebulosidade, irradiância solar, chance de chuva e vento.',
    input_schema: { type: 'object', properties: { regiao: REGION_PROP, horas: HOURS_PROP }, required: ['regiao'] },
    schema: z.object({ regiao: regionId, horas: hours }),
    run: ({ regiao, horas }) => ({ regiao: region(regiao).name, fonte: 'mock (integração futura: INMET)', serie: weatherSeries(regiao, horas) }),
  },
  {
    name: 'buscar_regulacao',
    description: 'Busca na base de conhecimento regulatória e técnica (ANEEL, CCEE, ONS, leis, protocolos OCPP/OCPI/OpenADR/ISO 15118, normas IEC/ABNT, dados da base de estações).',
    input_schema: { type: 'object', properties: { consulta: { type: 'string', description: 'Termos da busca' } }, required: ['consulta'] },
    schema: z.object({ consulta: z.string().min(2).max(200) }),
    run: ({ consulta }) => ({
      aviso: 'Resumos para apoio à decisão; confirmar o texto oficial vigente.',
      resultados: searchKnowledge(consulta),
    }),
  },
  {
    name: 'resumo_estacoes',
    description: 'Estatísticas das estações de recarga (todas ou de uma região): quantidade, públicas, manutenção, conectores por tipo de recarga, preços publicados e conflitos de preço.',
    input_schema: { type: 'object', properties: { regiao: { ...REGION_PROP, description: 'Opcional — omita para o estado inteiro' } } },
    schema: z.object({ regiao: regionId.optional() }),
    run: ({ regiao }) => ({ escopo: regiao ? region(regiao).name : 'Estado do RJ', ...stationsStats(regiao) }),
  },
  {
    name: 'listar_sinais',
    description: 'Sinais de preço publicados pelos gestores (ativos e agendados).',
    input_schema: { type: 'object', properties: { regiao: { ...REGION_PROP, description: 'Opcional' } } },
    schema: z.object({ regiao: regionId.optional() }),
    run: ({ regiao }) => listSignals({ regionId: regiao }),
  },
  {
    name: 'propor_sinal_preco',
    description:
      'Prepara uma PROPOSTA de sinal de preço/comunicado para os consumidores de uma região. NÃO publica: o gestor revisa e publica pela interface. Use após analisar preço, rede e clima.',
    input_schema: {
      type: 'object',
      properties: {
        regiao: REGION_PROP,
        nivel: { type: 'string', enum: SIGNAL_LEVELS },
        inicio_em_horas: { type: 'integer', minimum: 0, maximum: 47, description: 'Horas a partir de agora para o início' },
        duracao_horas: { type: 'integer', minimum: 1, maximum: 12 },
        titulo: { type: 'string', maxLength: 80 },
        mensagem: { type: 'string', maxLength: 280, description: 'Texto claro ao consumidor: o quê, quando e o benefício' },
      },
      required: ['regiao', 'nivel', 'inicio_em_horas', 'duracao_horas', 'titulo', 'mensagem'],
    },
    schema: z.object({
      regiao: regionId,
      nivel: z.enum(SIGNAL_LEVELS),
      inicio_em_horas: z.number().int().min(0).max(47),
      duracao_horas: z.number().int().min(1).max(12),
      titulo: z.string().min(3).max(80),
      mensagem: z.string().min(10).max(280),
    }),
    run: (i): { proposta: SignalProposal; efeito: string } => {
      const start = hourStart(nowEpoch()) + i.inicio_em_horas * HOUR;
      return {
        proposta: {
          regionId: i.regiao,
          regionName: region(i.regiao).name,
          level: i.nivel,
          startsAt: isoLocal(start),
          endsAt: isoLocal(start + i.duracao_horas * HOUR),
          title: i.titulo,
          message: i.mensagem,
        },
        efeito: `Multiplicador ${SIGNAL_INFO[i.nivel as keyof typeof SIGNAL_INFO].multiplier} sobre a margem do serviço; preço DC rápida atual ${priceAt(i.regiao, start).consumerPrices.dc_rapida} R$/kWh. Aguardando publicação pelo gestor.`,
      };
    },
  },
];

export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function runTool(name: string, rawInput: unknown): { ok: true; result: unknown } | { ok: false; error: string } {
  const tool = TOOL_BY_NAME.get(name);
  if (!tool) return { ok: false, error: `Ferramenta desconhecida: ${name}` };
  const parsed = tool.schema.safeParse(rawInput ?? {});
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  try {
    return { ok: true, result: tool.run(parsed.data) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'erro ao executar ferramenta' };
  }
}

export const CHARGE_LABELS = Object.fromEntries(Object.entries(CHARGE_TYPE_INFO).map(([k, v]) => [k, v.label]));
