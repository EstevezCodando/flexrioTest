import { normalizeText } from '../lib/util.ts';
import { runTool } from './tools.ts';

/**
 * Roteamento da conversa do gestor (decisão em < 1 ms, sem modelo):
 *  - operacional: dados do próprio Rio Flex (preço dinâmico, estações, sinais, propostas) → ferramentas locais;
 *  - setor: conhecimento do setor elétrico (dados ONS/ANEEL/CCEE/EPE, leis, procedimentos, notícias)
 *           → FlexIA no AgentCore (data lake + documentos oficiais);
 *  - misto: as duas coisas → o Rio Flex coleta o contexto operacional e o envia junto à FlexIA da AWS.
 * Assim cada pergunta vai direto ao motor que tem o dado, sem uma chamada extra de LLM para decidir.
 */
export type Route = 'operacional' | 'setor' | 'misto';

const OPERACIONAL = [
  'rio flex', 'rioflex', 'estacao', 'estacoes', 'eletroposto', 'carregador', 'conector', 'sinal', 'janela',
  'propor', 'proponha', 'publicar', 'alerta', 'consumidor', 'motorista', 'credito', 'recarga', 'modulac',
  'flexibilidade', 'preco dinamico', 'preco agora', 'preco ao consumidor', 'melhor horario', 'capital',
  'baixada', 'regiao dos lagos', 'lagos', 'serrana', 'costa verde', 'medio paraiba', 'norte fluminense',
  'noroeste', 'centro-sul', 'leste metropolitano', 'niteroi', 'comercializadora', 'melhor oferta',
];

const SETOR = [
  'ons', 'aneel', 'ccee', 'epe', 'mme', 'cnpe', 'sin', 'subsistema', 'reservatorio', 'hidrolog', 'ena',
  'cmo', 'constrained', 'curtailment', 'leilao', 'concessao', 'rap', 'lei ', 'decreto', 'resolucao',
  'procedimento de rede', 'procedimentos de rede', 'submodulo', 'regulac', 'regulament', 'norma',
  'bandeira', 'tarifa homologada', 'reajuste', 'noticia', 'historico', 'serie historica', 'geracao eolica',
  'geracao solar', 'geracao hidraulica', 'termica', 'intercambio', 'carga do sin', 'pde', 'mercado livre',
  'abertura do mercado', 'geracao distribuida', 'lei 14.300', 'dec ', 'fec ', 'ocpp', 'iso 15118', 'openadr',
];

function score(t: string, words: string[]): number {
  const padded = ` ${t.replace(/[^a-z0-9.\- ]/g, ' ')} `;
  return words.reduce((n, raw) => {
    const w = raw.trim();
    // Expressões: substring. Siglas curtas (sin, ons, rap...): palavra inteira. Radicais: prefixo.
    const hit = w.includes(' ') ? padded.includes(` ${w} `) || padded.includes(` ${w}`)
      : w.length <= 4 ? padded.includes(` ${w} `)
      : padded.includes(` ${w}`);
    return n + (hit ? 1 : 0);
  }, 0);
}

export function classify(question: string): Route {
  const t = normalizeText(question);
  const op = score(t, OPERACIONAL);
  const se = score(t, SETOR);
  if (op > 0 && se > 0) return 'misto';
  if (op > 0) return 'operacional';
  return 'setor';
}

/** Contexto operacional compacto (poucos centenas de tokens) enviado à FlexIA da AWS em perguntas mistas. */
export function operationalContext(regionId: string): string {
  const price = runTool('consultar_preco_energia', { regiao: regionId, horas: 12 });
  const grid = runTool('consultar_rede', { regiao: regionId, horas: 12 });
  const signals = runTool('listar_sinais', { regiao: regionId });
  const p = price.ok ? (price.result as any) : null;
  const g = grid.ok ? (grid.result as any) : null;
  const compact = {
    fonte: 'Rio Flex (dados operacionais SIMULADOS no MVP; estações reais snapshot carregados_rj 22/09/2026)',
    regiao: p?.regiao,
    agora: p && {
      hora: p.agora.hora,
      pld_mwh: p.agora.pld_mwh,
      posto: p.agora.posto_tarifario,
      sinal: p.agora.sinal.level,
      origem_sinal: p.agora.sinal.source,
      custo_energia_kwh: p.agora.melhor_oferta.totalKwh,
      precos_consumidor_kwh: p.agora.precos_consumidor,
    },
    melhores_janelas_dc: p?.melhores_janelas_dc?.map((w: any) => `${w.startHour}h-${w.endHour}h ${w.avgPriceKwh}`),
    rede: g && { demanda_mw: g.agora.regionalDemandMw, carga_pct: g.agora.loadFactorPct, pico: g.pico_previsto, recarga_ve: g.recarga_ve_agora },
    sinais_ativos: signals.ok ? (signals.result as any[]).map((s) => ({ nivel: s.level, inicio: s.startsAt, fim: s.endsAt, origem: s.origin })) : [],
  };
  return JSON.stringify(compact);
}
