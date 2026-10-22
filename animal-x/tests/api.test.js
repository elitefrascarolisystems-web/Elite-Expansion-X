import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { cliente, criarConta, entrarComo, iniciarServidor } from './ajudantes/servidor.js';

let srv;
before(async () => {
  srv = await iniciarServidor();
  await criarConta(srv.armazem, { email: 'admin@teste.br', papel: 'admin', nome: 'Admin' });
  await criarConta(srv.armazem, { email: 'revisora@teste.br', papel: 'revisor', nome: 'Revisora' });
  await criarConta(srv.armazem, { email: 'estudante@teste.br', papel: 'estudante', nome: 'Estudante' });
});
after(() => srv.fechar());

describe('sessão e login', () => {
  test('cabeçalhos de segurança e sessão anônima', async () => {
    const r = await cliente(srv.base).pedir('/api/sessao');
    assert.equal(r.status, 200);
    assert.equal(r.dados.usuario, null);
    assert.equal(r.dados.modo, 'memoria');
    assert.match(r.cabecalhos.get('content-security-policy'), /default-src 'self'/);
    assert.match(r.cabecalhos.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(r.cabecalhos.get('x-content-type-options'), 'nosniff');
    assert.equal(r.cabecalhos.get('cache-control'), 'no-store');
  });

  test('cookie de sessão HttpOnly e SameSite=Strict; sessão guarda só o hash do token', async () => {
    const c = cliente(srv.base);
    const r = await c.pedir('/api/entrar', { metodo: 'POST', corpo: { email: 'estudante@teste.br', senha: 'senha-de-teste-1' } });
    assert.equal(r.status, 200);
    const cookie = r.cabecalhos.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    const token = c.cookie.split('=')[1];
    assert.equal(srv.armazem.sessoes.has(token), false, 'o token cru não é guardado');
    assert.equal(r.dados.usuario.papel, 'estudante');
    assert.equal('senhaHash' in r.dados.usuario, false);
  });

  test('erro de login é o mesmo para e-mail inexistente e senha errada, e tem custo parecido', async () => {
    const medir = async (email) => {
      const inicio = performance.now();
      const r = await cliente(srv.base).pedir('/api/entrar', { metodo: 'POST', corpo: { email, senha: 'errada-errada-1' } });
      return { r, ms: performance.now() - inicio };
    };
    const existente = await medir('admin@teste.br');
    const inexistente = await medir('ninguem@teste.br');
    assert.equal(existente.r.status, 401);
    assert.equal(inexistente.r.status, 401);
    assert.deepEqual(existente.r.dados, inexistente.r.dados);
    // Os dois caminhos calculam scrypt; sem isso o inexistente seria ~0 ms.
    assert.ok(inexistente.ms > existente.ms * 0.4, `inexistente ${inexistente.ms.toFixed(0)} ms vs existente ${existente.ms.toFixed(0)} ms`);
    const audit = await srv.armazem.listarAuditoria();
    assert.ok(audit.some((a) => a.acao === 'login_falhou' && /^email:[a-f0-9]{12}$/.test(a.alvo)), 'auditoria não guarda o e-mail em claro');
  });

  test('login: limite por e-mail devolve 429', async () => {
    const c = cliente(srv.base);
    let ultimo;
    for (let i = 0; i < 11; i++) ultimo = await c.pedir('/api/entrar', { metodo: 'POST', corpo: { email: 'alvo@teste.br', senha: 'x' } });
    assert.equal(ultimo.status, 429);
    assert.ok(Number(ultimo.cabecalhos.get('retry-after')) > 0);
  });
});

describe('proteção de escrita (CSRF e origem)', () => {
  test('sem o cabeçalho da aplicação, a escrita é recusada', async () => {
    const r = await cliente(srv.base).pedir('/api/entrar', { metodo: 'POST', corpo: { email: 'a@b.br', senha: 'x' }, cabecalhos: { 'X-AnimalX': '0' } });
    assert.equal(r.status, 403);
  });

  test('origem diferente é recusada', async () => {
    const r = await cliente(srv.base).pedir('/api/entrar', { metodo: 'POST', corpo: { email: 'a@b.br', senha: 'x' }, cabecalhos: { Origin: 'https://atacante.exemplo' } });
    assert.equal(r.status, 403);
  });

  test('com sessão, escrita sem token CSRF é recusada', async () => {
    const c = await entrarComo(srv.base, 'estudante@teste.br');
    const sem = await c.pedir('/api/biblioteca', { metodo: 'POST', corpo: { tipo: 'anotacao', titulo: 't', dados: {} }, semCsrf: true });
    assert.equal(sem.status, 403);
    const com = await c.pedir('/api/biblioteca', { metodo: 'POST', corpo: { tipo: 'anotacao', titulo: 't', dados: { texto: 'ok' } } });
    assert.equal(com.status, 201);
  });

  test('corpo que não é JSON e corpo grande demais', async () => {
    const c = await entrarComo(srv.base, 'estudante@teste.br');
    const texto = await c.pedir('/api/biblioteca', { metodo: 'POST', bruto: 'oi', cabecalhos: { 'Content-Type': 'text/plain' } });
    assert.equal(texto.status, 415);
    const grande = await c.pedir('/api/biblioteca', { metodo: 'POST', bruto: JSON.stringify({ x: 'a'.repeat(70_000) }) });
    assert.equal(grande.status, 413);
  });
});

describe('cadastro e senha', () => {
  test('cadastro cria estudante, valida senha e recusa e-mail repetido', async () => {
    const curta = await cliente(srv.base).pedir('/api/cadastro', { metodo: 'POST', corpo: { nome: 'Novo', email: 'novo@teste.br', senha: 'curta' } });
    assert.equal(curta.status, 400);
    const ok = await cliente(srv.base).pedir('/api/cadastro', { metodo: 'POST', corpo: { nome: 'Novo', email: 'Novo@Teste.br', senha: 'senha-longa-ok' } });
    assert.equal(ok.status, 201);
    assert.equal(ok.dados.usuario.papel, 'estudante');
    assert.equal(ok.dados.usuario.email, 'novo@teste.br');
    const repetido = await cliente(srv.base).pedir('/api/cadastro', { metodo: 'POST', corpo: { nome: 'Novo', email: 'novo@teste.br', senha: 'senha-longa-ok' } });
    assert.equal(repetido.status, 409);
  });

  test('cadastro fechado por configuração', async () => {
    const fechado = await iniciarServidor({ config: { cadastroAberto: false } });
    const r = await cliente(fechado.base).pedir('/api/cadastro', { metodo: 'POST', corpo: { nome: 'X', email: 'x@teste.br', senha: 'senha-longa-ok' } });
    assert.equal(r.status, 403);
    await fechado.fechar();
  });

  test('troca de senha: exige a atual, tem limite de tentativas e encerra outras sessões', async () => {
    await criarConta(srv.armazem, { email: 'troca@teste.br' });
    const a = await entrarComo(srv.base, 'troca@teste.br');
    const b = await entrarComo(srv.base, 'troca@teste.br');
    const errada = await a.pedir('/api/senha', { metodo: 'POST', corpo: { atual: 'nao-e-essa', nova: 'nova-senha-123' } });
    assert.equal(errada.status, 401);
    const ok = await a.pedir('/api/senha', { metodo: 'POST', corpo: { atual: 'senha-de-teste-1', nova: 'nova-senha-123' } });
    assert.equal(ok.status, 200);
    assert.equal((await b.pedir('/api/sessao')).dados.usuario, null, 'a outra sessão caiu');
    assert.equal((await a.pedir('/api/sessao')).dados.usuario.email, 'troca@teste.br', 'a sessão atual continua');
    let ultimo;
    for (let i = 0; i < 5; i++) ultimo = await a.pedir('/api/senha', { metodo: 'POST', corpo: { atual: 'x', nova: 'outra-senha-123' } });
    assert.equal(ultimo.status, 429);
  });

  test('sair encerra a sessão', async () => {
    const c = await entrarComo(srv.base, 'estudante@teste.br');
    assert.equal((await c.pedir('/api/sair', { metodo: 'POST' })).status, 200);
    assert.equal((await c.pedir('/api/sessao')).dados.usuario, null);
  });
});

describe('papéis e separação de dados', () => {
  test('só o revisor altera revisão; "revisado" exige evidência; estrutura precisa existir', async () => {
    const est = await entrarComo(srv.base, 'estudante@teste.br');
    assert.equal((await est.pedir('/api/revisoes', { metodo: 'POST', corpo: { estrutura: 'coracao', status: 'em_revisao' } })).status, 403);
    const adm = await entrarComo(srv.base, 'admin@teste.br');
    assert.equal((await adm.pedir('/api/revisoes', { metodo: 'POST', corpo: { estrutura: 'coracao', status: 'em_revisao' } })).status, 403, 'nem o administrador revisa');
    const rev = await entrarComo(srv.base, 'revisora@teste.br');
    assert.equal((await rev.pedir('/api/revisoes', { metodo: 'POST', corpo: { estrutura: 'coracao', status: 'revisado' } })).status, 400);
    assert.equal((await rev.pedir('/api/revisoes', { metodo: 'POST', corpo: { estrutura: 'inexistente', status: 'em_revisao' } })).status, 404);
    const ok = await rev.pedir('/api/revisoes', { metodo: 'POST', corpo: { estrutura: 'coracao', status: 'revisado', nota: 'Conferido em Evans & de Lahunta, cap. 11.' } });
    assert.equal(ok.status, 200);
    assert.equal((await cliente(srv.base).pedir('/api/revisoes')).dados.revisoes.coracao.status, 'revisado');
    const audit = await srv.armazem.listarAuditoria();
    assert.ok(audit.some((a) => a.acao === 'revisao' && a.alvo === 'coracao' && a.resumo === 'nao_revisado → revisado'));
  });

  test('administrador não lê nem apaga dados do laboratório de outra pessoa', async () => {
    const est = await entrarComo(srv.base, 'estudante@teste.br');
    const { dados } = await est.pedir('/api/laboratorio/animais', { metodo: 'POST', corpo: { nome: 'Thor', especie: 'Cão', nascimento: '2019-05-10', sexo: 'macho' } });
    const id = dados.animal.id;
    assert.equal((await est.pedir(`/api/laboratorio/animais/${id}/registros`, { metodo: 'POST', corpo: { tipo: 'peso', valor: 28.4, data: '2026-10-01' } })).status, 201);
    const adm = await entrarComo(srv.base, 'admin@teste.br');
    assert.deepEqual((await adm.pedir('/api/laboratorio/animais')).dados.animais, []);
    assert.equal((await adm.pedir(`/api/laboratorio/animais/${id}/registros`)).status, 404);
    assert.equal((await adm.pedir(`/api/laboratorio/animais/${id}`, { metodo: 'DELETE' })).status, 404);
    const usuarios = (await adm.pedir('/api/admin/usuarios')).dados.usuarios;
    assert.ok(usuarios.length >= 3);
    assert.ok(usuarios.every((u) => !('senhaHash' in u)), 'lista de contas sem hash de senha');
    const auditoria = JSON.stringify((await adm.pedir('/api/admin/auditoria')).dados);
    assert.equal(auditoria.includes('Thor'), false, 'auditoria não leva dados do animal');
    assert.equal(auditoria.includes('28.4'), false);
  });

  test('biblioteca é isolada por pessoa', async () => {
    const a = await entrarComo(srv.base, 'estudante@teste.br');
    const b = await entrarComo(srv.base, 'revisora@teste.br');
    const { dados } = await a.pedir('/api/biblioteca', { metodo: 'POST', corpo: { tipo: 'cena', titulo: 'Minha cena', dados: { ocultas: ['pele'] } } });
    assert.equal((await b.pedir('/api/biblioteca')).dados.itens.some((i) => i.id === dados.item.id), false);
    assert.equal((await b.pedir(`/api/biblioteca/${dados.item.id}`, { metodo: 'DELETE' })).status, 404);
    assert.equal((await a.pedir(`/api/biblioteca/${dados.item.id}`, { metodo: 'DELETE' })).status, 200);
  });

  test('laboratório valida datas reais, peso e escore', async () => {
    const c = await entrarComo(srv.base, 'estudante@teste.br');
    const { dados } = await c.pedir('/api/laboratorio/animais', { metodo: 'POST', corpo: { nome: 'Luna', especie: 'Gato' } });
    const url = `/api/laboratorio/animais/${dados.animal.id}/registros`;
    assert.equal((await c.pedir(url, { metodo: 'POST', corpo: { tipo: 'peso', valor: 4, data: '2026-02-31' } })).status, 400);
    assert.equal((await c.pedir(url, { metodo: 'POST', corpo: { tipo: 'peso', valor: -1, data: '2026-02-10' } })).status, 400);
    assert.equal((await c.pedir(url, { metodo: 'POST', corpo: { tipo: 'ecc', valor: 10, data: '2026-02-10' } })).status, 400);
    assert.equal((await c.pedir(url, { metodo: 'POST', corpo: { tipo: 'ecc', valor: 5, data: '2026-02-10' } })).status, 201);
    assert.equal((await c.pedir(url, { metodo: 'POST', corpo: { tipo: 'contexto', texto: 'Ração seca, passeio diário.', data: '2026-02-10' } })).status, 201);
    assert.equal((await c.pedir('/api/laboratorio/animais', { metodo: 'POST', corpo: { nome: 'X', especie: 'Cão', sexo: 'outro' } })).status, 400);
  });

  test('o último administrador não pode ser rebaixado; papéis válidos apenas', async () => {
    const adm = await entrarComo(srv.base, 'admin@teste.br');
    const eu = (await adm.pedir('/api/sessao')).dados.usuario;
    assert.equal((await adm.pedir(`/api/admin/usuarios/${eu.id}/papel`, { metodo: 'POST', corpo: { papel: 'estudante' } })).status, 409);
    const est = (await adm.pedir('/api/admin/usuarios')).dados.usuarios.find((u) => u.email === 'estudante@teste.br');
    assert.equal((await adm.pedir(`/api/admin/usuarios/${est.id}/papel`, { metodo: 'POST', corpo: { papel: 'dono' } })).status, 400);
    assert.equal((await adm.pedir(`/api/admin/usuarios/${est.id}/papel`, { metodo: 'POST', corpo: { papel: 'professor' } })).status, 200);
    const estudante = await entrarComo(srv.base, 'estudante@teste.br');
    assert.equal((await estudante.pedir('/api/admin/usuarios')).status, 403);
    assert.equal((await estudante.pedir('/api/sessao')).dados.usuario.papel, 'professor', 'papel lido do banco a cada requisição');
  });
});

describe('arquivos estáticos', () => {
  test('não sai da pasta dist e usa cache imutável só em arquivos com hash', async () => {
    const r1 = await fetch(`${srv.base}/../package.json`);
    assert.notEqual(r1.status, 200);
    const r2 = await fetch(`${srv.base}/%2e%2e/package.json`);
    assert.notEqual(r2.status, 200);
    const indice = await fetch(`${srv.base}/`);
    assert.equal(indice.status, 200);
    assert.equal(indice.headers.get('cache-control'), 'no-cache');
    const html = await indice.text();
    const js = html.match(/src="(app\.[^"]+\.js)"/)[1];
    const r3 = await fetch(`${srv.base}/${js}`);
    assert.equal(r3.status, 200);
    assert.match(r3.headers.get('cache-control'), /immutable/);
    assert.equal((await fetch(`${srv.base}/api/nao-existe`)).status, 404);
  });
});
