import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { criarApp } from './app.js';
import { ArmazemMemoria } from './armazem-memoria.js';
import { ArmazemPostgres } from './armazem-postgres.js';
import { fazerBackup } from './backup.js';
import { RAIZ, lerConfig } from './config.js';
import { gerarHash } from './seguranca.js';

const log = (msg) => console.log(`[animal-x] ${msg}`);

async function garantirAdmin(armazem, config) {
  if (config.adminEmail && config.adminSenha) {
    const email = config.adminEmail.trim().toLowerCase();
    const existente = await armazem.usuarioPorEmail(email);
    if (!existente) {
      await armazem.criarUsuario({ email, nome: 'Administrador', papel: 'admin', senhaHash: await gerarHash(config.adminSenha) });
      log(`Administrador criado: ${email}`);
    }
    return;
  }
  if (armazem.modo === 'memoria' && (await armazem.listarUsuarios()).length === 0) {
    const senha = randomBytes(12).toString('base64url');
    await armazem.criarUsuario({ email: 'admin@animalx.local', nome: 'Administrador (demonstração)', papel: 'admin', senhaHash: await gerarHash(senha) });
    log('Conta de administrador da demonstração (vale só até o servidor parar):');
    log(`  e-mail: admin@animalx.local   senha: ${senha}`);
  }
}

async function iniciar() {
  const config = lerConfig();
  const armazem = config.bancoUrl
    ? await new ArmazemPostgres(config.bancoUrl, { log }).iniciar()
    : new ArmazemMemoria();
  if (armazem.modo === 'memoria') log('Modo demonstração em memória: contas e registros somem quando o servidor parar.');
  else log(`PostgreSQL conectado; ${armazem.migracoes.total} migrações conferidas.`);
  await garantirAdmin(armazem, config);

  const catalogo = JSON.parse(readFileSync(path.join(RAIZ, 'content/estruturas.json'), 'utf8'));
  const estruturasValidas = new Set(catalogo.estruturas.map((e) => e.id));
  if (!existsSync(path.join(config.distDir, 'index.html'))) log('Aviso: dist/ não encontrado. Rode "npm run build" antes.');

  const app = criarApp({ armazem, config, estruturasValidas, log });
  const servidor = http.createServer(app);
  servidor.headersTimeout = 20_000;
  servidor.requestTimeout = 30_000;
  servidor.listen(config.porta, config.host, () => log(`Animal X em http://${config.host}:${config.porta}`));

  let timerBackup;
  if (config.backupDiario && armazem.modo === 'postgres') {
    const rodar = async () => {
      try {
        const r = await fazerBackup(config);
        await armazem.auditar({ acao: 'backup', resumo: `${path.basename(r.arquivo)} (${r.bytes} bytes)` });
        log(`Backup criptografado: ${r.arquivo}`);
      } catch (erro) {
        log(`Falha no backup: ${erro.message}`);
      }
    };
    rodar();
    timerBackup = setInterval(rodar, 24 * 3_600_000);
    timerBackup.unref();
  }

  const encerrar = async () => {
    clearInterval(timerBackup);
    app.encerrar();
    servidor.close();
    await armazem.fechar();
    process.exit(0);
  };
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

iniciar().catch((erro) => {
  console.error(`[animal-x] Não foi possível iniciar: ${erro.message}`);
  process.exit(1);
});
