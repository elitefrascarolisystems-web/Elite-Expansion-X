// Aplica as migrações pendentes no PostgreSQL de DATABASE_URL.
import pg from 'pg';
import { lerConfig } from '../server/config.js';
import { migrar } from '../server/migracoes.js';

const config = lerConfig();
if (!config.bancoUrl) {
  console.error('Defina DATABASE_URL.');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: config.bancoUrl });
try {
  const r = await migrar(pool, { log: console.log });
  console.log(`${r.total} migrações conferidas; ${r.novas.length} aplicadas agora.`);
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
