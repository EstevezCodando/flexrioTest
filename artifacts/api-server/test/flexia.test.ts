/** Testes unitários da integração FlexIA (sem rede): roteamento e parser SSE do AgentCore. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rioflex-flexia-')), 'x.db');

const { classify } = await import('../src/flexia/router.ts');
const { agentCoreSessionId, parseStrandsEvent, sseEvents } = await import('../src/flexia/agentcore.ts');

describe('roteador da FlexIA', () => {
  it('pergunta operacional do Rio Flex fica nas ferramentas locais', () => {
    assert.equal(classify('Proponha um sinal de preço para a Região dos Lagos'), 'operacional');
    assert.equal(classify('Quantas estações DC livres há na capital?'), 'operacional');
  });
  it('pergunta do setor vai para a FlexIA da AWS', () => {
    assert.equal(classify('Qual foi a carga do SIN no subsistema Sudeste em agosto?'), 'setor');
    assert.equal(classify('O que diz a Lei 14.300 sobre compensação?'), 'setor');
  });
  it('pergunta que cruza os dois vira mista', () => {
    assert.equal(classify('Com a hidrologia do ONS, devo publicar um sinal vermelho na capital?'), 'misto');
  });
});

describe('cliente AgentCore', () => {
  it('ID de sessão é estável e tem 33+ caracteres (exigência do runtime)', () => {
    const a = agentCoreSessionId('cnv_abc123', 'usr_x');
    assert.ok(a.length >= 33);
    assert.equal(a, agentCoreSessionId('cnv_abc123', 'usr_x'));
    assert.notEqual(a, agentCoreSessionId('cnv_abc123', 'usr_y'));
  });

  it('converte eventos Strands em texto e ferramenta', () => {
    assert.deepEqual(parseStrandsEvent({ event: { contentBlockDelta: { delta: { text: 'Olá' } } } }), { type: 'delta', text: 'Olá' });
    assert.deepEqual(parseStrandsEvent({ event: { contentBlockStart: { start: { toolUse: { name: 'consultar_sql' } } } } }), { type: 'tool', name: 'consultar_sql' });
    assert.equal(parseStrandsEvent({ event: { messageStop: {} } }), null);
  });

  it('lê SSE com linhas quebradas entre chunks e ignora lixo', async () => {
    const enc = new TextEncoder();
    const full =
      'data: {"event":{"contentBlockStart":{"start":{"toolUse":{"name":"buscar_documentos"}}}}}\n\n' +
      ': ping\n\n' +
      'data: {"event":{"contentBlockDelta":{"delta":{"text":"Resposta "}}}}\n' +
      'data: {"event":{"contentBlockDelta":{"delta":{"text":"final"}}}}\n' +
      'data: {json quebrado\n';
    async function* chunks() {
      for (let i = 0; i < full.length; i += 7) yield enc.encode(full.slice(i, i + 7));
    }
    const out = [];
    for await (const e of sseEvents(chunks())) out.push(e);
    assert.deepEqual(out, [
      { type: 'tool', name: 'buscar_documentos' },
      { type: 'delta', text: 'Resposta ' },
      { type: 'delta', text: 'final' },
    ]);
  });
});
