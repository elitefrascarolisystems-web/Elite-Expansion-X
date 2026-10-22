// Cria uma conta de administrador ou promove uma conta existente.
// Uso: ANIMALX_ADMIN_EMAIL=... ANIMALX_ADMIN_SENHA=... npm run admin:create
import { ArmazemPostgres } from '../server/armazem-postgres.js';
import { lerConfig } from '../server/config.js';
import { gerarHash } from '../server/seguranca.js';

const config = lerConfig();
const email = config.adminEmail?.trim().toLowerCase();
if (!config.bancoUrl || !email || !config.adminSenha) {
  console.error('Defina DATABASE_URL, ANIMALX_ADMIN_EMAIL e ANIMALX_ADMIN_SENHA.');
  process.exit(1);
}
if (config.adminSenha.length < 10) {
  console.error('A senha deve ter pelo menos 10 caracteres.');
  process.exit(1);
}
const armazem = await new ArmazemPostgres(config.bancoUrl).iniciar();
try {
  const existente = await armazem.usuarioPorEmail(email);
  if (existente) {
    await armazem.alterarPapel(existente.id, 'admin');
    await armazem.auditar({ acao: 'papel_alterado', alvo: existente.id, resumo: `${existente.papel} → admin (linha de comando)` });
    console.log(`Conta ${email} promovida a administrador. A senha não foi alterada.`);
  } else {
    const u = await armazem.criarUsuario({ email, nome: 'Administrador', papel: 'admin', senhaHash: await gerarHash(config.adminSenha) });
    await armazem.auditar({ acao: 'cadastro', alvo: u.id, resumo: 'administrador (linha de comando)' });
    console.log(`Administrador criado: ${email}`);
  }
} finally {
  await armazem.fechar();
}
