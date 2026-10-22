// PostgreSQL temporário para os testes. Usa os binários do sistema; como o
// initdb recusa rodar como root, os comandos passam pelo usuário postgres.
import { execFileSync, spawnSync } from 'node:child_process';
import net from 'node:net';
import { chownSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function binario(nome) {
  const r = spawnSync('which', [nome], { encoding: 'utf8' });
  if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  for (const base of ['/usr/lib/postgresql', '/opt/homebrew/opt', '/usr/local/opt']) {
    if (!existsSync(base)) continue;
    for (const v of readdirSync(base).sort().reverse()) {
      const c = path.join(base, v, 'bin', nome);
      if (existsSync(c)) return c;
    }
  }
  return null;
}

export function postgresDisponivel() {
  if (process.env.DATABASE_URL_TESTE) return 'externo';
  if (!binario('initdb') || !binario('pg_ctl')) return null;
  if (process.getuid?.() === 0 && spawnSync('id', ['postgres']).status !== 0) return null;
  return 'local';
}

export async function iniciarPostgres() {
  if (process.env.DATABASE_URL_TESTE) return { url: process.env.DATABASE_URL_TESTE, parar: async () => {} };
  const root = process.getuid?.() === 0;
  const executar = (bin, args) => execFileSync(root ? 'runuser' : bin, root ? ['-u', 'postgres', '--', bin, ...args] : args, { stdio: 'pipe' });
  const pasta = mkdtempSync(path.join(os.tmpdir(), 'animalx-pg-'));
  if (root) {
    const { uid, gid } = { uid: Number(execFileSync('id', ['-u', 'postgres']).toString()), gid: Number(execFileSync('id', ['-g', 'postgres']).toString()) };
    chownSync(pasta, uid, gid);
  }
  // Porta livre escolhida pelo sistema, para não colidir com outro serviço.
  const porta = await new Promise((resolve) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
  executar(binario('initdb'), ['-D', pasta, '-U', 'animalx', '--auth=trust', '-E', 'UTF8', '--no-locale']);
  executar(binario('pg_ctl'), ['-D', pasta, '-o', `-p ${porta} -k ${pasta} -c listen_addresses=127.0.0.1`, '-l', path.join(pasta, 'log'), '-w', 'start']);
  executar(binario('createdb'), ['-h', '127.0.0.1', '-p', String(porta), '-U', 'animalx', 'animalx']);
  return {
    url: `postgres://animalx@127.0.0.1:${porta}/animalx`,
    porta,
    criarBanco: (nome) => executar(binario('createdb'), ['-h', '127.0.0.1', '-p', String(porta), '-U', 'animalx', nome]),
    async parar() {
      try { executar(binario('pg_ctl'), ['-D', pasta, '-m', 'fast', '-w', 'stop']); } catch { /* já parado */ }
      rmSync(pasta, { recursive: true, force: true });
    },
  };
}
