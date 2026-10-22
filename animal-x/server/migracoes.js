import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './config.js';

const PASTA = path.join(RAIZ, 'server/migrations');
// Chave fixa da trava consultiva: só um processo migra por vez.
const TRAVA = 7_274_201;

export async function lerMigracoes(pasta = PASTA) {
  const arquivos = (await readdir(pasta)).filter((a) => /^\d{3}_[\w-]+\.sql$/.test(a)).sort();
  return Promise.all(arquivos.map(async (arquivo) => {
    const sql = await readFile(path.join(pasta, arquivo), 'utf8');
    return {
      id: Number(arquivo.slice(0, 3)),
      nome: arquivo,
      sql,
      sha256: createHash('sha256').update(sql).digest('hex'),
    };
  }));
}

// Aplica as migrações pendentes. Antes, confere se as já aplicadas não foram
// alteradas nem removidas: qualquer divergência interrompe o início.
export async function migrar(pool, { pasta = PASTA, log = () => {} } = {}) {
  const migracoes = await lerMigracoes(pasta);
  const cliente = await pool.connect();
  try {
    await cliente.query('SELECT pg_advisory_lock($1)', [TRAVA]);
    await cliente.query(`CREATE TABLE IF NOT EXISTS migracoes (
      id integer PRIMARY KEY,
      nome text NOT NULL,
      sha256 text NOT NULL,
      aplicada_em timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await cliente.query('SELECT id, nome, sha256 FROM migracoes ORDER BY id');
    const porId = new Map(migracoes.map((m) => [m.id, m]));
    for (const aplicada of rows) {
      const arquivo = porId.get(aplicada.id);
      if (!arquivo) throw new Error(`Migração aplicada ${aplicada.nome} não existe mais no disco.`);
      if (arquivo.sha256 !== aplicada.sha256) {
        throw new Error(`Migração ${aplicada.nome} foi alterada depois de aplicada (SHA-256 diferente).`);
      }
    }
    const aplicadas = new Set(rows.map((r) => r.id));
    const novas = [];
    for (const m of migracoes) {
      if (aplicadas.has(m.id)) continue;
      await cliente.query('BEGIN');
      try {
        await cliente.query(m.sql);
        await cliente.query('INSERT INTO migracoes (id, nome, sha256) VALUES ($1, $2, $3)', [m.id, m.nome, m.sha256]);
        await cliente.query('COMMIT');
      } catch (erro) {
        await cliente.query('ROLLBACK');
        throw new Error(`Falha na migração ${m.nome}: ${erro.message}`);
      }
      novas.push(m.nome);
      log(`Migração aplicada: ${m.nome}`);
    }
    return { total: migracoes.length, novas };
  } finally {
    await cliente.query('SELECT pg_advisory_unlock($1)', [TRAVA]).catch(() => {});
    cliente.release();
  }
}
