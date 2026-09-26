import { normalizeText } from '../lib/util.ts';
import { regions } from '../services/regions.ts';
import { runTool, type SignalProposal } from './tools.ts';

/**
 * Motor local da FlexIA (sem LLM). Usado quando não há ANTHROPIC_API_KEY ou quando a
 * API externa falha. Roteia a pergunta por intenção, chama as MESMAS ferramentas do
 * agente e redige a resposta com os dados — garantindo que o sistema funcione offline.
 */

const INTENTS: Record<string, string[]> = {
  regulacao: ['regula', 'aneel', 'lei', 'norma', 'protocolo', 'ocpp', 'ocpi', 'openadr', 'iso', 'iec', 'nbr', 'lgpd', 'resolu', 'ren', 'tarifa branca', 'bandeira', 'incentivad', 'portaria', 'ccee', 'ons', 'v2g', 'abnt', 'plug and charge'],
  preco: ['preco', 'janela', 'melhor horario', 'pld', 'custo', 'tarifa', 'oferta', 'comercializ', 'mercado', 'kwh', 'barat', 'caro'],
  rede: ['demanda', 'carga', 'geracao', 'rede', 'pico', 'renovav', 'hidr', 'termic', 'solar', 'eolic'],
  clima: ['clima', 'tempo', 'temperatura', 'chuva', 'nublad', 'irradia', 'vento', 'calor'],
  estacoes: ['estac', 'eletroposto', 'carregador', 'conector', 'manutenc', 'ponto de recarga', 'base'],
  sinal: ['comunicad', 'publicar', 'propor', 'proponha', 'avisar', 'avise', 'notific', 'campanha', 'criar sinal', 'crie um sinal', 'emitir sinal'],
};

export function detectRegion(text: string): string | undefined {
  const t = normalizeText(text);
  const aliases: Record<string, string[]> = {
    capital: ['capital', 'rio de janeiro', 'cidade do rio', 'zona sul', 'zona norte', 'zona oeste', 'centro do rio', 'barra da tijuca'],
    baixada: ['baixada', 'caxias', 'nova iguacu', 'meriti', 'belford'],
    leste: ['leste', 'niteroi', 'sao goncalo', 'marica', 'itaborai'],
    lagos: ['lagos', 'cabo frio', 'buzios', 'arraial', 'saquarema', 'araruama', 'rio das ostras'],
    serra: ['serra', 'petropolis', 'teresopolis', 'friburgo'],
    'costa-verde': ['costa verde', 'angra', 'paraty', 'mangaratiba'],
    'medio-paraiba': ['medio paraiba', 'volta redonda', 'resende', 'barra mansa', 'itatiaia'],
    'centro-sul': ['centro-sul', 'centro sul', 'vassouras', 'tres rios', 'miguel pereira'],
    norte: ['norte fluminense', 'macae', 'campos'],
    noroeste: ['noroeste', 'itaperuna', 'padua'],
  };
  for (const [id, words] of Object.entries(aliases)) if (words.some((w) => t.includes(w))) return id;
  return undefined;
}

const PRODUCT: Record<string, string> = { convencional: 'convencional', incentivada_50: 'incentivada 50%', incentivada_100: 'incentivada 100%' };
const SOURCE: Record<string, string> = { automatico: 'automático', gestor: 'publicado por gestor' };
const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;
const LEVEL_EMOJI: Record<string, string> = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' };

export function localAnswer(question: string, defaultRegion = 'capital') {
  const t = normalizeText(question);
  const regionId = detectRegion(question) ?? defaultRegion;
  const regionName = regions().find((r) => r.id === regionId)?.name ?? regionId;
  // Palavras simples casam pelo início de cada palavra (evita "ons" em "consumidores");
  // expressões com espaço casam por substring.
  const words = t.split(/[^a-z0-9]+/).filter(Boolean);
  const hit = (k: string) => (k.includes(' ') ? t.includes(k) : words.some((w) => w.startsWith(k)));
  let matched = Object.entries(INTENTS).filter(([, kws]) => kws.some(hit)).map(([k]) => k);
  if (matched.length === 0) matched = ['preco', 'rede'];

  const parts: string[] = [];
  const toolsUsed: string[] = [];
  let proposal: SignalProposal | undefined;
  const call = (name: string, input: unknown) => {
    toolsUsed.push(name);
    const r = runTool(name, input);
    return r.ok ? (r.result as any) : null;
  };

  if (matched.includes('regulacao')) {
    const r = call('buscar_regulacao', { consulta: question });
    if (r?.resultados?.length) {
      parts.push(
        '### Regulação e normas relacionadas\n' +
          r.resultados
            .map((k: any) => `**${k.title}** (${k.authority})\n${k.summary}\n**No Rio Flex:** ${k.relevance}`)
            .join('\n\n') +
          `\n\n> ${r.aviso}`,
      );
    } else parts.push('Não encontrei itens na base regulatória para esses termos. Tente citar o órgão (ANEEL, CCEE, ONS) ou o tema (tarifa branca, OCPP, mercado livre).');
  }

  if (matched.includes('preco') || matched.includes('sinal')) {
    const p = call('consultar_preco_energia', { regiao: regionId, horas: 24 });
    if (p) {
      const a = p.agora;
      const cheapest = [...p.serie].sort((x: any, y: any) => x.custo_kwh - y.custo_kwh)[0];
      const priciest = [...p.serie].sort((x: any, y: any) => y.custo_kwh - x.custo_kwh)[0];
      parts.push(
        `### Preço da energia — ${regionName}\n` +
          `Agora: PLD **${brl(a.pld_mwh)}/MWh**, posto **${a.posto_tarifario.replace('_', ' ')}**, sinal ${LEVEL_EMOJI[a.sinal.level]} **${a.sinal.level}** (${SOURCE[a.sinal.source] ?? a.sinal.source}).\n` +
          `Melhor oferta do mercado livre: **${a.melhor_oferta.supplierName}** (${PRODUCT[a.melhor_oferta.product] ?? a.melhor_oferta.product}) → custo **${brl(a.melhor_oferta.totalKwh)}/kWh** ` +
          `(energia ${brl(a.melhor_oferta.energyKwh)} + fio ${brl(a.melhor_oferta.wireKwh)} + encargos ${brl(a.melhor_oferta.chargesKwh)} + tributos ${brl(a.melhor_oferta.taxesKwh)}).\n` +
          `Preço ao consumidor: AC lenta ${brl(a.precos_consumidor.ac_lenta)} · DC rápida ${brl(a.precos_consumidor.dc_rapida)} · DC ultra ${brl(a.precos_consumidor.dc_ultrarrapida)} por kWh.\n` +
          `Nas próximas 24 h: mais barato às **${cheapest.hora}h** (${brl(cheapest.custo_kwh)}/kWh), mais caro às **${priciest.hora}h** (${brl(priciest.custo_kwh)}/kWh).\n` +
          `Melhores janelas DC: ${p.melhores_janelas_dc.map((w: any) => `${w.startHour}h–${w.endHour}h (${brl(w.avgPriceKwh)})`).join(', ')}.`,
      );
      if (matched.includes('sinal')) {
        const w = p.melhores_janelas_dc[0];
        const startIn = (w.startHour - p.serie[0].hora + 24) % 24;
        const prop = call('propor_sinal_preco', {
          regiao: regionId,
          nivel: 'verde',
          inicio_em_horas: Math.min(47, startIn),
          duracao_horas: 2,
          titulo: `Janela verde ${w.startHour}h–${w.endHour}h`,
          mensagem: `Energia mais barata em ${regionName} entre ${w.startHour}h e ${w.endHour}h: recarregue com preço reduzido e ganhe créditos extras por kWh.`,
        });
        if (prop) {
          proposal = prop.proposta;
          parts.push(`### Proposta de sinal\nPreparei um sinal **verde** de ${w.startHour}h a ${w.endHour}h para ${regionName}. Revise e clique em **Publicar sinal** para notificar os consumidores.`);
        }
      }
    }
  }

  if (matched.includes('rede')) {
    const g = call('consultar_rede', { regiao: regionId, horas: 24 });
    if (g) {
      const n = g.agora;
      parts.push(
        `### Rede — ${regionName}\n` +
          `Demanda agora **${n.regionalDemandMw} MW** (${n.loadFactorPct}% da capacidade). Pico previsto: **${g.pico_previsto.demanda_mw} MW** em ${g.pico_previsto.hora.slice(11, 16)}.\n` +
          `Subsistema SE/CO: ${n.submarket.demandGw} GW de carga; hidráulica ${n.submarket.generationGw.hidraulica} GW, solar ${n.submarket.generationGw.solar} GW, eólica ${n.submarket.generationGw.eolica} GW, térmica ${n.submarket.generationGw.termica} GW, nuclear ${n.submarket.generationGw.nuclear} GW — **${n.submarket.renewableSharePct}% renovável**.\n` +
          `Recarga de VE estimada agora: ${g.recarga_ve_agora.mw} MW (${g.recarga_ve_agora.busyConnectors}/${g.recarga_ve_agora.totalConnectors} conectores ocupados).`,
      );
    }
  }

  if (matched.includes('clima')) {
    const c = call('consultar_clima', { regiao: regionId, horas: 12 });
    if (c) {
      const now = c.serie[0];
      const sunny = c.serie.filter((w: any) => w.irradianceWm2 > 500).map((w: any) => `${w.localHour}h`);
      parts.push(
        `### Clima — ${regionName}\nAgora ${now.temperatureC} °C, ${now.condition}, nebulosidade ${now.cloudCoverPct}%, chuva ${now.rainProbabilityPct}%, vento ${now.windKmh} km/h.\n` +
          (sunny.length ? `Irradiância alta (>500 W/m²) prevista em: ${sunny.join(', ')} — boa janela para excedente solar.` : 'Sem janela de irradiância alta nas próximas 12 h.'),
      );
    }
  }

  if (matched.includes('estacoes')) {
    const s = call('resumo_estacoes', detectRegion(question) ? { regiao: regionId } : {});
    if (s) {
      parts.push(
        `### Estações — ${s.escopo}\n${s.stations} locais (${s.publicStations} públicos, ${s.dcStations} com DC), ${s.connectors} conectores. ` +
          `Em manutenção: ${s.maintenance}; inativos/obra: ${s.inactiveOrConstruction}. Conflitos de preço sinalizados: ${s.priceConflicts}.\n` +
          `Conectores por tipo: AC lenta ${s.connectorsByChargeType.ac_lenta}, AC semirrápida ${s.connectorsByChargeType.ac_semirrapida}, DC rápida ${s.connectorsByChargeType.dc_rapida}, DC ultrarrápida ${s.connectorsByChargeType.dc_ultrarrapida}.\n` +
          (s.publishedPrices.count ? `Preços publicados (${s.publishedPrices.count}): mín ${brl(s.publishedPrices.min)}, mediana ${brl(s.publishedPrices.median)}, máx ${brl(s.publishedPrices.max)} por kWh.` : ''),
      );
    }
  }

  const text =
    parts.join('\n\n') +
    '\n\n> Resposta do motor local da FlexIA com dados simulados. Configure `ANTHROPIC_API_KEY` na API para respostas em linguagem natural mais completas.';
  return { text, toolsUsed: [...new Set(toolsUsed)], proposal };
}
