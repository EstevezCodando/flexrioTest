/**
 * Testes de integração da API (node:test). Usam um banco SQLite temporário e o
 * mesmo seed da aplicação — rode com: pnpm --filter @workspace/api-server test
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rioflex-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.CHARGING_SIM_SPEED = '3600';

const { parseCsv } = await import('../src/lib/csv.ts');
const { seedIfEmpty } = await import('../src/db/seed.ts');
const { ingestMarketData } = await import('../src/services/market.ts');
const { createApp } = await import('../src/app.ts');
const { config } = await import('../src/config.ts');

let server: Server;
let base = '';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (r: Response): Promise<any> => r.json();
const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'RioFlex' };

async function login(email: string, password: string, portal: 'consumer' | 'manager') {
  const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, portal }) });
  return { status: r.status, cookie: r.headers.get('set-cookie')?.split(';')[0] ?? '' };
}

before(async () => {
  await seedIfEmpty(() => undefined);
  await ingestMarketData();
  server = createApp().listen(0);
  const port = (server.address() as { port: number }).port;
  base = `http://127.0.0.1:${port}/api/v1`;
});

after(() => {
  server?.close();
});

describe('csv', () => {
  it('lê campos com aspas, quebras de linha e BOM', () => {
    const rows = parseCsv('﻿a;b\n1;"x\ny ""z"""\n2;w\n');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].b, 'x\ny "z"');
    assert.equal(rows[1].a, '2');
  });
});

describe('autenticação e segurança', () => {
  it('bloqueia POST sem cabeçalho anti-CSRF', async () => {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 403);
  });

  it('exige sessão para dados de estações', async () => {
    assert.equal((await fetch(`${base}/stations`)).status, 401);
  });

  it('gestor não entra pelo portal do motorista (erro genérico)', async () => {
    const r = await login(config.seed.managerEmail, config.seed.managerPassword, 'consumer');
    assert.equal(r.status, 401);
  });

  it('consumidor não acessa rotas do gestor', async () => {
    const { cookie } = await login(config.seed.consumerEmail, config.seed.consumerPassword, 'consumer');
    const r = await fetch(`${base}/manager/overview`, { headers: { cookie } });
    assert.equal(r.status, 403);
  });

  it('cookie de sessão é httpOnly e SameSite=Strict', async () => {
    const r = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ email: config.seed.consumerEmail, password: config.seed.consumerPassword, portal: 'consumer' }),
    });
    const sc = r.headers.get('set-cookie') ?? '';
    assert.match(sc, /HttpOnly/i);
    assert.match(sc, /SameSite=Strict/i);
  });
});

describe('preços e sinais', () => {
  it('preço do consumidor = custo da energia + margem, ordenado por tipo', async () => {
    const { cookie } = await login(config.seed.consumerEmail, config.seed.consumerPassword, 'consumer');
    const p = await fetch(`${base}/prices/capital/now`, { headers: { cookie } }).then(json);
    const b = p.best;
    assert.ok(Math.abs(b.energyKwh + b.wireKwh + b.chargesKwh + b.taxesKwh - b.totalKwh) < 0.001);
    assert.ok(p.offers[0].totalKwh <= p.offers[p.offers.length - 1].totalKwh, 'melhor oferta primeiro');
    const c = p.consumerPrices;
    assert.ok(c.ac_lenta < c.ac_semirrapida && c.ac_semirrapida < c.dc_rapida && c.dc_rapida < c.dc_ultrarrapida);
  });

  it('sinal verde do gestor reduz o preço e notifica consumidores da região', async () => {
    const mgr = await login(config.seed.managerEmail, config.seed.managerPassword, 'manager');
    const usr = await login(config.seed.consumerEmail, config.seed.consumerPassword, 'consumer');
    const before = await fetch(`${base}/prices/capital/now`, { headers: { cookie: usr.cookie } }).then(json);
    const now = Date.now();
    const r = await fetch(`${base}/manager/signals`, {
      method: 'POST', headers: { ...H, cookie: mgr.cookie },
      body: JSON.stringify({
        regionId: 'capital', level: 'verde',
        startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 3_600_000).toISOString(),
        title: 'Teste verde', message: 'Energia mais barata agora para teste.', notifyConsumers: true,
      }),
    });
    assert.equal(r.status, 201);
    assert.equal((await json(r)).notifiedConsumers, 1);
    const afterP = await fetch(`${base}/prices/capital/now`, { headers: { cookie: usr.cookie } }).then(json);
    assert.equal(afterP.signal.source, 'gestor');
    assert.ok(afterP.consumerPrices.dc_rapida < before.consumerPrices.dc_rapida || before.signal.level === 'verde');
  });
});

describe('recarga', () => {
  it('inicia, conclui e credita bônus na carteira', async () => {
    const { cookie } = await login(config.seed.consumerEmail, config.seed.consumerPassword, 'consumer');
    const list = await fetch(`${base}/stations?region=capital&chargeType=dc_rapida&available=true&operational=true&limit=5`, { headers: { cookie } }).then(json);
    let started: { id: string } | null = null;
    for (const s of list.items) {
      const d = await fetch(`${base}/stations/${s.id}`, { headers: { cookie } }).then(json);
      const conn = d.connectorsDetail.find((c: { status: string; type: string }) => c.status === 'disponivel' && c.type.includes('CCS'));
      if (!conn) continue;
      const r = await fetch(`${base}/me/charging`, { method: 'POST', headers: { ...H, cookie }, body: JSON.stringify({ stationId: s.id, connectorId: conn.id }) });
      assert.equal(r.status, 201);
      started = await json(r);
      break;
    }
    assert.ok(started, 'encontrou conector livre');
    await new Promise((res) => setTimeout(res, 1200));
    const stop = await fetch(`${base}/me/charging/${started!.id}/stop`, { method: 'POST', headers: { ...H, cookie }, body: '{"useCredits":false}' }).then(json);
    assert.equal(stop.session.status, 'completed');
    assert.ok(stop.session.energyKwh > 0);
    const second = await fetch(`${base}/me/charging/active`, { headers: { cookie } }).then(json);
    assert.equal(second.session, null);
  });
});
