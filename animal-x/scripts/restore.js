// Restaura um backup criptografado no PostgreSQL de DATABASE_URL.
// Antes de restaurar, faz uma cópia do estado atual.
// Uso: npm run backup:restore -- backups/animalx-AAAAMMDD-HHMMSS.dump.axb
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { decifrar, executar, fazerBackup, obterChave } from '../server/backup.js';
import { lerConfig } from '../server/config.js';

const arquivo = process.argv[2];
const config = lerConfig();
if (!arquivo || !config.bancoUrl) {
  console.error('Uso: DATABASE_URL=... npm run backup:restore -- <arquivo .dump.axb>');
  process.exit(1);
}
const temp = await mkdtemp(path.join(os.tmpdir(), 'animalx-restore-'));
try {
  const dump = decifrar(await readFile(arquivo), await obterChave(config));
  const antes = await fazerBackup(config);
  console.log(`Cópia do estado atual: ${antes.arquivo}`);
  const caminho = path.join(temp, 'restore.dump');
  await writeFile(caminho, dump, { mode: 0o600 });
  await executar('pg_restore', ['--clean', '--if-exists', '--no-owner', '--dbname', config.bancoUrl, caminho]);
  console.log(`Backup restaurado: ${arquivo}`);
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}
