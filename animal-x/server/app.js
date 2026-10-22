import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { PAPEIS, STATUS_REVISAO, papelValido, pode } from './papeis.js';
import {
  CABECALHOS_SEGURANCA, LimiteRequisicoes, conferirSenha, gerarHash, hashParaComparacao,
  hashToken, iguaisSeguro, novoToken,
} from './seguranca.js';

const COOKIE = 'ax_sessao';
const LIMITE_CORPO = 64 * 1024;
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.glb': 'model/gltf-binary',
};

class ErroHttp extends Error {
  constructor(status, mensagem, extra = {}) {
    super(mensagem);
    this.status = status;
    this.extra = extra;
  }
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

function texto(valor, nome, { min = 1, max = 200, opcional = false } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (opcional) return null;
    throw new ErroHttp(400, `Campo obrigatório: ${nome}.`);
  }
  if (typeof valor !== 'string') throw new ErroHttp(400, `Campo inválido: ${nome}.`);
  const limpo = valor.trim();
  if (limpo.length < min || limpo.length > max) throw new ErroHttp(400, `${nome} deve ter entre ${min} e ${max} caracteres.`);
  return limpo;
}

function dataValida(valor, nome, { opcional = false } = {}) {
  if (!valor && opcional) return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new ErroHttp(400, `${nome}: use AAAA-MM-DD.`);
  const d = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) throw new ErroHttp(400, `${nome}: data inexistente.`);
  return valor;
}

function senhaNova(valor) {
  if (typeof valor !== 'string' || valor.length < 10 || valor.length > 200) {
    throw new ErroHttp(400, 'A senha deve ter entre 10 e 200 caracteres.');
  }
  return valor;
}

function usuarioPublico(u) {
  return u && { id: u.id, email: u.email, nome: u.nome, papel: u.papel, papelNome: PAPEIS[u.papel] };
}

function lerCookies(cabecalho = '') {
  const cookies = {};
  for (const parte of cabecalho.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0) cookies[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return cookies;
}

async function lerCorpo(req) {
  const tipo = req.headers['content-type'] ?? '';
  if (!tipo.startsWith('application/json')) throw new ErroHttp(415, 'Envie JSON.');
  let tamanho = 0;
  const partes = [];
  for await (const parte of req) {
    tamanho += parte.length;
    if (tamanho > LIMITE_CORPO) throw new ErroHttp(413, 'Requisição grande demais.');
    partes.push(parte);
  }
  try {
    const corpo = JSON.parse(Buffer.concat(partes).toString('utf8') || '{}');
    if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) throw new Error('não é objeto');
    return corpo;
  } catch {
    throw new ErroHttp(400, 'JSON inválido.');
  }
}

// "senhas" permite aos testes observar as chamadas de scrypt.
export function criarApp({ armazem, config, estruturasValidas = new Set(), log = () => {}, senhas = { conferirSenha, hashParaComparacao } }) {
  const limites = {
    geral: new LimiteRequisicoes({ janelaMs: 60_000, maximo: 600 }),
    loginIp: new LimiteRequisicoes({ janelaMs: 15 * 60_000, maximo: 30 }),
    loginEmail: new LimiteRequisicoes({ janelaMs: 15 * 60_000, maximo: 10 }),
    cadastro: new LimiteRequisicoes({ janelaMs: 60 * 60_000, maximo: 10 }),
    senha: new LimiteRequisicoes({ janelaMs: 15 * 60_000, maximo: 5 }),
  };

  function ipDe(req) {
    if (config.confiarProxy) {
      const encaminhado = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
      if (encaminhado) return encaminhado;
    }
    return req.socket.remoteAddress ?? 'desconhecido';
  }

  function seguro(req) {
    return config.cookieSeguro || (config.confiarProxy && req.headers['x-forwarded-proto'] === 'https');
  }

  function cookieSessao(req, token, maxAge) {
    const partes = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAge}`];
    if (seguro(req)) partes.push('Secure');
    return partes.join('; ');
  }

  function json(res, status, corpo, extras = {}) {
    res.writeHead(status, {
      ...CABECALHOS_SEGURANCA,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extras,
    });
    res.end(JSON.stringify(corpo));
  }

  function limitar(limite, chave) {
    const r = limite.registrar(chave);
    if (!r.permitido) {
      throw new ErroHttp(429, 'Muitas tentativas. Aguarde e tente de novo.', { 'Retry-After': String(r.aguardarSegundos) });
    }
  }

  async function contexto(req) {
    const token = lerCookies(req.headers.cookie)[COOKIE];
    if (!token) return { usuario: null, sessao: null };
    const sessao = await armazem.sessao(hashToken(token));
    if (!sessao) return { usuario: null, sessao: null };
    const usuario = await armazem.usuarioPorId(sessao.usuarioId);
    return usuario ? { usuario, sessao } : { usuario: null, sessao: null };
  }

  // Toda escrita exige o cabeçalho próprio da aplicação, origem igual à do
  // servidor e, com sessão, o token CSRF ligado a ela.
  function conferirEscrita(req, sessao) {
    if (req.headers['x-animalx'] !== '1') throw new ErroHttp(403, 'Requisição recusada.');
    const origem = req.headers.origin;
    if (origem) {
      const host = req.headers.host;
      const permitidas = [`http://${host}`, `https://${host}`];
      if (!permitidas.includes(origem)) throw new ErroHttp(403, 'Origem recusada.');
    }
    if (sessao && !iguaisSeguro(req.headers['x-csrf-token'], sessao.csrf)) {
      throw new ErroHttp(403, 'Token CSRF inválido. Recarregue a página.');
    }
  }

  function exigir(usuario, permissao) {
    if (!usuario) throw new ErroHttp(401, 'Entre na sua conta.');
    if (permissao && !pode(usuario, permissao)) throw new ErroHttp(403, 'Seu papel não permite esta ação.');
  }

  async function iniciarSessao(req, res, usuario, status, corpo) {
    const token = novoToken();
    const csrf = novoToken(24);
    const horas = config.sessaoHoras > 0 ? config.sessaoHoras : 12;
    await armazem.criarSessao({ tokenHash: hashToken(token), usuarioId: usuario.id, csrf, expiraEm: Date.now() + horas * 3_600_000 });
    json(res, status, { ...corpo, usuario: usuarioPublico(usuario), csrf }, { 'Set-Cookie': cookieSessao(req, token, horas * 3600) });
  }

  const rotas = [];
  const rota = (metodo, padrao, tratador) => rotas.push({ metodo, padrao, tratador });

  rota('GET', /^\/api\/saude$/, async (_req, res) => json(res, 200, { ok: true }));

  rota('GET', /^\/api\/sessao$/, async (_req, res, { usuario, sessao }) => {
    json(res, 200, {
      usuario: usuarioPublico(usuario),
      csrf: sessao?.csrf ?? null,
      modo: armazem.modo,
      cadastroAberto: config.cadastroAberto,
      papeis: PAPEIS,
      statusRevisao: STATUS_REVISAO,
    });
  });

  rota('POST', /^\/api\/entrar$/, async (req, res, ctx) => {
    const corpo = await lerCorpo(req);
    const email = String(corpo.email ?? '').trim().toLowerCase();
    const senha = typeof corpo.senha === 'string' ? corpo.senha : '';
    const ip = ipDe(req);
    limitar(limites.loginIp, ip);
    limitar(limites.loginEmail, email);
    const usuario = EMAIL.test(email) ? await armazem.usuarioPorEmail(email) : null;
    // Sempre um cálculo de scrypt, exista ou não a conta.
    const hash = usuario?.senhaHash ?? await senhas.hashParaComparacao();
    const confere = await senhas.conferirSenha(senha.slice(0, 200), hash);
    if (!usuario || !confere) {
      await armazem.auditar({ acao: 'login_falhou', alvo: `email:${createHash('sha256').update(email).digest('hex').slice(0, 12)}` });
      throw new ErroHttp(401, 'E-mail ou senha incorretos.');
    }
    limites.loginEmail.zerar(email);
    if (ctx.sessao) await armazem.apagarSessao(ctx.sessao.tokenHash);
    await armazem.auditar({ ator: usuario.id, acao: 'login' });
    await iniciarSessao(req, res, usuario, 200, {});
  });

  rota('POST', /^\/api\/cadastro$/, async (req, res) => {
    if (!config.cadastroAberto) throw new ErroHttp(403, 'Cadastro fechado. Peça acesso ao administrador.');
    limitar(limites.cadastro, ipDe(req));
    const corpo = await lerCorpo(req);
    const email = texto(corpo.email, 'E-mail', { max: 254 }).toLowerCase();
    if (!EMAIL.test(email)) throw new ErroHttp(400, 'E-mail inválido.');
    const nome = texto(corpo.nome, 'Nome', { min: 2, max: 100 });
    const senha = senhaNova(corpo.senha);
    let usuario;
    try {
      usuario = await armazem.criarUsuario({ email, nome, papel: 'estudante', senhaHash: await gerarHash(senha) });
    } catch (erro) {
      if (erro.codigo === 'email_existe') throw new ErroHttp(409, 'Este e-mail já tem conta. Use Entrar.');
      throw erro;
    }
    await armazem.auditar({ ator: usuario.id, acao: 'cadastro', alvo: usuario.id });
    await iniciarSessao(req, res, usuario, 201, {});
  });

  rota('POST', /^\/api\/sair$/, async (_req, res, { sessao, usuario }) => {
    if (sessao) {
      await armazem.apagarSessao(sessao.tokenHash);
      await armazem.auditar({ ator: usuario.id, acao: 'logout' });
    }
    json(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` });
  });

  rota('POST', /^\/api\/senha$/, async (req, res, { usuario, sessao }) => {
    exigir(usuario);
    limitar(limites.senha, usuario.id);
    const corpo = await lerCorpo(req);
    const atual = typeof corpo.atual === 'string' ? corpo.atual.slice(0, 200) : '';
    const nova = senhaNova(corpo.nova);
    if (!(await conferirSenha(atual, usuario.senhaHash))) {
      await armazem.auditar({ ator: usuario.id, acao: 'senha_falhou' });
      throw new ErroHttp(401, 'Senha atual incorreta.');
    }
    await armazem.alterarSenha(usuario.id, await gerarHash(nova));
    await armazem.apagarSessoesDoUsuario(usuario.id, sessao.tokenHash);
    await armazem.auditar({ ator: usuario.id, acao: 'senha_alterada' });
    json(res, 200, { ok: true });
  });

  rota('GET', /^\/api\/revisoes$/, async (_req, res) => json(res, 200, { revisoes: await armazem.revisoes() }));

  rota('POST', /^\/api\/revisoes$/, async (req, res, { usuario }) => {
    exigir(usuario, 'revisao:alterar');
    const corpo = await lerCorpo(req);
    const estrutura = texto(corpo.estrutura, 'Estrutura', { max: 80 });
    if (!estruturasValidas.has(estrutura)) throw new ErroHttp(404, 'Estrutura desconhecida.');
    if (!Object.hasOwn(STATUS_REVISAO, corpo.status)) throw new ErroHttp(400, 'Status de revisão inválido.');
    const nota = texto(corpo.nota, 'Nota', { max: 2000, opcional: true });
    if (corpo.status === 'revisado' && !nota) throw new ErroHttp(400, 'Para marcar como revisado, registre a evidência na nota.');
    const anterior = (await armazem.revisoes())[estrutura]?.status ?? 'nao_revisado';
    const revisao = await armazem.definirRevisao(estrutura, { status: corpo.status, nota, revisorId: usuario.id, revisorNome: usuario.nome });
    await armazem.auditar({ ator: usuario.id, acao: 'revisao', alvo: estrutura, resumo: `${anterior} → ${corpo.status}` });
    json(res, 200, { revisao });
  });

  rota('GET', /^\/api\/biblioteca$/, async (_req, res, { usuario }) => {
    exigir(usuario);
    json(res, 200, { itens: await armazem.biblioteca(usuario.id) });
  });

  rota('POST', /^\/api\/biblioteca$/, async (req, res, { usuario }) => {
    exigir(usuario);
    const corpo = await lerCorpo(req);
    if (!['cena', 'anotacao'].includes(corpo.tipo)) throw new ErroHttp(400, 'Tipo inválido.');
    const titulo = texto(corpo.titulo, 'Título', { max: 120 });
    const dados = corpo.dados ?? {};
    if (typeof dados !== 'object' || Array.isArray(dados) || JSON.stringify(dados).length > 32_000) {
      throw new ErroHttp(400, 'Dados da cena inválidos ou grandes demais.');
    }
    json(res, 201, { item: await armazem.adicionarBiblioteca(usuario.id, { tipo: corpo.tipo, titulo, dados }) });
  });

  rota('DELETE', /^\/api\/biblioteca\/([\w-]{1,64})$/, async (_req, res, { usuario }, [, id]) => {
    exigir(usuario);
    if (!(await armazem.apagarBiblioteca(usuario.id, id))) throw new ErroHttp(404, 'Item não encontrado.');
    json(res, 200, { ok: true });
  });

  rota('GET', /^\/api\/laboratorio\/animais$/, async (_req, res, { usuario }) => {
    exigir(usuario);
    json(res, 200, { animais: await armazem.animais(usuario.id) });
  });

  rota('POST', /^\/api\/laboratorio\/animais$/, async (req, res, { usuario }) => {
    exigir(usuario);
    const corpo = await lerCorpo(req);
    if (corpo.sexo && !['macho', 'femea'].includes(corpo.sexo)) throw new ErroHttp(400, 'Sexo inválido.');
    const animal = await armazem.criarAnimal(usuario.id, {
      nome: texto(corpo.nome, 'Nome', { max: 80 }),
      especie: texto(corpo.especie, 'Espécie', { max: 60 }),
      nascimento: dataValida(corpo.nascimento, 'Nascimento', { opcional: true }),
      sexo: corpo.sexo || null,
    });
    await armazem.auditar({ ator: usuario.id, acao: 'animal_criado', alvo: animal.id });
    json(res, 201, { animal });
  });

  rota('DELETE', /^\/api\/laboratorio\/animais\/([\w-]{1,64})$/, async (_req, res, { usuario }, [, id]) => {
    exigir(usuario);
    if (!(await armazem.apagarAnimal(usuario.id, id))) throw new ErroHttp(404, 'Animal não encontrado.');
    await armazem.auditar({ ator: usuario.id, acao: 'animal_apagado', alvo: id });
    json(res, 200, { ok: true });
  });

  rota('GET', /^\/api\/laboratorio\/animais\/([\w-]{1,64})\/registros$/, async (_req, res, { usuario }, [, id]) => {
    exigir(usuario);
    if (!(await armazem.animal(usuario.id, id))) throw new ErroHttp(404, 'Animal não encontrado.');
    json(res, 200, { registros: await armazem.registros(usuario.id, id) });
  });

  rota('POST', /^\/api\/laboratorio\/animais\/([\w-]{1,64})\/registros$/, async (req, res, { usuario }, [, id]) => {
    exigir(usuario);
    if (!(await armazem.animal(usuario.id, id))) throw new ErroHttp(404, 'Animal não encontrado.');
    const corpo = await lerCorpo(req);
    const data = dataValida(corpo.data, 'Data');
    let valor = null;
    let textoLivre = null;
    if (corpo.tipo === 'peso') {
      valor = Number(corpo.valor);
      if (!Number.isFinite(valor) || valor < 0.05 || valor > 2000) throw new ErroHttp(400, 'Peso entre 0,05 e 2000 kg.');
    } else if (corpo.tipo === 'ecc') {
      valor = Number(corpo.valor);
      if (!Number.isInteger(valor) || valor < 1 || valor > 9) throw new ErroHttp(400, 'Escore de condição corporal de 1 a 9.');
    } else if (corpo.tipo === 'contexto') {
      textoLivre = texto(corpo.texto, 'Texto', { max: 1000 });
    } else {
      throw new ErroHttp(400, 'Tipo de registro inválido.');
    }
    json(res, 201, { registro: await armazem.adicionarRegistro(usuario.id, id, { tipo: corpo.tipo, valor, texto: textoLivre, data }) });
  });

  rota('GET', /^\/api\/admin\/usuarios$/, async (_req, res, { usuario }) => {
    exigir(usuario, 'usuarios:listar');
    json(res, 200, { usuarios: await armazem.listarUsuarios() });
  });

  rota('POST', /^\/api\/admin\/usuarios\/([\w-]{1,64})\/papel$/, async (req, res, { usuario }, [, id]) => {
    exigir(usuario, 'usuarios:papel');
    const corpo = await lerCorpo(req);
    if (!papelValido(corpo.papel)) throw new ErroHttp(400, 'Papel inválido.');
    const alvo = await armazem.usuarioPorId(id);
    if (!alvo) throw new ErroHttp(404, 'Conta não encontrada.');
    if (alvo.papel === 'admin' && corpo.papel !== 'admin' && (await armazem.contarAdmins()) <= 1) {
      throw new ErroHttp(409, 'Não é possível remover o último administrador.');
    }
    await armazem.alterarPapel(id, corpo.papel);
    await armazem.auditar({ ator: usuario.id, acao: 'papel_alterado', alvo: id, resumo: `${alvo.papel} → ${corpo.papel}` });
    json(res, 200, { ok: true });
  });

  rota('GET', /^\/api\/admin\/auditoria$/, async (_req, res, { usuario }) => {
    exigir(usuario, 'auditoria:ler');
    json(res, 200, { registros: await armazem.listarAuditoria(300) });
  });

  rota('GET', /^\/api\/admin\/status$/, async (_req, res, { usuario }) => {
    exigir(usuario, 'sistema:status');
    json(res, 200, { status: await armazem.status(), backupDiario: config.backupDiario });
  });

  async function api(req, res, url) {
    limitar(limites.geral, ipDe(req));
    const encontradas = rotas.filter((r) => r.padrao.test(url.pathname));
    if (!encontradas.length) throw new ErroHttp(404, 'Rota não encontrada.');
    const r = encontradas.find((x) => x.metodo === req.method);
    if (!r) throw new ErroHttp(405, 'Método não permitido.');
    const ctx = await contexto(req);
    if (req.method !== 'GET') conferirEscrita(req, ctx.sessao);
    await r.tratador(req, res, ctx, url.pathname.match(r.padrao));
  }

  async function estatico(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new ErroHttp(405, 'Método não permitido.');
    let relativo;
    try {
      relativo = decodeURIComponent(url.pathname);
    } catch {
      throw new ErroHttp(400, 'Caminho inválido.');
    }
    if (relativo.includes('\0')) throw new ErroHttp(400, 'Caminho inválido.');
    if (relativo === '/' || !path.extname(relativo)) relativo = '/index.html';
    const arquivo = path.resolve(config.distDir, `.${path.posix.normalize(relativo)}`);
    if (!arquivo.startsWith(config.distDir + path.sep)) throw new ErroHttp(403, 'Acesso negado.');
    let info;
    try {
      info = await stat(arquivo);
    } catch {
      throw new ErroHttp(404, 'Arquivo não encontrado.');
    }
    if (!info.isFile()) throw new ErroHttp(404, 'Arquivo não encontrado.');
    const nome = path.basename(arquivo);
    // Nomes com hash do build (app.<hash>.js, estilo.<hash>.css) e fontes nunca mudam.
    const imutavel = /^(app|estilo)\.[A-Za-z0-9]{8,}\.(js|css)$/.test(nome) || arquivo.includes(`${path.sep}fontes${path.sep}`);
    res.writeHead(200, {
      ...CABECALHOS_SEGURANCA,
      'Content-Type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': imutavel ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(arquivo).pipe(res);
  }

  async function tratar(req, res) {
    const url = new URL(req.url ?? '/', 'http://local');
    try {
      if (url.pathname.startsWith('/api/')) await api(req, res, url);
      else await estatico(req, res, url);
    } catch (erro) {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (erro instanceof ErroHttp) {
        if (url.pathname.startsWith('/api/')) json(res, erro.status, { erro: erro.message }, erro.extra);
        else {
          res.writeHead(erro.status, { ...CABECALHOS_SEGURANCA, 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(erro.message);
        }
        return;
      }
      log(`Erro interno: ${erro.stack ?? erro}`);
      json(res, 500, { erro: 'Erro interno.' });
    }
  }

  tratar.encerrar = () => Object.values(limites).forEach((l) => l.parar());
  tratar.limites = limites;
  return tratar;
}
