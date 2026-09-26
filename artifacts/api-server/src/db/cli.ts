import { importProvenanceIfMissing, resetDatabase, seedIfEmpty } from './seed.ts';
import { ingestMarketData } from '../services/market.ts';

const cmd = process.argv[2];

if (cmd === 'backup') {
  // Cópia consistente do banco em uso (sem parar a API), via VACUUM INTO.
  const { db } = await import('./index.ts');
  const path = await import('node:path');
  const fs = await import('node:fs');
  const { config } = await import('../config.ts');
  const dir = path.join(path.dirname(config.dbPath), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `rioflex-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  db.prepare('VACUUM INTO ?').run(file);
  console.log(`[db] backup: ${file}`);
  process.exit(0);
}
if (cmd === 'reset') {
  resetDatabase();
  console.log('[db] Tabelas limpas.');
}
if (cmd === 'reset' || cmd === 'seed') {
  await seedIfEmpty();
  importProvenanceIfMissing();
  const n = await ingestMarketData();
  console.log(`[db] ${n} preços horários de mercado ingeridos.`);
} else {
  console.log('Uso: tsx src/db/cli.ts <seed|reset|backup>');
}
