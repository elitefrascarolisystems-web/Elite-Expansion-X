// Servidor de teste em porta aleatória, com armazém em memória por padrão.
import http from 'node:http';
import path from 'node:path';
import { criarApp } from '../../server/app.js';
import { ArmazemMemoria } from '../../server/armazem-memoria.js';
import { RAIZ, lerConfig } from '../../server/config.js';
import { gerarHash } from '../../server/seguranca.js';

export async function iniciarServidor({ armazem = new ArmazemMemoria(), config = {}, estruturas = ['coracao', 'femur', 'rim'] } = {}) {
  const cfg = { ...lerConfig({}), distDir: path.join(RAIZ, 'dist'), ...config };
  const app = criarApp({ armazem, config: cfg, estruturasValidas: new Set(estruturas) });
  const servidor = http.createServer(app);
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  return {
    base,
    armazem,
    app,
    async fechar() {
      app.encerrar();
      await new Promise((r) => servidor.close(r));
    },
  };
}

// Cliente que guarda o cookie de sessão e o token CSRF, como o navegador.
export function cliente(base) {
  let cookie = '';
  let csrf = null;
  async function pedir(caminho, { metodo = 'GET', corpo, cabecalhos = {}, semCsrf = false, bruto } = {}) {
    const h = { ...cabecalhos };
    if (cookie) h.Cookie = cookie;
    if (metodo !== 'GET') {
      h['Content-Type'] ??= 'application/json';
      h['X-AnimalX'] ??= '1';
      if (csrf && !semCsrf) h['X-CSRF-Token'] = csrf;
    }
    const r = await fetch(base + caminho, { method: metodo, headers: h, body: bruto ?? (corpo ? JSON.stringify(corpo) : undefined), redirect: 'manual' });
    const setCookie = r.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0].endsWith('=') ? '' : setCookie.split(';')[0];
    const texto = await r.text();
    let dados = null;
    try { dados = JSON.parse(texto); } catch { dados = texto; }
    if (dados && typeof dados === 'object' && 'csrf' in dados) csrf = dados.csrf;
    return { status: r.status, dados, cabecalhos: r.headers };
  }
  return { pedir, get cookie() { return cookie; }, get csrf() { return csrf; } };
}

export async function criarConta(armazem, { email, senha = 'senha-de-teste-1', papel = 'estudante', nome = 'Pessoa Teste' }) {
  return armazem.criarUsuario({ email, nome, papel, senhaHash: await gerarHash(senha) });
}

export async function entrarComo(base, email, senha = 'senha-de-teste-1') {
  const c = cliente(base);
  const r = await c.pedir('/api/entrar', { metodo: 'POST', corpo: { email, senha } });
  if (r.status !== 200) throw new Error(`Login falhou para ${email}: ${r.status} ${JSON.stringify(r.dados)}`);
  return c;
}
