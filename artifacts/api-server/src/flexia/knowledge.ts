import { normalizeText } from '../lib/util.ts';

/**
 * Base de conhecimento resumida da FlexIA (regulação, protocolos e mercado).
 * Resumos próprios para apoio à decisão — SEMPRE confirmar o texto oficial vigente
 * antes de qualquer uso jurídico/regulatório. Pensada para ser substituída por um
 * índice de documentos oficiais (RAG) no futuro.
 */
export type KnowledgeEntry = {
  id: string;
  category: 'regulacao' | 'mercado' | 'protocolo' | 'norma_tecnica' | 'dados';
  title: string;
  authority: string;
  summary: string;
  relevance: string;
  tags: string[];
  reference: string;
};

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'aneel-ren-819-2018',
    category: 'regulacao',
    title: 'Recarga de veículos elétricos — REN ANEEL nº 819/2018',
    authority: 'ANEEL',
    summary:
      'Estabeleceu os procedimentos e condições para a atividade de recarga de veículos elétricos, permitindo que distribuidoras, agentes e interessados explorem a recarga com preços livremente negociados. As disposições foram posteriormente consolidadas nas regras de prestação do serviço de distribuição (REN nº 1.000/2021).',
    relevance: 'Base legal para o eletroposto cobrar por kWh e praticar preço dinâmico, como o Rio Flex propõe.',
    tags: ['recarga', 'eletroposto', 'veiculo eletrico', 've', 'preco livre', 'aneel', 'cobranca'],
    reference: 'https://www.gov.br/aneel',
  },
  {
    id: 'aneel-ren-1000-2021',
    category: 'regulacao',
    title: 'Regras de Prestação do Serviço de Distribuição — REN ANEEL nº 1.000/2021',
    authority: 'ANEEL',
    summary:
      'Consolida direitos e deveres de consumidores e distribuidoras (conexão, medição, faturamento, qualidade). Inclui as regras aplicáveis a instalações de recarga conectadas à rede de distribuição.',
    relevance: 'Condições de conexão de eletropostos, faturamento e responsabilidades da distribuidora.',
    tags: ['distribuicao', 'conexao', 'faturamento', 'distribuidora', 'aneel', 'consumidor'],
    reference: 'https://www.gov.br/aneel',
  },
  {
    id: 'tarifa-branca',
    category: 'regulacao',
    title: 'Tarifa Branca (tarifa horária para baixa tensão)',
    authority: 'ANEEL',
    summary:
      'Modalidade opcional para consumidores de baixa tensão com preços diferentes por posto tarifário: ponta (3 horas definidas pela distribuidora, em dias úteis), intermediário (1 hora antes e depois da ponta) e fora de ponta, que é mais barato.',
    relevance: 'O mock do Rio Flex usa postos inspirados na Tarifa Branca para compor o custo do fio (TUSD) por hora.',
    tags: ['tarifa branca', 'posto tarifario', 'ponta', 'fora ponta', 'horaria', 'baixa tensao'],
    reference: 'https://www.gov.br/aneel',
  },
  {
    id: 'bandeiras',
    category: 'regulacao',
    title: 'Sistema de Bandeiras Tarifárias',
    authority: 'ANEEL',
    summary:
      'Sinaliza mensalmente o custo de geração no mercado regulado: verde (sem acréscimo), amarela, vermelha patamar 1 e vermelha patamar 2 (acréscimos por kWh). Reflete principalmente a hidrologia e o despacho térmico.',
    relevance: 'Complementa o sinal horário: bandeiras vermelhas indicam período em que deslocar consumo gera mais valor.',
    tags: ['bandeira', 'bandeiras tarifarias', 'vermelha', 'amarela', 'verde', 'custo geracao'],
    reference: 'https://www.gov.br/aneel',
  },
  {
    id: 'pld',
    category: 'mercado',
    title: 'PLD — Preço de Liquidação das Diferenças (horário)',
    authority: 'CCEE',
    summary:
      'Preço usado para liquidar as diferenças no mercado de curto prazo, calculado por submercado (SE/CO, S, NE, N). Desde 2021 é horário, com base em modelos de otimização do despacho (NEWAVE, DECOMP e DESSEM). Piso e teto são definidos anualmente pela ANEEL.',
    relevance: 'É o principal sinal de preço de energia do mercado livre que o Rio Flex repassa ao consumidor (hoje simulado).',
    tags: ['pld', 'ccee', 'preco horario', 'submercado', 'mercado de curto prazo', 'dessem', 'mercado livre'],
    reference: 'https://www.ccee.org.br',
  },
  {
    id: 'mercado-livre',
    category: 'mercado',
    title: 'Ambiente de Contratação Livre (ACL) e abertura do mercado',
    authority: 'MME / ANEEL / CCEE',
    summary:
      'No ACL o consumidor negocia energia diretamente com geradores ou comercializadoras. A Portaria MME nº 50/2022 permitiu que todos os consumidores do Grupo A (média e alta tensão) migrassem a partir de janeiro de 2024. A abertura para baixa tensão está em discussão/implantação pela reforma do setor elétrico — verificar o marco normativo vigente.',
    relevance: 'Eletropostos em média tensão podem comprar energia no mercado livre e escolher a melhor oferta por região/horário.',
    tags: ['mercado livre', 'acl', 'comercializadora', 'migracao', 'grupo a', 'abertura', 'portaria 50'],
    reference: 'https://www.gov.br/mme',
  },
  {
    id: 'energia-incentivada',
    category: 'mercado',
    title: 'Energia incentivada (desconto na TUSD/TUST)',
    authority: 'Lei nº 9.427/1996 (art. 26) / ANEEL',
    summary:
      'Energia de fontes incentivadas (ex.: solar, eólica, biomassa, PCH) confere ao comprador desconto de 50% ou 100% nas tarifas de uso dos sistemas de transmissão e distribuição, conforme o enquadramento do empreendimento. Novas outorgas tiveram o benefício alterado pela Lei nº 14.120/2021.',
    relevance: 'Explica por que ofertas "incentivada 50/100%" podem vencer a convencional no cálculo do melhor preço regional.',
    tags: ['incentivada', 'desconto tusd', 'renovavel', 'fonte incentivada', 'tusd', 'tust'],
    reference: 'https://www.gov.br/aneel',
  },
  {
    id: 'lei-14300',
    category: 'regulacao',
    title: 'Marco legal da micro e minigeração distribuída — Lei nº 14.300/2022',
    authority: 'Congresso Nacional / ANEEL',
    summary:
      'Define regras de compensação de energia para micro e minigeração distribuída (ex.: solar em telhados), com transição gradual da cobrança pelo uso da rede para novos sistemas.',
    relevance: 'Eletropostos com geração solar própria (ex.: postos em estacionamentos) podem compensar energia.',
    tags: ['geracao distribuida', 'gd', 'solar', 'compensacao', 'lei 14300', 'micro geracao'],
    reference: 'https://www.planalto.gov.br',
  },
  {
    id: 'resposta-demanda',
    category: 'regulacao',
    title: 'Resposta da demanda',
    authority: 'ONS / ANEEL',
    summary:
      'Mecanismo em que consumidores reduzem ou deslocam carga mediante sinal do operador e recebem remuneração. No Brasil existe programa voltado a grandes consumidores; a participação agregada de cargas pequenas (como frotas de VE) depende de evolução regulatória.',
    relevance: 'A modulação de potência aceita pelo consumidor no Rio Flex é uma forma de resposta da demanda agregada.',
    tags: ['resposta da demanda', 'flexibilidade', 'ons', 'modulacao', 'agregador', 'deslocamento de carga'],
    reference: 'https://www.ons.org.br',
  },
  {
    id: 'lgpd',
    category: 'regulacao',
    title: 'LGPD — Lei nº 13.709/2018',
    authority: 'ANPD',
    summary:
      'Regula o tratamento de dados pessoais. Localização, hábitos de recarga e dados do veículo são dados pessoais e exigem base legal, minimização, transparência e segurança.',
    relevance: 'O Rio Flex guarda o mínimo necessário, não expõe dados de consumidores ao gestor em nível individual e registra auditoria.',
    tags: ['lgpd', 'privacidade', 'dados pessoais', 'anpd', 'consentimento'],
    reference: 'https://www.gov.br/anpd',
  },
  {
    id: 'ocpp',
    category: 'protocolo',
    title: 'OCPP 1.6J / 2.0.1 (Open Charge Point Protocol)',
    authority: 'Open Charge Alliance',
    summary:
      'Protocolo aberto entre o carregador e o sistema central (CSMS). Permite iniciar/parar sessões, ler medição, status de conectores e aplicar perfis de carga (SmartCharging/ChargingProfile) para limitar potência por horário.',
    relevance: 'Canal técnico pelo qual o sinal de preço vira limite de potência no carregador (modulação).',
    tags: ['ocpp', 'smart charging', 'charging profile', 'csms', 'carregador', 'protocolo'],
    reference: 'https://openchargealliance.org',
  },
  {
    id: 'ocpi',
    category: 'protocolo',
    title: 'OCPI 2.2.1 (Open Charge Point Interface)',
    authority: 'EVRoaming Foundation',
    summary: 'Interface de roaming entre operadores de eletropostos (CPO) e provedores de mobilidade (eMSP): localização, tarifas, sessões e cobrança.',
    relevance: 'Permite publicar tarifas dinâmicas e disponibilidade do Rio Flex para outros apps e operadores.',
    tags: ['ocpi', 'roaming', 'cpo', 'emsp', 'tarifa', 'interoperabilidade'],
    reference: 'https://evroaming.org',
  },
  {
    id: 'openadr',
    category: 'protocolo',
    title: 'OpenADR 2.0b',
    authority: 'OpenADR Alliance',
    summary: 'Padrão para envio automatizado de sinais de preço e eventos de resposta da demanda do operador/concessionária para agregadores e cargas.',
    relevance: 'Candidato para receber sinais da distribuidora/ONS e repassá-los aos eletropostos do Rio Flex.',
    tags: ['openadr', 'resposta da demanda', 'sinal de preco', 'evento', 'agregador'],
    reference: 'https://www.openadr.org',
  },
  {
    id: 'iso-15118',
    category: 'protocolo',
    title: 'ISO 15118 (-2 e -20)',
    authority: 'ISO',
    summary: 'Comunicação veículo–carregador de alto nível: Plug & Charge (autenticação por certificado), troca de tabelas de preço e, na parte -20, suporte a fluxo bidirecional (V2G).',
    relevance: 'Permite que o próprio veículo receba a tabela de preços e agende a recarga; base para V2G futuro.',
    tags: ['iso 15118', 'plug and charge', 'v2g', 'bidirecional', 'veiculo carregador'],
    reference: 'https://www.iso.org',
  },
  {
    id: 'iec-61851-62196',
    category: 'norma_tecnica',
    title: 'IEC 61851 e IEC 62196 (modos de recarga e conectores)',
    authority: 'IEC / ABNT NBR IEC',
    summary: 'A IEC 61851 define os modos de recarga (1 a 4) e requisitos do sistema; a IEC 62196 define plugues e tomadas, como Tipo 2 (AC) e CCS Combo 2 (DC), padrão predominante no Brasil.',
    relevance: 'Justifica a classificação de tipos de recarga (AC lenta/semirrápida, DC rápida/ultrarrápida) mostrada ao consumidor.',
    tags: ['iec 61851', 'iec 62196', 'tipo 2', 'ccs2', 'conector', 'modo de recarga'],
    reference: 'https://www.abnt.org.br',
  },
  {
    id: 'nbr-17019',
    category: 'norma_tecnica',
    title: 'ABNT NBR 17019 — instalações elétricas para recarga de VE',
    authority: 'ABNT',
    summary: 'Requisitos para instalações elétricas de baixa tensão destinadas à alimentação de veículos elétricos (proteções, circuitos dedicados, localização).',
    relevance: 'Checklist técnico de segurança para novos pontos de recarga em condomínios e estacionamentos.',
    tags: ['nbr 17019', 'instalacao eletrica', 'seguranca', 'condominio', 'abnt'],
    reference: 'https://www.abnt.org.br',
  },
  {
    id: 'base-carregados',
    category: 'dados',
    title: 'Base Carregados RJ (snapshot 22/09/2026)',
    authority: 'Coleta Cavuca sobre cadastros públicos do Carregados',
    summary:
      '828 locais, 1.255 equipamentos e 1.422 conectores em 60 municípios do RJ. 277 preços informados (mediana R$ 2,20/kWh incluindo zeros; R$ 2,30 só pagos) e 551 ausentes. Não é censo nem verificação de operação real; preço publicado não é cotação executável.',
    relevance: 'Alimenta a base de estações do mock; qualidade e conflitos de preço ficam sinalizados por estação.',
    tags: ['carregados', 'base', 'estacoes', 'snapshot', 'qualidade', 'preco publicado', 'dados'],
    reference: 'https://carregados.com.br',
  },
];

export function searchKnowledge(query: string, limit = 4): KnowledgeEntry[] {
  const terms = normalizeText(query).split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return KNOWLEDGE.slice(0, limit);
  return KNOWLEDGE.map((k) => {
    const hay = normalizeText(`${k.title} ${k.summary} ${k.tags.join(' ')} ${k.authority}`);
    const tagHits = k.tags.filter((t) => terms.some((q) => t.includes(q))).length;
    const textHits = terms.filter((q) => hay.includes(q)).length;
    return { k, score: tagHits * 3 + textHits };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.k);
}
