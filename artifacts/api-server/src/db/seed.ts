import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.ts';
import { CHARGE_TYPE_INFO, REGIONS, SUPPLIERS, type ChargeType } from '../domain/reference.ts';
import { bool, num, readCsv } from '../lib/csv.ts';
import { hashPassword, newId } from '../lib/crypto.ts';
import { haversineKm, HOUR, hourStart, normalizeText, nowEpoch } from '../lib/util.ts';
import { createHash } from 'node:crypto';
import { all, db, get, run, transaction } from './index.ts';

export const PROCESSING_VERSION = 'etl-import-v1';

const DC_TYPES = /ccs|chademo|gb\/t \(fast\)|dc/i;

export function classifyChargeType(current: 'AC' | 'DC', powerKw: number): ChargeType {
  if (current === 'AC') return powerKw > 7.4 ? 'ac_semirrapida' : 'ac_lenta';
  return powerKw > 100 ? 'dc_ultrarrapida' : 'dc_rapida';
}

function inferCurrent(typeName: string, inferred: string): 'AC' | 'DC' {
  if (inferred === 'AC' || inferred === 'DC') return inferred;
  return DC_TYPES.test(typeName) ? 'DC' : 'AC';
}

function regionFor(city: string, lat: number, lng: number, byCity: Map<string, string>): string {
  const byName = byCity.get(normalizeText(city));
  if (byName) return byName;
  let best = REGIONS[0];
  let bestD = Infinity;
  for (const r of REGIONS) {
    const d = haversineKm(lat, lng, r.lat, r.lng);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best.id;
}

function seedReference() {
  for (const r of REGIONS) {
    run(
      `INSERT OR REPLACE INTO regions (id, name, distributor, submarket, lat, lng, tusd_kwh, base_demand_mw, base_temp_c)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      r.id, r.name, r.distributor, r.submarket, r.lat, r.lng, r.tusdKwh, r.baseDemandMw, r.baseTempC,
    );
    for (const m of r.municipalities) {
      run('INSERT OR REPLACE INTO municipalities (name_norm, name, region_id) VALUES (?, ?, ?)', normalizeText(m), m, r.id);
    }
  }
  for (const s of SUPPLIERS) {
    run(
      `INSERT OR REPLACE INTO suppliers (id, name, product, spread_kwh, tusd_discount, peak_premium_kwh, window_start, window_end, regions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      s.id, s.name, s.product, s.spreadKwh, s.tusdDiscount, s.peakPremiumKwh,
      s.window?.[0] ?? null, s.window?.[1] ?? null, s.regions ? s.regions.join(',') : null,
    );
  }
}

/** Importa a base pública coletada (carregados_rj) para as tabelas stations/connectors. */
function importStations(): { stations: number; connectors: number } {
  const dir = config.datasetDir;
  const locaisPath = path.join(dir, 'locais.csv');
  if (!fs.existsSync(locaisPath)) throw new Error(`Base de carregadores não encontrada em ${dir}`);

  const byCity = new Map(REGIONS.flatMap((r) => r.municipalities.map((m) => [normalizeText(m), r.id] as const)));
  const locais = readCsv(locaisPath);
  const conectores = readCsv(path.join(dir, 'conectores.csv'));
  const qualidade = fs.existsSync(path.join(dir, 'qualidade.csv')) ? readCsv(path.join(dir, 'qualidade.csv')) : [];

  let nStations = 0;
  let nConnectors = 0;
  const ids = new Set<number>();

  for (const l of locais) {
    const id = num(l.local_id);
    const lat = num(l.latitude);
    const lng = num(l.longitude);
    if (id === null || lat === null || lng === null) continue;
    ids.add(id);
    const city = l.cidade?.trim() || '';
    run(
      `INSERT OR REPLACE INTO stations (id, snapshot_id, name, city, region_id, address, lat, lng, access, is_public, maintenance,
        inactive, under_construction, charge_group, network, place_type, max_power_kw, avg_power_kw, published_price_kwh,
        activation_fee, price_label, price_conflict, opening_hours, source_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, l.snapshot_id, l.nome.trim(), city || null, regionFor(city, lat, lng, byCity), l.endereco || null, lat, lng,
      l.acesso_publicado || null, bool(l.publico) ? 1 : 0, bool(l.manutencao_no_cartao) ? 1 : 0, bool(l.inativo) ? 1 : 0,
      bool(l.nome_indica_obra_ou_futuro) ? 1 : 0, l.grupo_recarga || null, l.redes || null, l.tipo_local || null,
      num(l.potencia_max_conector_kW), num(l.potencia_media_relatada_kW), num(l.preco_kWh_R), num(l.taxa_ativacao_R),
      l.classificacao_preco || null, bool(l.conflito_gratuito_pago) || bool(l.conflito_descricao_preco) ? 1 : 0,
      l.horario?.slice(0, 200) || null, l.url || null, l.cadastro_atualizado_em || null,
    );
    nStations++;
  }

  for (const c of conectores) {
    const id = num(c.conector_id);
    const stationId = num(c.local_id);
    if (id === null || stationId === null || !ids.has(stationId)) continue;
    const typeName = c.tipo_nome?.trim() || 'Desconhecido';
    const current = inferCurrent(typeName, c.corrente_inferida);
    const nominal = num(c.potencia_nominal_kW);
    const power = nominal ?? CHARGE_TYPE_INFO[current === 'AC' ? 'ac_lenta' : 'dc_rapida'].typicalKw;
    run(
      `INSERT OR REPLACE INTO connectors (id, station_id, evse_id, type_name, current, power_kw, power_known, charge_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id, stationId, num(c.evse_id) ?? 0, typeName, current, power, nominal === null ? 0 : 1, classifyChargeType(current, power),
    );
    nConnectors++;
  }

  for (const q of qualidade) {
    const stationId = num(q.local_id);
    if (stationId === null || !ids.has(stationId)) continue;
    run('INSERT OR IGNORE INTO station_quality (station_id, code, note) VALUES (?, ?, ?)', stationId, q.codigo, q.observacao || null);
  }

  return { stations: nStations, connectors: nConnectors };
}

async function seedUsers() {
  const now = nowEpoch();
  const consumerId = 'usr_demo_consumer';
  const managerId = 'usr_demo_manager';
  const vehicle = {
    manufacturer: 'BYD', model: 'Dolphin GS', batteryKwh: 44.9, soc: 62, targetSoc: 80,
    connector: 'CCS2', maxDcKw: 80, maxAcKw: 7, rangeKm: 210,
  };

  run(
    `INSERT INTO users (id, email, name, password_hash, role, region_id, vehicle_json, created_at)
     VALUES (?, ?, ?, ?, 'consumer', 'capital', ?, ?)`,
    consumerId, config.seed.consumerEmail, 'Marcos Silva', await hashPassword(config.seed.consumerPassword), JSON.stringify(vehicle), now,
  );
  run(
    `INSERT INTO users (id, email, name, password_hash, role, region_id, vehicle_json, created_at)
     VALUES (?, ?, ?, ?, 'manager', 'capital', NULL, ?)`,
    managerId, config.seed.managerEmail, 'Helena Costa (Operação)', await hashPassword(config.seed.managerPassword), now,
  );

  // Histórico de recargas e créditos do consumidor de demonstração.
  const dcConnectors = all<{ id: number; station_id: number; power_kw: number }>(
    `SELECT c.id, c.station_id, c.power_kw FROM connectors c JOIN stations s ON s.id = c.station_id
     WHERE s.region_id = 'capital' AND c.current = 'DC' AND s.is_public = 1 AND s.maintenance = 0
     ORDER BY s.id LIMIT 4`,
  );
  const history = [
    { daysAgo: 1, kwh: 21.7, price: 1.95, level: 'verde', credits: 4.0, desc: 'Bônus janela verde' },
    { daysAgo: 13, kwh: 18.2, price: 1.88, level: 'verde', credits: 4.5, desc: 'Bônus excedente solar' },
    { daysAgo: 21, kwh: 16.8, price: 2.21, level: 'amarelo', credits: 2.5, desc: 'Bônus modulação de demanda' },
    { daysAgo: 28, kwh: 14.1, price: 1.99, level: 'verde', credits: 3.0, desc: 'Bônus janela verde' },
  ];
  history.forEach((h, i) => {
    const conn = dcConnectors[i % Math.max(1, dcConnectors.length)];
    if (!conn) return;
    const start = hourStart(now - h.daysAgo * 86400) - 5 * HOUR;
    const sid = newId('chg');
    run(
      `INSERT INTO charging_sessions (id, user_id, station_id, connector_id, status, started_at, ended_at, start_soc, target_soc,
        battery_kwh, power_kw, price_kwh, signal_level, flex_accepted, energy_kwh, cost, credits, initial_soc, initial_started_at)
       VALUES (?, ?, ?, ?, 'completed', ?, ?, 30, 80, 44.9, ?, ?, ?, ?, ?, ?, ?, 30, ?)`,
      sid, consumerId, conn.station_id, conn.id, start, start + 40 * 60, Math.min(conn.power_kw, 80), h.price, h.level,
      h.level === 'amarelo' ? 1 : 0, h.kwh, Math.round(h.kwh * h.price * 100) / 100, h.credits, start,
    );
    run('INSERT INTO wallet_ledger (id, user_id, amount_cents, description, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      newId('led'), consumerId, Math.round(h.credits * 100), h.desc, sid, start + 40 * 60);
  });
  run('INSERT INTO wallet_ledger (id, user_id, amount_cents, description, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    newId('led'), consumerId, 840, 'Bônus de boas-vindas Rio Flex', null, now - 30 * 86400);
  run('INSERT INTO wallet_ledger (id, user_id, amount_cents, description, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    newId('led'), consumerId, -1000, 'Abatimento automático em recarga', null, now - 17 * 86400);

  run(
    `INSERT INTO price_alerts (id, user_id, region_id, station_id, charge_type, max_price_kwh, notify_green_window, active, created_at)
     VALUES (?, ?, 'capital', NULL, 'dc_rapida', 2.6, 1, 1, ?)`,
    newId('alr'), consumerId, now,
  );
  run(
    `INSERT INTO notifications (id, user_id, kind, title, body, data_json, created_at)
     VALUES (?, ?, 'system', 'Bem-vindo ao Rio Flex', 'Configure alertas de preço para ser avisado das janelas verdes na sua região.', NULL, ?)`,
    newId('ntf'), consumerId, now,
  );
}

export async function seedIfEmpty(log = console.log): Promise<void> {
  const hasStations = get<{ n: number }>('SELECT COUNT(*) AS n FROM stations')?.n ?? 0;
  if (hasStations > 0) return;
  log('[seed] Banco vazio — importando referência e base carregados_rj...');
  const counts = transaction(() => {
    seedReference();
    return importStations();
  });
  // hash de senha é assíncrono; usuários entram em transação própria
  db.exec('BEGIN');
  try {
    await seedUsers();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  log(`[seed] ${counts.stations} estações e ${counts.connectors} conectores importados; usuários de demonstração criados.`);
}

export function resetDatabase() {
  db.exec('PRAGMA foreign_keys = OFF');
  const tables = all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations'",
  );
  transaction(() => {
    for (const t of tables) db.exec(`DELETE FROM "${t.name}"`);
  });
  db.exec('PRAGMA foreign_keys = ON');
}

type ManifestEntry = {
  local_id: number;
  arquivo: string;
  sha256: string;
  url: string;
  coletado_em: string;
  http_status: number;
  sha256_resposta: string;
  ferramenta: string;
};

/**
 * Importa o manifesto de proveniência da coleta (URL, data, hashes por página) para o banco,
 * de forma idempotente. É o elo "estação exibida → fonte original" da rastreabilidade.
 */
export function importProvenanceIfMissing(log = console.log): void {
  const manifestPath = path.join(config.datasetDir, 'manifesto.json');
  if (!fs.existsSync(manifestPath)) return;
  const raw = fs.readFileSync(manifestPath);
  const manifestHash = createHash('sha256').update(raw).digest('hex');
  const snapshotId = get<{ snapshot_id: string }>('SELECT snapshot_id FROM stations LIMIT 1')?.snapshot_id;
  if (!snapshotId) return;
  if (get('SELECT 1 FROM dataset_snapshots WHERE snapshot_id = ? AND manifest_sha256 = ?', snapshotId, manifestHash)) return;

  const entries = JSON.parse(raw.toString('utf8')) as ManifestEntry[];
  const readJson = (name: string) => {
    const f = path.join(config.datasetDir, name);
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  };
  const times = entries.map((e) => e.coletado_em).sort();
  transaction(() => {
    run(
      `INSERT OR REPLACE INTO dataset_snapshots (snapshot_id, source, source_url, tool, collected_from, collected_to, records,
        summary_json, validation_json, manifest_sha256, imported_at, processing_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      snapshotId, 'Carregados (cadastros públicos de estações de recarga)', 'https://carregados.com.br/estacoes?estado=rio+de+janeiro+%28rj%29',
      entries[0]?.ferramenta ?? 'Cavuca', times[0] ?? null, times[times.length - 1] ?? null, entries.length,
      readJson('resumo.json'), readJson('validacao.json'), manifestHash, Math.floor(Date.now() / 1000), PROCESSING_VERSION,
    );
    for (const e of entries) {
      run(
        `INSERT OR REPLACE INTO source_records (snapshot_id, station_id, url, retrieved_at, http_status, raw_extract_sha256, response_sha256, tool)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        snapshotId, e.local_id, e.url, e.coletado_em, e.http_status, e.sha256, e.sha256_resposta, e.ferramenta,
      );
    }
  });
  log(`[seed] Proveniência importada: ${entries.length} registros de origem (manifesto sha256 ${manifestHash.slice(0, 12)}…).`);
}
