import { createHash } from 'node:crypto';
import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';
import { config } from '../config.ts';

/**
 * Cliente da FlexIA implantada no Amazon Bedrock AgentCore Runtime (projeto FlexIA: data lake ONS/ANEEL/
 * CCEE/EPE, documentos regulatórios coletados pelo Cavuca, roteador Nemotron + Claude no Bedrock).
 *
 * Contrato do runtime (flexia/app/SINAgent/main.py):
 *   entrada:  payload JSON {"prompt": "..."} + runtimeSessionId (o runtime guarda o histórico por sessão)
 *   saída:    text/event-stream, linhas "data: {evento Strands}"
 *
 * Credenciais: cadeia padrão da AWS (role da instância/tarefa em produção; perfil/variáveis em dev).
 */

export type AgentCoreEvent = { type: 'delta'; text: string } | { type: 'tool'; name: string };

let client: BedrockAgentCoreClient | null = null;
function getClient(arn: string): BedrockAgentCoreClient {
  // A região vem do próprio ARN: o runtime pode estar em região diferente da do restante da conta.
  client ??= new BedrockAgentCoreClient({ region: arn.split(':')[3], maxAttempts: 2 });
  return client;
}

/** O runtime exige IDs de sessão com 33+ caracteres; derivamos um estável por conversa e usuário. */
export function agentCoreSessionId(conversationId: string, userId: string): string {
  return `rioflex-${conversationId}-${createHash('sha256').update(userId).digest('hex').slice(0, 24)}`;
}

/** Converte um evento Strands (contentBlockDelta / contentBlockStart.toolUse) em evento simples. */
export function parseStrandsEvent(raw: unknown): AgentCoreEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const ev = (raw as { event?: Record<string, any> }).event;
  if (!ev) return null;
  const text = ev.contentBlockDelta?.delta?.text;
  if (typeof text === 'string' && text) return { type: 'delta', text };
  const tool = ev.contentBlockStart?.start?.toolUse?.name;
  if (typeof tool === 'string') return { type: 'tool', name: tool };
  return null;
}

/** Quebra um fluxo SSE em eventos, tolerando pedaços de linha divididos entre chunks. */
export async function* sseEvents(stream: AsyncIterable<Uint8Array | string>): AsyncGenerator<AgentCoreEvent> {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of stream) {
    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      try {
        const parsed = parseStrandsEvent(JSON.parse(line.slice(5).trim()));
        if (parsed) yield parsed;
      } catch {
        // linha de controle ou JSON parcial: ignora
      }
    }
  }
}

export async function* invokeFlexiaAgentCore(prompt: string, sessionId: string, signal?: AbortSignal): AsyncGenerator<AgentCoreEvent> {
  const arn = config.flexia.runtimeArn;
  if (!arn) throw new Error('FLEXIA_RUNTIME_ARN não configurado');
  const resp = await getClient(arn).send(
    new InvokeAgentRuntimeCommand({
      agentRuntimeArn: arn,
      runtimeSessionId: sessionId,
      contentType: 'application/json',
      accept: 'text/event-stream',
      payload: Buffer.from(JSON.stringify({ prompt })),
    }),
    { abortSignal: signal },
  );
  if (!resp.response) return;
  yield* sseEvents(resp.response as unknown as AsyncIterable<Uint8Array>);
}
