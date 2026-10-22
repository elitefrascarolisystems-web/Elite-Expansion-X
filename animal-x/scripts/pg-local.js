// PostgreSQL local embutido para desenvolvimento e demonstração persistente.
// Cria o cluster em data/pg na primeira vez e o inicia na porta 54329.
// Uso: npm run db:local   (depois: DATABASE_URL=... npm start)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from '../server/config.js';

const PORTA = Number(process.env.ANIMALX_PG_PORTA ?? 54329);
const pasta = path.join(RAIZ, 'data/pg');

function binario(nome) {
  try {
    return execFileSync('which', [nome], { encoding: 'utf8' }).trim() || null;
  } catch {
    for (const base of ['/usr/lib/postgresql', '/opt/homebrew/opt', '/usr/local/opt']) {
      if (!existsSync(base)) continue;
      for (const versao of readdirSync(base).sort().reverse()) {
        const caminho = path.join(base, versao, 'bin', nome);
        if (existsSync(caminho)) return caminho;
      }
    }
    return null;
  }
}

if (process.getuid?.() === 0) {
  console.error('O PostgreSQL não roda como root. Use um usuário comum (os testes usam o usuário postgres do sistema).');
  process.exit(1);
}
const initdb = binario('initdb');
const pgCtl = binario('pg_ctl');
if (!initdb || !pgCtl) {
  console.error('PostgreSQL não encontrado (initdb e pg_ctl). Instale o PostgreSQL 16 ou use o modo em memória.');
  process.exit(1);
}
if (!existsSync(path.join(pasta, 'PG_VERSION'))) {
  execFileSync(initdb, ['-D', pasta, '-U', 'animalx', '--auth=trust', '-E', 'UTF8', '--no-locale'], { stdio: 'inherit' });
}
const opcoes = `-p ${PORTA} -k ${pasta} -c listen_addresses=127.0.0.1`;
try {
  execFileSync(pgCtl, ['-D', pasta, 'status'], { stdio: 'ignore' });
  console.log('PostgreSQL local já está rodando.');
} catch {
  execFileSync(pgCtl, ['-D', pasta, '-o', opcoes, '-l', path.join(pasta, 'servidor.log'), '-w', 'start'], { stdio: 'inherit' });
}
try {
  execFileSync(binario('createdb') ?? 'createdb', ['-h', '127.0.0.1', '-p', String(PORTA), '-U', 'animalx', 'animalx'], { stdio: 'ignore' });
} catch {
  // O banco já existe.
}
console.log(`DATABASE_URL=postgres://animalx@127.0.0.1:${PORTA}/animalx`);
