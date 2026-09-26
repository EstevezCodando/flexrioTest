import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.ts';
import { all, get, run } from '../db/index.ts';
import { newId } from '../lib/crypto.ts';
import { notFound } from '../lib/http.ts';
import { errorFields, log } from '../lib/logger.ts';
import { isoLocal, nowEpoch } from '../lib/util.ts';
import { agentCoreSessionId, invokeFlexiaAgentCore } from './agentcore.ts';
import { detectRegion, localAnswer } from './local-engine.ts';
import { classify, operationalContext, type Route } from './router.ts';
import { runTool, TOOLS, type SignalProposal } from './tools.ts';

/**
 * FlexIA no Rio Flex — orquestra três motores e transmite a resposta em tempo real (SSE):
 *  - AgentCore: a FlexIA implantada na AWS (data lake + documentos oficiais) para perguntas do setor;
 *  - local: ferramentas do Rio Flex (preço dinâmico, estações, sinais, propostas) — respostas em ms;
 *  - Claude direto (opcional, ANTHROPIC_API_KEY): perguntas operacionais em linguagem natural.
 * A IA nunca publica sinais: propostas voltam ao gestor, que aprova sob os guard rails do servidor.
 */

const SYSTEM_PROMPT = `Você é a FlexIA, assistente interna dos gestores da plataforma Rio Flex — um software de controle inteligente de recarga de veículos elétricos no estado do Rio de Janeiro que recebe sinais de preço do mercado de energia e os repassa aos consumidores, buscando flexibilidade para a rede e uma relação de confiança com quem recarrega.

Como trabalhar:
- Use as ferramentas para obter números; não invente valores. Cite horários locais (UTC-3).
- Preço, rede e clima do Rio Flex são simulados nesta versão; a base de estações é um snapshot público de 22/09/2026.
- Quando o gestor pedir para avisar consumidores, analise e chame propor_sinal_preco. A proposta só é publicada se o gestor aprovar, e o servidor aplica guard rails — diga isso.
- Não exponha dados pessoais de consumidores. Responda em português do Brasil, direto, com markdown leve.`;

const AGENTCORE_PREAMBLE =
  'Contexto: você está sendo consultada pelo painel de gestão do Rio Flex (recarga inteligente de veículos elétricos no RJ). ' +
  'Responda como FlexIA, citando as fontes do data lake e dos documentos.';

const MAX_TOOL_ITERATIONS = 6;
const HISTORY_MESSAGES = 12;

export type StreamEvent =
  | { type: 'meta'; conversationId: string; route: Route; engine: Engine }
  | { type: 'tool'; name: string }
  | { type: 'delta'; text: string }
  | { type: 'proposal'; proposal: SignalProposal }
  | { type: 'done'; meta: MessageMeta }
  | { type: 'error'; message: string };

type Engine = 'agentcore' | 'claude' | 'local';
type MessageMeta = { engine: Engine; route: Route; toolsUsed: string[]; proposal?: SignalProposal; note?: string; ms: number };
type Emit = (e: StreamEvent) => void;

// ---------------------------------------------------------------------------
// Motores
// ---------------------------------------------------------------------------

let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!config.flexia.anthropicApiKey) return null;
  anthropic ??= new Anthropic({ apiKey: config.flexia.anthropicApiKey, maxRetries: 2, timeout: config.flexia.timeoutMs });
  return anthropic;
}

const CLAUDE_TOOLS: Anthropic.Tool[] = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.input_schema as Anthropic.Tool.InputSchema,
}));

async function claudeStream(history: Anthropic.MessageParam[], defaultRegion: string, emit: Emit, signal: AbortSignal) {
  const client = getAnthropic()!;
  const messages = [...history];
  const toolsUsed: string[] = [];
  let proposal: SignalProposal | undefined;
  let text = '';

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const stream = client.messages.stream(
      {
        model: config.flexia.model,
        max_tokens: 16000,
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `Região padrão do gestor: ${defaultRegion}.` },
        ],
        tools: CLAUDE_TOOLS,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        messages,
      } as Anthropic.MessageStreamParams,
      { signal },
    );
    stream.on('text', (delta) => {
      text += delta;
      emit({ type: 'delta', text: delta });
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') {
      const t = '\n\nNão posso ajudar com esse pedido. Reformule focando em operação, preços, rede ou regulação.';
      emit({ type: 'delta', text: t });
      return { text: text + t, toolsUsed, proposal };
    }
    messages.push({ role: 'assistant', content: msg.content });
    const uses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (msg.stop_reason !== 'tool_use' || uses.length === 0) return { text, toolsUsed: [...new Set(toolsUsed)], proposal };

    const results: Anthropic.ToolResultBlockParam[] = uses.map((tu) => {
      toolsUsed.push(tu.name);
      emit({ type: 'tool', name: tu.name });
      const r = runTool(tu.name, tu.input);
      if (r.ok && tu.name === 'propor_sinal_preco') {
        proposal = (r.result as { proposta: SignalProposal }).proposta;
        emit({ type: 'proposal', proposal });
      }
      return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(r.ok ? r.result : { erro: r.error }), is_error: !r.ok };
    });
    messages.push({ role: 'user', content: results });
  }
  return { text, toolsUsed: [...new Set(toolsUsed)], proposal };
}

async function agentCoreStream(prompt: string, sessionId: string, emit: Emit, signal: AbortSignal) {
  const toolsUsed: string[] = [];
  let text = '';
  for await (const ev of invokeFlexiaAgentCore(prompt, sessionId, signal)) {
    if (ev.type === 'delta') {
      text += ev.text;
      emit(ev);
    } else {
      toolsUsed.push(`aws:${ev.name}`);
      emit({ type: 'tool', name: `aws:${ev.name}` });
    }
  }
  return { text, toolsUsed: [...new Set(toolsUsed)] };
}

function localStream(question: string, defaultRegion: string, emit: Emit) {
  const r = localAnswer(question, defaultRegion);
  r.toolsUsed.forEach((name) => emit({ type: 'tool', name }));
  if (r.proposal) emit({ type: 'proposal', proposal: r.proposal });
  emit({ type: 'delta', text: r.text });
  return r;
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

// ---------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------

/**
 * Responde uma mensagem transmitindo eventos. Ordem garantida: meta → (tool|delta|proposal)* → done|error.
 * Qualquer falha de um motor remoto cai no motor local, com aviso — o gestor nunca fica sem resposta.
 */
export async function chatStream(
  userId: string,
  input: { conversationId?: string; message: string },
  defaultRegion: string,
  emit: Emit,
  signal: AbortSignal = new AbortController().signal,
) {
  const t0 = Date.now();
  const now = nowEpoch();
  let conversationId = input.conversationId;
  const isNew = !conversationId;
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

  const route = classify(input.message);
  const region = detectRegion(input.message) ?? defaultRegion;
  const backend = config.flexia.backend;
  // Operacional sempre usa as ferramentas do Rio Flex (Claude direto se houver chave; senão motor local).
  const engine: Engine = route === 'operacional' ? (backend === 'claude' ? 'claude' : 'local') : backend;
  emit({ type: 'meta', conversationId, route, engine });

  let result: { text: string; toolsUsed: string[]; proposal?: SignalProposal };
  let note: string | undefined;
  let used: Engine = engine;
  let streamed = false;
  const tracked: Emit = (e) => {
    if (e.type === 'delta') streamed = true;
    emit(e);
  };

  try {
    if (engine === 'agentcore') {
      const context = route === 'misto' ? `\n\nDados operacionais do Rio Flex para a região (use como contexto; não invente outros valores):\n${operationalContext(region)}` : '';
      const prompt = `${isNew ? AGENTCORE_PREAMBLE + '\n\n' : ''}${input.message}${context}`;
      result = await agentCoreStream(prompt, agentCoreSessionId(conversationId, userId), tracked, signal);
      if (!result.text.trim()) throw new Error('resposta vazia do runtime');
    } else if (engine === 'claude') {
      const msgs: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
      while (msgs.length && msgs[0].role !== 'user') msgs.shift();
      msgs.push({ role: 'user', content: input.message });
      result = await claudeStream(msgs, region, tracked, signal);
    } else {
      result = localStream(input.message, region, tracked);
    }
  } catch (err) {
    if (signal.aborted) {
      emit({ type: 'error', message: 'Resposta cancelada.' });
      return { conversationId };
    }
    log.warn('flexia.engine_failed', { engine, route, ...errorFields(err) });
    note = engine === 'agentcore'
      ? 'A FlexIA na AWS não respondeu agora (credenciais, rede ou tempo limite). Resposta do motor local do Rio Flex.'
      : 'O modelo não respondeu agora. Resposta do motor local do Rio Flex.';
    used = 'local';
    if (streamed) emit({ type: 'delta', text: '\n\n---\n' });
    result = localStream(input.message, region, emit);
  }

  const meta: MessageMeta = { engine: used, route, toolsUsed: result.toolsUsed, proposal: result.proposal, note, ms: Date.now() - t0 };
  run('INSERT INTO flexia_messages (conversation_id, role, content, meta_json, created_at) VALUES (?, ?, ?, ?, ?)',
    conversationId, 'assistant', result.text, JSON.stringify(meta), nowEpoch());
  run('UPDATE flexia_conversations SET updated_at = ? WHERE id = ?', nowEpoch(), conversationId);
  log.info('flexia.answer', { conversationId, route, engine: used, ms: meta.ms, tools: meta.toolsUsed.length });
  emit({ type: 'done', meta });
  return { conversationId, content: result.text, meta };
}

/** Versão sem streaming (compatibilidade e testes): coleta os eventos e devolve a resposta completa. */
export async function chat(userId: string, input: { conversationId?: string; message: string }, defaultRegion: string) {
  let content = '';
  let meta: MessageMeta | undefined;
  let conversationId = input.conversationId ?? '';
  await chatStream(userId, input, defaultRegion, (e) => {
    if (e.type === 'meta') conversationId = e.conversationId;
    if (e.type === 'delta') content += e.text;
    if (e.type === 'done') meta = e.meta;
  });
  return { conversationId, reply: { content, meta } };
}

export function flexiaStatus() {
  const b = config.flexia.backend;
  return {
    engine: b,
    model: b === 'claude' ? config.flexia.model : null,
    runtime: b === 'agentcore' ? config.flexia.runtimeArn?.split('/').pop() ?? null : null,
    routing: 'operacional → ferramentas Rio Flex · setor → FlexIA AWS · misto → FlexIA AWS com contexto operacional',
    tools: TOOLS.map((t) => t.name),
  };
}
