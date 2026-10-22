import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chmod, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAGICO = Buffer.from('AXB1');

export async function obterChave(config, env = process.env) {
  if (env.ANIMALX_BACKUP_CHAVE) {
    const chave = Buffer.from(env.ANIMALX_BACKUP_CHAVE, 'base64');
    if (chave.length !== 32) throw new Error('ANIMALX_BACKUP_CHAVE deve ter 32 bytes em base64.');
    return chave;
  }
  const arquivo = path.join(config.dadosDir, 'backup.chave');
  try {
    const chave = Buffer.from((await readFile(arquivo, 'utf8')).trim(), 'base64');
    if (chave.length === 32) return chave;
    throw new Error(`Chave de backup inválida em ${arquivo}.`);
  } catch (erro) {
    if (erro.code !== 'ENOENT') throw erro;
  }
  await mkdir(config.dadosDir, { recursive: true });
  const chave = randomBytes(32);
  await writeFile(arquivo, chave.toString('base64'), { mode: 0o600 });
  await chmod(arquivo, 0o600);
  return chave;
}

// Formato: "AXB1" + IV (12 bytes) + tag (16 bytes) + conteúdo cifrado (AES-256-GCM).
export function cifrar(conteudo, chave) {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chave, iv);
  cifra.setAAD(MAGICO);
  const corpo = Buffer.concat([cifra.update(conteudo), cifra.final()]);
  return Buffer.concat([MAGICO, iv, cifra.getAuthTag(), corpo]);
}

export function decifrar(arquivo, chave) {
  if (arquivo.length < 32 || !arquivo.subarray(0, 4).equals(MAGICO)) throw new Error('Arquivo de backup desconhecido.');
  const iv = arquivo.subarray(4, 16);
  const tag = arquivo.subarray(16, 32);
  const decifra = createDecipheriv('aes-256-gcm', chave, iv);
  decifra.setAAD(MAGICO);
  decifra.setAuthTag(tag);
  return Buffer.concat([decifra.update(arquivo.subarray(32)), decifra.final()]);
}

export function executar(comando, args, { entrada } = {}) {
  return new Promise((resolve, reject) => {
    const filho = spawn(comando, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const saida = [];
    const erros = [];
    filho.stdout.on('data', (d) => saida.push(d));
    filho.stderr.on('data', (d) => erros.push(d));
    filho.on('error', reject);
    filho.on('close', (codigo) => {
      if (codigo === 0) resolve(Buffer.concat(saida));
      else reject(new Error(`${comando} terminou com código ${codigo}: ${Buffer.concat(erros).toString().trim()}`));
    });
    if (entrada) filho.stdin.end(entrada);
    else filho.stdin.end();
  });
}

export async function fazerBackup(config, { manter = 14, binario = 'pg_dump' } = {}) {
  if (!config.bancoUrl) throw new Error('Backup exige DATABASE_URL (PostgreSQL). O modo em memória não guarda dados.');
  const dump = await executar(binario, ['--format=custom', '--no-owner', '--dbname', config.bancoUrl]);
  const chave = await obterChave(config);
  const cifrado = cifrar(dump, chave);
  await mkdir(config.backupDir, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const arquivo = path.join(config.backupDir, `animalx-${carimbo}.dump.axb`);
  await writeFile(arquivo, cifrado, { mode: 0o600 });
  const antigos = (await readdir(config.backupDir)).filter((a) => /^animalx-.*\.dump\.axb$/.test(a)).sort();
  for (const velho of antigos.slice(0, Math.max(0, antigos.length - manter))) await rm(path.join(config.backupDir, velho));
  return { arquivo, bytes: cifrado.length, sha256: createHash('sha256').update(cifrado).digest('hex') };
}
