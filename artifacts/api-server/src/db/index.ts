import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { config } from '../config.ts';

/**
 * Schema versionado. Cada entrada é aplicada uma única vez (tabela schema_migrations).
 * Para evoluir o banco, acrescente uma nova migração ao final — nunca edite as antigas.
 */
const MIGRATIONS: { id: number; sql: string }[] = [
  {
    id: 1,
    sql: `
    CREATE TABLE regions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      distributor TEXT NOT NULL,
      submarket TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      tusd_kwh REAL NOT NULL,
      base_demand_mw REAL NOT NULL,
      base_temp_c REAL NOT NULL
    );

    CREATE TABLE municipalities (
      name_norm TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      region_id TEXT NOT NULL REFERENCES regions(id)
    );

    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('consumer','manager')),
      region_id TEXT REFERENCES regions(id),
      vehicle_json TEXT,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      ip TEXT,
      user_agent TEXT
    );
    CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);

    CREATE TABLE stations (
      id INTEGER PRIMARY KEY,
      snapshot_id TEXT NOT NULL,
      name TEXT NOT NULL,
      city TEXT,
      region_id TEXT NOT NULL REFERENCES regions(id),
      address TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      access TEXT,
      is_public INTEGER NOT NULL,
      maintenance INTEGER NOT NULL,
      inactive INTEGER NOT NULL,
      under_construction INTEGER NOT NULL,
      charge_group TEXT,
      network TEXT,
      place_type TEXT,
      max_power_kw REAL,
      avg_power_kw REAL,
      published_price_kwh REAL,
      activation_fee REAL,
      price_label TEXT,
      price_conflict INTEGER NOT NULL,
      opening_hours TEXT,
      source_url TEXT,
      updated_at TEXT
    );
    CREATE INDEX idx_stations_region ON stations(region_id);
    CREATE INDEX idx_stations_latlng ON stations(lat, lng);

    CREATE TABLE connectors (
      id INTEGER PRIMARY KEY,
      station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      evse_id INTEGER NOT NULL,
      type_name TEXT NOT NULL,
      current TEXT NOT NULL CHECK (current IN ('AC','DC')),
      power_kw REAL NOT NULL,
      power_known INTEGER NOT NULL,
      charge_type TEXT NOT NULL
    );
    CREATE INDEX idx_connectors_station ON connectors(station_id);

    CREATE TABLE station_quality (
      station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      note TEXT,
      PRIMARY KEY (station_id, code)
    );

    CREATE TABLE market_prices (
      submarket TEXT NOT NULL,
      hour_epoch INTEGER NOT NULL,
      pld_mwh REAL NOT NULL,
      source TEXT NOT NULL,
      ingested_at INTEGER NOT NULL,
      PRIMARY KEY (submarket, hour_epoch)
    );

    CREATE TABLE suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      product TEXT NOT NULL,
      spread_kwh REAL NOT NULL,
      tusd_discount REAL NOT NULL,
      peak_premium_kwh REAL NOT NULL DEFAULT 0,
      window_start INTEGER,
      window_end INTEGER,
      regions TEXT
    );

    CREATE TABLE price_signals (
      id TEXT PRIMARY KEY,
      region_id TEXT NOT NULL REFERENCES regions(id),
      level TEXT NOT NULL CHECK (level IN ('verde','amarelo','vermelho')),
      starts_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      multiplier REAL NOT NULL,
      credit_bonus_kwh REAL NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      cancelled_at INTEGER
    );
    CREATE INDEX idx_signals_region_time ON price_signals(region_id, starts_at, ends_at);

    CREATE TABLE price_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      region_id TEXT NOT NULL REFERENCES regions(id),
      station_id INTEGER REFERENCES stations(id),
      charge_type TEXT NOT NULL,
      max_price_kwh REAL,
      notify_green_window INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      last_triggered_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_alerts_active ON price_alerts(active);
    CREATE INDEX idx_alerts_user ON price_alerts(user_id);

    CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data_json TEXT,
      created_at INTEGER NOT NULL,
      read_at INTEGER
    );
    CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

    CREATE TABLE charging_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      station_id INTEGER NOT NULL REFERENCES stations(id),
      connector_id INTEGER NOT NULL REFERENCES connectors(id),
      status TEXT NOT NULL CHECK (status IN ('active','completed','cancelled')),
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      start_soc REAL NOT NULL,
      target_soc REAL NOT NULL,
      battery_kwh REAL NOT NULL,
      power_kw REAL NOT NULL,
      price_kwh REAL NOT NULL,
      signal_level TEXT NOT NULL,
      flex_accepted INTEGER NOT NULL DEFAULT 0,
      energy_kwh REAL,
      cost REAL,
      credits REAL
    );
    CREATE INDEX idx_charging_user ON charging_sessions(user_id, started_at DESC);
    CREATE UNIQUE INDEX idx_charging_one_active ON charging_sessions(user_id) WHERE status = 'active';

    CREATE TABLE wallet_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      description TEXT NOT NULL,
      ref TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_ledger_user ON wallet_ledger(user_id, created_at DESC);

    CREATE TABLE flexia_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE flexia_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL REFERENCES flexia_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant')),
      content TEXT NOT NULL,
      meta_json TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_flexia_msgs ON flexia_messages(conversation_id, id);

    CREATE TABLE audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      action TEXT NOT NULL,
      detail TEXT,
      ip TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_audit_time ON audit_log(created_at DESC);
    `,
  },
  {
    // SOC e horário originais da sessão (os campos start_* passam a marcar o segmento atual após modulação).
    id: 2,
    sql: `
    ALTER TABLE charging_sessions ADD COLUMN initial_soc REAL;
    ALTER TABLE charging_sessions ADD COLUMN initial_started_at INTEGER;
    UPDATE charging_sessions SET initial_soc = start_soc, initial_started_at = started_at WHERE initial_soc IS NULL;
    `,
  },
];

function openDatabase(): DatabaseSync {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const database = new DatabaseSync(config.dbPath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
  `);
  const applied = new Set(
    (database.prepare('SELECT id FROM schema_migrations').all() as { id: number }[]).map((r) => r.id),
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    database.exec('BEGIN');
    try {
      database.exec(m.sql);
      database.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(m.id, Date.now());
      database.exec('COMMIT');
    } catch (err) {
      database.exec('ROLLBACK');
      throw err;
    }
  }
  return database;
}

export const db = openDatabase();

/** Cache de prepared statements — evita recompilar SQL a cada requisição. */
const stmtCache = new Map<string, ReturnType<DatabaseSync['prepare']>>();
function stmt(sql: string) {
  let s = stmtCache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    stmtCache.set(sql, s);
  }
  return s;
}

type Params = SQLInputValue[] | [Record<string, SQLInputValue>];

export function all<T>(sql: string, ...params: Params): T[] {
  return stmt(sql).all(...(params as SQLInputValue[])) as T[];
}

export function get<T>(sql: string, ...params: Params): T | undefined {
  return stmt(sql).get(...(params as SQLInputValue[])) as T | undefined;
}

export function run(sql: string, ...params: Params) {
  return stmt(sql).run(...(params as SQLInputValue[]));
}

let txDepth = 0;
/** Executa `fn` em transação (reentrante: transações aninhadas são absorvidas pela externa). */
export function transaction<T>(fn: () => T): T {
  if (txDepth > 0) return fn();
  txDepth++;
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    txDepth--;
  }
}

export function audit(userId: string | null, action: string, detail: string | null, ip?: string | null) {
  run('INSERT INTO audit_log (user_id, action, detail, ip, created_at) VALUES (?, ?, ?, ?, ?)', userId, action, detail, ip ?? null, Math.floor(Date.now() / 1000));
}
