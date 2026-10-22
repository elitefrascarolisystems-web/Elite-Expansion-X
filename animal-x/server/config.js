import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function lerConfig(env = process.env) {
  const porta = Number(env.PORT ?? env.ANIMALX_PORTA ?? 4310);
  return {
    porta: Number.isInteger(porta) && porta > 0 ? porta : 4310,
    host: env.ANIMALX_HOST ?? '127.0.0.1',
    bancoUrl: env.DATABASE_URL ?? null,
    distDir: path.resolve(env.ANIMALX_DIST ?? path.join(RAIZ, 'dist')),
    dadosDir: path.resolve(env.ANIMALX_DADOS ?? path.join(RAIZ, 'data')),
    backupDir: path.resolve(env.ANIMALX_BACKUPS ?? path.join(RAIZ, 'backups')),
    cookieSeguro: env.ANIMALX_COOKIE_SEGURO === '1',
    confiarProxy: env.ANIMALX_CONFIAR_PROXY === '1',
    cadastroAberto: env.ANIMALX_CADASTRO_ABERTO !== '0',
    backupDiario: env.ANIMALX_BACKUP_DIARIO === '1',
    sessaoHoras: Number(env.ANIMALX_SESSAO_HORAS ?? 12),
    adminEmail: env.ANIMALX_ADMIN_EMAIL ?? null,
    adminSenha: env.ANIMALX_ADMIN_SENHA ?? null,
  };
}
