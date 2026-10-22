// Backup criptografado (AES-256-GCM) do PostgreSQL de DATABASE_URL.
import { fazerBackup } from '../server/backup.js';
import { lerConfig } from '../server/config.js';

try {
  const r = await fazerBackup(lerConfig());
  console.log(`Backup salvo: ${r.arquivo}`);
  console.log(`${r.bytes} bytes, SHA-256 ${r.sha256}`);
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
}
