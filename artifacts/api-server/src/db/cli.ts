import { resetDatabase, seedIfEmpty } from './seed.ts';
import { ingestMarketData } from '../services/market.ts';

const cmd = process.argv[2];

if (cmd === 'reset') {
  resetDatabase();
  console.log('[db] Tabelas limpas.');
}
if (cmd === 'reset' || cmd === 'seed') {
  await seedIfEmpty();
  const n = await ingestMarketData();
  console.log(`[db] ${n} preços horários de mercado ingeridos.`);
} else {
  console.log('Uso: tsx src/db/cli.ts <seed|reset>');
}
