import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.ts';
import { all, get, run } from '../db/index.ts';
import { newId } from '../lib/crypto.ts';
import { notFound } from '../lib/http.ts';
import { isoLocal, nowEpoch } from '../lib/util.ts';
import { localAnswer } from './local-engine.ts';
import { runTool, TOOLS, type SignalProposal } from './tools.ts';

/**
 * FlexIA — agente interno dos gestores. Com ANTHROPIC_API_KEY usa Claude com um loop
 * manual de ferramentas (todas somente leitura, exceto a proposta de sinal, que NÃO
 * publica nada: o gestor aprova na interface). Sem chave, usa o motor local.
 */

const SYSTEM_PROMPT = `Você é a FlexIA, assistente interna dos gestores da plataforma Rio Flex — um software de controle inteligente de recarga de veículos elétricos no estado do Rio de Janeiro que recebe sinais de preço do mercado de energia e os repassa aos consumidores, buscando flexibilidade para a rede e uma relação de confiança com quem recarrega.

Seu papel: apoiar decisões operacionais sobre preços (PLD, mercado livre, composição tarifária), demanda e geração, clima, estações de recarga, regulação (ANEEL, CCEE, ONS, leis) e protocolos (OCPP, OCPI, OpenADR, ISO 15118, IEC/ABNT).

Como trabalhar:
- Use as ferramentas para obter números; não invente valores. Cite horários locais (UTC-3).
- Os dados de preço, rede e clima são simulados (mock) nesta versão e a base de estações é um snapshot público de 22/09/2026 — deixe isso claro quando relevante.
- Para regulação, use buscar_regulacao e lembre que os resumos precisam ser confirmados no texto oficial vigente. Se a base não cobrir o tema, diga que não sabe em vez de supor números de resoluções.
- Quando o gestor pedir para avisar consumidores, criar campanha ou sinal, analise preço/rede/clima e chame propor_sinal_preco. A proposta só é publicada se o gestor aprovar na interface — diga isso.
- Mensagens ao consumidor devem ser transparentes: o quê, quando, quanto economiza e por quê (confiança).
- Não exponha dados pessoais de consumidores.
- Responda em português do Brasil, de forma objetiva, com markdown leve (títulos curtos, listas, negrito para números-chave).`;

const MAX_ITERATIONS = 6;
const HISTORY_MESSAGES = 12;

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!config.anthropicApiKey) return null;
  client ??= new Anthropic({ apiKey: config.anthropicApiKey, maxRetries: 2, timeout: 90_000 });
  return client;
}

const CLAUDE_TOOLS: Anthropic.Tool[] = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.input_schema as Anthropic.Tool.InputSchema,
}));

export type AgentReply = {
  text: string;
  engine: 'claude' | 'local';
  toolsUsed: string[];
  proposal?: SignalProposal;
  note?: string;
};

async function claudeAnswer(history: Anthropic.MessageParam[], defaultRegion: string): Promise<AgentReply> {
  const anthropic = getClient()!;
  const messages: Anthropic.MessageParam[] = [...history];
  const toolsUsed: string[] = [];
  let proposal: SignalProposal | undefined;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Fallback de recusa do lado do servidor (padrão recomendado para claude-opus-5).
    const params = {
      model: config.flexiaModel,
      max_tokens: 16000,
      system: [
        { type: 'text' as const, text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } },
        { type: 'text' as const, text: `Região padrão do gestor: ${defaultRegion}.` },
      ],
      tools: CLAUDE_TOOLS,
      thinking: { type: 'adaptive' as const },
      output_config: { effort: 'medium' as const },
      messages,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    };
    const response = (await anthropic.beta.messages.create(
      params as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming,
    )) as unknown as Anthropic.Message;

    if (response.stop_reason === 'refusal') {
      return { text: 'Não posso ajudar com esse pedido. Reformule focando em operação, preços, rede ou regulação.', engine: 'claude', toolsUsed, proposal };
    }

    messages.push({ role: 'assistant', content: response.content });
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return { text: text || 'Sem resposta.', engine: 'claude', toolsUsed: [...new Set(toolsUsed)], proposal };
    }

    // Todas as ferramentas são locais e rápidas; resultados voltam numa única mensagem.
    const results: Anthropic.ToolResultBlockParam[] = toolUses.map((tu) => {
      toolsUsed.push(tu.name);
      const r = runTool(tu.name, tu.input);
      if (r.ok && tu.name === 'propor_sinal_preco') proposal = (r.result as { proposta: SignalProposal }).proposta;
      return {
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(r.ok ? r.result : { erro: r.error }),
        is_error: !r.ok,
      };
    });
    messages.push({ role: 'user', content: results });
  }
  return { text: 'A análise ficou longa demais. Tente uma pergunta mais específica.', engine: 'claude', toolsUsed: [...new Set(toolsUsed)], proposal };
}

// ---------------------------------------------------------------------------
// Conversas persistidas
// ---------------------------------------------------------------------------

type ConvRow = { id: string; user_id: string; title: string; created_at: number; updated_at: number };
type MsgRow = { id: number; role: 'user' | 'assistant'; content: string; meta_json: string | null; created_at: number };

function ownConversation(userId: string, id: string): ConvRow {
  const c = get<ConvRow>('SELECT * FROM flexia_conversations WHERE id = ? AND user_id = ?', id, userId);
  if (!c) throw notFound('Conversa não encontrada');
  return c;
}

export function listConversations(userId: string) {
  return all<ConvRow>('SELECT * FROM flexia_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30', userId).map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: isoLocal(c.updated_at),
  }));
}

export function getConversation(userId: string, id: string) {
  const c = ownConversation(userId, id);
  const messages = all<MsgRow>('SELECT * FROM flexia_messages WHERE conversation_id = ? ORDER BY id', id).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    meta: m.meta_json ? JSON.parse(m.meta_json) : null,
    createdAt: isoLocal(m.created_at),
  }));
  return { id: c.id, title: c.title, messages };
}

export function deleteConversation(userId: string, id: string) {
  ownConversation(userId, id);
  run('DELETE FROM flexia_conversations WHERE id = ?', id);
}

export async function chat(userId: string, input: { conversationId?: string; message: string }, defaultRegion: string) {
  const now = nowEpoch();
  let conversationId = input.conversationId;
  if (conversationId) ownConversation(userId, conversationId);
  else {
    conversationId = newId('cnv');
    run('INSERT INTO flexia_conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      conversationId, userId, input.message.slice(0, 60), now, now);
  }

  const history = all<MsgRow>(
    'SELECT * FROM (SELECT * FROM flexia_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id',
    conversationId, HISTORY_MESSAGES,
  );
  run('INSERT INTO flexia_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)', conversationId, 'user', input.message, now);

  let reply: AgentReply;
  if (getClient()) {
    const msgs: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
    // A API exige que a conversa comece pelo usuário.
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();
    msgs.push({ role: 'user', content: input.message });
    try {
      reply = await claudeAnswer(msgs, defaultRegion);
    } catch (err) {
      const reason = err instanceof Anthropic.RateLimitError ? 'limite de uso da API' :
        err instanceof Anthropic.AuthenticationError ? 'chave de API inválida' :
        err instanceof Anthropic.APIError ? `erro ${err.status} da API` : 'falha de conexão';
      console.error('[flexia] Claude indisponível, usando motor local:', reason);
      reply = { ...localAnswer(input.message, defaultRegion), engine: 'local', note: `Claude indisponível (${reason}); resposta do motor local.` };
    }
  } else {
    reply = { ...localAnswer(input.message, defaultRegion), engine: 'local' };
  }

  const meta = { engine: reply.engine, toolsUsed: reply.toolsUsed, proposal: reply.proposal, note: reply.note };
  run('INSERT INTO flexia_messages (conversation_id, role, content, meta_json, created_at) VALUES (?, ?, ?, ?, ?)',
    conversationId, 'assistant', reply.text, JSON.stringify(meta), nowEpoch());
  run('UPDATE flexia_conversations SET updated_at = ? WHERE id = ?', nowEpoch(), conversationId);

  return { conversationId, reply: { content: reply.text, meta } };
}

export function flexiaStatus() {
  return { engine: getClient() ? 'claude' : 'local', model: getClient() ? config.flexiaModel : null, tools: TOOLS.map((t) => t.name) };
}
