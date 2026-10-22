import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { migrar } from './migracoes.js';

const iso = (v) => (v instanceof Date ? v.toISOString() : v);
const dia = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);

const usuarioDe = (r) => r && ({
  id: r.id, email: r.email, nome: r.nome, papel: r.papel, senhaHash: r.senha_hash,
  criadoEm: iso(r.criado_em), atualizadoEm: iso(r.atualizado_em),
});

export class ArmazemPostgres {
  constructor(url, { log = () => {} } = {}) {
    this.modo = 'postgres';
    this.pool = new pg.Pool({ connectionString: url, max: 10 });
    this.log = log;
    // Datas sem horário voltam como texto AAAA-MM-DD.
    pg.types.setTypeParser(1082, (v) => v);
  }

  async iniciar() {
    this.migracoes = await migrar(this.pool, { log: this.log });
    return this;
  }

  async criarUsuario({ email, nome, papel, senhaHash }) {
    try {
      const { rows } = await this.pool.query(
        'INSERT INTO usuarios (id, email, nome, papel, senha_hash) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [randomUUID(), email, nome, papel, senhaHash],
      );
      return usuarioDe(rows[0]);
    } catch (erro) {
      if (erro.code === '23505') throw Object.assign(new Error('E-mail já cadastrado.'), { codigo: 'email_existe' });
      throw erro;
    }
  }

  async usuarioPorEmail(email) {
    const { rows } = await this.pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    return usuarioDe(rows[0]) ?? null;
  }

  async usuarioPorId(id) {
    const { rows } = await this.pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    return usuarioDe(rows[0]) ?? null;
  }

  async listarUsuarios() {
    const { rows } = await this.pool.query('SELECT id, email, nome, papel, criado_em FROM usuarios ORDER BY criado_em');
    return rows.map((r) => ({ id: r.id, email: r.email, nome: r.nome, papel: r.papel, criadoEm: iso(r.criado_em) }));
  }

  async contarAdmins() {
    const { rows } = await this.pool.query("SELECT count(*)::int AS n FROM usuarios WHERE papel = 'admin'");
    return rows[0].n;
  }

  async alterarPapel(id, papel) {
    const r = await this.pool.query('UPDATE usuarios SET papel = $2, atualizado_em = now() WHERE id = $1', [id, papel]);
    return r.rowCount === 1;
  }

  async alterarSenha(id, senhaHash) {
    const r = await this.pool.query('UPDATE usuarios SET senha_hash = $2, atualizado_em = now() WHERE id = $1', [id, senhaHash]);
    return r.rowCount === 1;
  }

  async criarSessao({ tokenHash, usuarioId, csrf, expiraEm }) {
    await this.pool.query(
      'INSERT INTO sessoes (token_hash, usuario_id, csrf, expira_em) VALUES ($1, $2, $3, $4)',
      [tokenHash, usuarioId, csrf, new Date(expiraEm)],
    );
  }

  async sessao(tokenHash) {
    const { rows } = await this.pool.query('SELECT * FROM sessoes WHERE token_hash = $1 AND expira_em > now()', [tokenHash]);
    const s = rows[0];
    return s ? { tokenHash: s.token_hash, usuarioId: s.usuario_id, csrf: s.csrf, expiraEm: iso(s.expira_em) } : null;
  }

  async apagarSessao(tokenHash) {
    await this.pool.query('DELETE FROM sessoes WHERE token_hash = $1', [tokenHash]);
  }

  async apagarSessoesDoUsuario(usuarioId, excetoTokenHash = null) {
    await this.pool.query(
      'DELETE FROM sessoes WHERE usuario_id = $1 AND token_hash IS DISTINCT FROM $2',
      [usuarioId, excetoTokenHash],
    );
  }

  async auditar({ ator = null, acao, alvo = null, resumo = null }) {
    await this.pool.query('INSERT INTO auditoria (ator, acao, alvo, resumo) VALUES ($1, $2, $3, $4)', [ator, acao, alvo, resumo]);
  }

  async listarAuditoria(limite = 200) {
    const { rows } = await this.pool.query('SELECT * FROM auditoria ORDER BY id DESC LIMIT $1', [limite]);
    return rows.map((r) => ({ id: Number(r.id), quando: iso(r.quando), ator: r.ator, acao: r.acao, alvo: r.alvo, resumo: r.resumo }));
  }

  async revisoes() {
    const { rows } = await this.pool.query('SELECT * FROM revisoes');
    return Object.fromEntries(rows.map((r) => [r.estrutura, {
      status: r.status, nota: r.nota, revisorId: r.revisor_id, revisorNome: r.revisor_nome, atualizadoEm: iso(r.atualizado_em),
    }]));
  }

  async definirRevisao(estrutura, { status, nota, revisorId, revisorNome }) {
    const { rows } = await this.pool.query(
      `INSERT INTO revisoes (estrutura, status, nota, revisor_id, revisor_nome, atualizado_em)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (estrutura) DO UPDATE SET status = $2, nota = $3, revisor_id = $4, revisor_nome = $5, atualizado_em = now()
       RETURNING *`,
      [estrutura, status, nota ?? null, revisorId, revisorNome],
    );
    const r = rows[0];
    return { status: r.status, nota: r.nota, revisorId: r.revisor_id, revisorNome: r.revisor_nome, atualizadoEm: iso(r.atualizado_em) };
  }

  async biblioteca(usuarioId) {
    const { rows } = await this.pool.query('SELECT * FROM biblioteca WHERE usuario_id = $1 ORDER BY criado_em DESC', [usuarioId]);
    return rows.map((r) => ({ id: r.id, tipo: r.tipo, titulo: r.titulo, dados: r.dados, criadoEm: iso(r.criado_em) }));
  }

  async adicionarBiblioteca(usuarioId, { tipo, titulo, dados }) {
    const { rows } = await this.pool.query(
      'INSERT INTO biblioteca (id, usuario_id, tipo, titulo, dados) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [randomUUID(), usuarioId, tipo, titulo, JSON.stringify(dados)],
    );
    const r = rows[0];
    return { id: r.id, tipo: r.tipo, titulo: r.titulo, dados: r.dados, criadoEm: iso(r.criado_em) };
  }

  async apagarBiblioteca(usuarioId, id) {
    const r = await this.pool.query('DELETE FROM biblioteca WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    return r.rowCount === 1;
  }

  async animais(usuarioId) {
    const { rows } = await this.pool.query('SELECT * FROM lab_animais WHERE usuario_id = $1 ORDER BY criado_em', [usuarioId]);
    return rows.map(animalDe);
  }

  async animal(usuarioId, id) {
    const { rows } = await this.pool.query('SELECT * FROM lab_animais WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    return rows[0] ? animalDe(rows[0]) : null;
  }

  async criarAnimal(usuarioId, { nome, especie, nascimento, sexo }) {
    const { rows } = await this.pool.query(
      'INSERT INTO lab_animais (id, usuario_id, nome, especie, nascimento, sexo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [randomUUID(), usuarioId, nome, especie, nascimento ?? null, sexo ?? null],
    );
    return animalDe(rows[0]);
  }

  async apagarAnimal(usuarioId, id) {
    const r = await this.pool.query('DELETE FROM lab_animais WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    return r.rowCount === 1;
  }

  async registros(usuarioId, animalId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM lab_registros WHERE usuario_id = $1 AND animal_id = $2 ORDER BY data, criado_em',
      [usuarioId, animalId],
    );
    return rows.map(registroDe);
  }

  async adicionarRegistro(usuarioId, animalId, { tipo, valor, texto, data }) {
    const { rows } = await this.pool.query(
      'INSERT INTO lab_registros (id, animal_id, usuario_id, tipo, valor, texto, data) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [randomUUID(), animalId, usuarioId, tipo, valor ?? null, texto ?? null, data],
    );
    return registroDe(rows[0]);
  }

  async status() {
    const { rows } = await this.pool.query('SELECT count(*)::int AS n FROM usuarios');
    return { modo: this.modo, persistente: true, usuarios: rows[0].n, migracoes: this.migracoes?.total ?? null };
  }

  async fechar() {
    await this.pool.end();
  }
}

function animalDe(r) {
  return { id: r.id, nome: r.nome, especie: r.especie, nascimento: dia(r.nascimento), sexo: r.sexo, criadoEm: iso(r.criado_em) };
}

function registroDe(r) {
  return {
    id: r.id, animalId: r.animal_id, tipo: r.tipo,
    valor: r.valor === null ? null : Number(r.valor), texto: r.texto, data: dia(r.data), criadoEm: iso(r.criado_em),
  };
}
