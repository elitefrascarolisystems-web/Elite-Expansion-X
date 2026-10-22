import { randomUUID } from 'node:crypto';

// Armazém em memória, só para demonstração: tudo se perde quando o servidor
// para. A interface é a mesma do armazém PostgreSQL.
export class ArmazemMemoria {
  constructor() {
    this.modo = 'memoria';
    this.usuarios = new Map();
    this.sessoes = new Map();
    this.registroAuditoria = [];
    this.mapaRevisoes = new Map();
    this.itensBiblioteca = new Map();
    this.mapaAnimais = new Map();
    this.mapaRegistros = new Map();
    this.proximaAuditoria = 1;
  }

  async criarUsuario({ email, nome, papel, senhaHash }) {
    if ([...this.usuarios.values()].some((u) => u.email === email)) {
      throw Object.assign(new Error('E-mail já cadastrado.'), { codigo: 'email_existe' });
    }
    const agora = new Date().toISOString();
    const usuario = { id: randomUUID(), email, nome, papel, senhaHash, criadoEm: agora, atualizadoEm: agora };
    this.usuarios.set(usuario.id, usuario);
    return { ...usuario };
  }

  async usuarioPorEmail(email) {
    const u = [...this.usuarios.values()].find((x) => x.email === email);
    return u ? { ...u } : null;
  }

  async usuarioPorId(id) {
    const u = this.usuarios.get(id);
    return u ? { ...u } : null;
  }

  async listarUsuarios() {
    return [...this.usuarios.values()]
      .map(({ id, email, nome, papel, criadoEm }) => ({ id, email, nome, papel, criadoEm }))
      .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  }

  async contarAdmins() {
    return [...this.usuarios.values()].filter((u) => u.papel === 'admin').length;
  }

  async alterarPapel(id, papel) {
    const u = this.usuarios.get(id);
    if (!u) return false;
    u.papel = papel;
    u.atualizadoEm = new Date().toISOString();
    return true;
  }

  async alterarSenha(id, senhaHash) {
    const u = this.usuarios.get(id);
    if (!u) return false;
    u.senhaHash = senhaHash;
    u.atualizadoEm = new Date().toISOString();
    return true;
  }

  async criarSessao({ tokenHash, usuarioId, csrf, expiraEm }) {
    this.sessoes.set(tokenHash, { tokenHash, usuarioId, csrf, expiraEm: new Date(expiraEm).toISOString() });
  }

  async sessao(tokenHash) {
    const s = this.sessoes.get(tokenHash);
    if (!s) return null;
    if (new Date(s.expiraEm) <= new Date()) {
      this.sessoes.delete(tokenHash);
      return null;
    }
    return { ...s };
  }

  async apagarSessao(tokenHash) {
    this.sessoes.delete(tokenHash);
  }

  async apagarSessoesDoUsuario(usuarioId, excetoTokenHash = null) {
    for (const [hash, s] of this.sessoes) {
      if (s.usuarioId === usuarioId && hash !== excetoTokenHash) this.sessoes.delete(hash);
    }
  }

  async auditar({ ator = null, acao, alvo = null, resumo = null }) {
    this.registroAuditoria.push({ id: this.proximaAuditoria++, quando: new Date().toISOString(), ator, acao, alvo, resumo });
    if (this.registroAuditoria.length > 10_000) this.registroAuditoria.shift();
  }

  async listarAuditoria(limite = 200) {
    return this.registroAuditoria.slice(-limite).reverse().map((x) => ({ ...x }));
  }

  async revisoes() {
    return Object.fromEntries([...this.mapaRevisoes].map(([k, v]) => [k, { ...v }]));
  }

  async definirRevisao(estrutura, { status, nota, revisorId, revisorNome }) {
    const r = { status, nota: nota ?? null, revisorId, revisorNome, atualizadoEm: new Date().toISOString() };
    this.mapaRevisoes.set(estrutura, r);
    return { ...r };
  }

  async biblioteca(usuarioId) {
    return [...this.itensBiblioteca.values()]
      .filter((i) => i.usuarioId === usuarioId)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .map(({ usuarioId: _dono, ...resto }) => structuredClone(resto));
  }

  async adicionarBiblioteca(usuarioId, { tipo, titulo, dados }) {
    const item = { id: randomUUID(), usuarioId, tipo, titulo, dados: structuredClone(dados), criadoEm: new Date().toISOString() };
    this.itensBiblioteca.set(item.id, item);
    const { usuarioId: _dono, ...resto } = item;
    return structuredClone(resto);
  }

  async apagarBiblioteca(usuarioId, id) {
    const item = this.itensBiblioteca.get(id);
    if (!item || item.usuarioId !== usuarioId) return false;
    this.itensBiblioteca.delete(id);
    return true;
  }

  async animais(usuarioId) {
    return [...this.mapaAnimais.values()]
      .filter((a) => a.usuarioId === usuarioId)
      .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
      .map(({ usuarioId: _dono, ...resto }) => ({ ...resto }));
  }

  async animal(usuarioId, id) {
    const a = this.mapaAnimais.get(id);
    if (!a || a.usuarioId !== usuarioId) return null;
    const { usuarioId: _dono, ...resto } = a;
    return { ...resto };
  }

  async criarAnimal(usuarioId, { nome, especie, nascimento, sexo }) {
    const a = { id: randomUUID(), usuarioId, nome, especie, nascimento: nascimento ?? null, sexo: sexo ?? null, criadoEm: new Date().toISOString() };
    this.mapaAnimais.set(a.id, a);
    const { usuarioId: _dono, ...resto } = a;
    return { ...resto };
  }

  async apagarAnimal(usuarioId, id) {
    const a = this.mapaAnimais.get(id);
    if (!a || a.usuarioId !== usuarioId) return false;
    this.mapaAnimais.delete(id);
    for (const [rid, r] of this.mapaRegistros) if (r.animalId === id) this.mapaRegistros.delete(rid);
    return true;
  }

  async registros(usuarioId, animalId) {
    return [...this.mapaRegistros.values()]
      .filter((r) => r.usuarioId === usuarioId && r.animalId === animalId)
      .sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm.localeCompare(b.criadoEm))
      .map(({ usuarioId: _dono, ...resto }) => ({ ...resto }));
  }

  async adicionarRegistro(usuarioId, animalId, { tipo, valor, texto, data }) {
    const r = { id: randomUUID(), animalId, usuarioId, tipo, valor: valor ?? null, texto: texto ?? null, data, criadoEm: new Date().toISOString() };
    this.mapaRegistros.set(r.id, r);
    const { usuarioId: _dono, ...resto } = r;
    return { ...resto };
  }

  async status() {
    return { modo: this.modo, persistente: false, usuarios: this.usuarios.size };
  }

  async fechar() {}
}
