import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Megaphone, Plus, Send, Square, Trash2 } from 'lucide-react';
import { ManagerShell } from '@/components/layout/ManagerShell';
import { ErrorBox, LevelBadge, Markdown } from '@/components/common/ui';
import { api, streamPost, type StreamEvent } from '@/lib/api';
import { dateTimeOf } from '@/lib/format';
import type { FlexiaMessage, SignalProposal } from '@/types/api';

const SUGGESTIONS = [
  'Qual o preço da energia agora na capital e as melhores janelas para recarga?',
  'Como está a demanda e a geração renovável hoje? Há risco de pico?',
  'Proponha um sinal de preço para a Região dos Lagos avisando os consumidores.',
  'O que a regulação da ANEEL diz sobre cobrança em eletropostos?',
  'Quais protocolos usar para modular a potência dos carregadores (OCPP, OpenADR)?',
  'Resumo das estações da Baixada: conectores DC e problemas de cadastro.',
];

const ENGINE_LABEL: Record<string, string> = { agentcore: 'FlexIA AWS', claude: 'Claude', local: 'Rio Flex (local)' };

type Conversation = { id: string; title: string; updatedAt: string };

function ProposalCard({ p }: { p: SignalProposal }) {
  const qc = useQueryClient();
  const [done, setDone] = useState<string | null>(null);
  const publish = useMutation({
    mutationFn: () =>
      api.post<{ notifiedConsumers: number }>('/manager/signals', {
        regionId: p.regionId, level: p.level, startsAt: p.startsAt, endsAt: p.endsAt, title: p.title, message: p.message, notifyConsumers: true, origin: 'flexia',
      }),
    onSuccess: (r) => {
      setDone(`Publicado — ${r.notifiedConsumers} consumidor(es) notificado(s).`);
      ['mgr-signals', 'mgr-overview'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
  return (
    <div className="rf-proposal">
      <div className="rf-row" style={{ marginBottom: 6 }}>
        <Megaphone size={14} color="#b98cff" /><b className="rf-strong" style={{ fontSize: 13 }}>Proposta da FlexIA — não publicada. Requer aprovação de um gestor.</b>
      </div>
      <div className="rf-row"><LevelBadge level={p.level} label={p.level} /><span className="rf-small">{p.regionName} · {dateTimeOf(p.startsAt)} → {dateTimeOf(p.endsAt)}</span></div>
      <div className="rf-small" style={{ margin: '6px 0' }}><b className="rf-strong">{p.title}</b> — {p.message}</div>
      <div className="rf-tiny" style={{ marginBottom: 6 }}>Ao publicar, o servidor ainda aplica os guard rails (limites de preço, duração e coerência) e registra você como responsável.</div>
      {done ? <div className="rf-success">{done}</div> : (
        <button type="button" className="rf-btn purple small" disabled={publish.isPending} onClick={() => publish.mutate()}>Aprovar e publicar</button>
      )}
      <ErrorBox error={publish.error} />
    </div>
  );
}

export default function FlexiaPage() {
  const qc = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FlexiaMessage[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery({ queryKey: ['flexia-status'], queryFn: () => api.get<{ engine: string; model: string | null; runtime: string | null; routing: string; tools: string[] }>('/manager/flexia/status') });
  const { data: conversations } = useQuery({ queryKey: ['flexia-convs'], queryFn: () => api.get<Conversation[]>('/manager/flexia/conversations') });

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);

  /** Atualiza a última mensagem do assistente (a que está sendo transmitida). */
  const patchLast = (fn: (m: FlexiaMessage) => FlexiaMessage) =>
    setMessages((all) => {
      const copy = [...all];
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });

  async function sendStream(message: string) {
    setPending(true);
    setError(null);
    const abort = new AbortController();
    abortRef.current = abort;
    setMessages((m) => [...m, { role: 'user', content: message }, { role: 'assistant', content: '', meta: { engine: 'local', toolsUsed: [] } }]);
    try {
      await streamPost('/manager/flexia/chat/stream', { conversationId: conversationId ?? undefined, message }, (e: StreamEvent) => {
        if (e.type === 'meta') {
          setConversationId(e.conversationId as string);
          patchLast((m) => ({ ...m, meta: { ...m.meta!, engine: e.engine as 'local', route: e.route as 'setor' } }));
        } else if (e.type === 'tool') {
          patchLast((m) => ({ ...m, meta: { ...m.meta!, toolsUsed: [...new Set([...(m.meta?.toolsUsed ?? []), e.name as string])] } }));
        } else if (e.type === 'delta') {
          patchLast((m) => ({ ...m, content: m.content + (e.text as string) }));
        } else if (e.type === 'proposal') {
          patchLast((m) => ({ ...m, meta: { ...m.meta!, proposal: e.proposal as SignalProposal } }));
        } else if (e.type === 'done') {
          patchLast((m) => ({ ...m, meta: e.meta as FlexiaMessage['meta'] }));
        } else if (e.type === 'error') {
          setError(new Error(e.message as string));
        }
      }, abort.signal);
    } catch (err) {
      if (!abort.signal.aborted) setError(err);
    } finally {
      setPending(false);
      abortRef.current = null;
      qc.invalidateQueries({ queryKey: ['flexia-convs'] });
    }
  }

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/manager/flexia/conversations/${id}`),
    onSuccess: (_d, id) => {
      if (id === conversationId) newChat();
      qc.invalidateQueries({ queryKey: ['flexia-convs'] });
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  function submit(text = input) {
    const msg = text.trim();
    if (!msg || pending) return;
    setInput('');
    void sendStream(msg);
  }

  async function open(id: string) {
    const c = await api.get<{ id: string; messages: FlexiaMessage[] }>(`/manager/flexia/conversations/${id}`);
    setConversationId(c.id);
    setMessages(c.messages);
  }

  function newChat() {
    setConversationId(null);
    setMessages([]);
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <ManagerShell>
      <div className="rf-page">
        <div className="rf-page-head">
          <div>
            <span className="rf-eyebrow">Agente interno dos gestores</span>
            <h1 className="rf-title">FlexIA</h1>
            <p className="rf-subtitle">Pergunte sobre preços do mercado, demanda, geração, clima, estações, regulação e protocolos. Sinais só são publicados com a sua aprovação.</p>
          </div>
          {status && (
            <span className="rf-badge purple">
              <Bot size={12} /> {status.engine === 'agentcore' ? `FlexIA AWS (AgentCore · ${status.runtime})` : status.engine === 'claude' ? `Claude · ${status.model}` : 'motor local'} + {status.tools.length} ferramentas Rio Flex
            </span>
          )}
        </div>

        <div className="rf-flexia">
          <div className="rf-flexia-side">
            <button type="button" className="rf-btn purple small" onClick={newChat}><Plus size={13} /> Nova conversa</button>
            <div className="rf-eyebrow">Histórico</div>
            {conversations?.length === 0 && <span className="rf-tiny">Nenhuma conversa ainda.</span>}
            {conversations?.map((c) => (
              <div key={c.id} className="rf-row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                <button type="button" className={`rf-flexia-conv ${c.id === conversationId ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => open(c.id)} title={c.title}>
                  {c.title}
                </button>
                <button type="button" className="rf-btn ghost small" title="Excluir conversa" onClick={() => remove.mutate(c.id)}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>

          <div className="rf-flexia-main">
            <div className="rf-flexia-msgs">
              {messages.length === 0 && (
                <div className="rf-stack" style={{ margin: 'auto', maxWidth: 560, textAlign: 'center' }}>
                  <Bot size={30} color="#b98cff" style={{ margin: '0 auto' }} />
                  <div className="rf-strong">Como posso ajudar a operação hoje?</div>
                  <div className="rf-row" style={{ justifyContent: 'center' }}>
                    {SUGGESTIONS.map((s) => <button key={s} type="button" className="rf-chip" onClick={() => submit(s)}>{s}</button>)}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`rf-msg ${m.role}`}>
                  {m.role === 'assistant'
                    ? (m.content ? <Markdown text={m.content} /> : <span className="rf-typing"><span /><span /><span /></span>)
                    : m.content}
                  {m.meta?.proposal && <ProposalCard p={m.meta.proposal} />}
                  {m.meta && (
                    <div className="rf-msg-meta">
                      <span className={`rf-badge ${m.meta.engine === 'agentcore' ? 'purple' : 'gray'}`}>{ENGINE_LABEL[m.meta.engine] ?? m.meta.engine}</span>
                      {m.meta.route && <span className="rf-badge blue">rota: {m.meta.route}</span>}
                      {typeof m.meta.ms === 'number' && <span className="rf-tiny">{(m.meta.ms / 1000).toFixed(1).replace('.', ',')} s</span>}
                      {m.meta.toolsUsed.map((t) => <span key={t} className="rf-badge gray">{t}</span>)}
                      {m.meta.note && <span className="rf-tiny">{m.meta.note}</span>}
                    </div>
                  )}
                </div>
              ))}
              {error ? <ErrorBox error={error} /> : null}
              <div ref={endRef} />
            </div>
            <div className="rf-flexia-input">
              <textarea className="rf-input" placeholder="Pergunte à FlexIA... (Enter envia, Shift+Enter quebra linha)" value={input} maxLength={2000}
                onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} aria-label="Mensagem para a FlexIA" />
              {pending ? (
                <button type="button" className="rf-btn secondary" title="Parar resposta" onClick={() => abortRef.current?.abort()}><Square size={15} /></button>
              ) : (
                <button type="button" className="rf-btn purple" disabled={!input.trim()} onClick={() => submit()}><Send size={15} /></button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ManagerShell>
  );
}
