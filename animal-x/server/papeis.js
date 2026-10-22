export const PAPEIS = {
  estudante: 'Estudante',
  professor: 'Professor',
  especialista: 'Especialista',
  revisor: 'Revisor científico',
  instituicao: 'Instituição',
  suporte: 'Suporte',
  mentor: 'Mentor',
  admin: 'Administrador',
};

// O administrador gerencia contas e auditoria, mas não lê dados de animais,
// tutores, biblioteca ou laboratório de ninguém. Esses dados só são lidos
// pelo próprio dono, em qualquer papel.
const PERMISSOES = {
  'revisao:alterar': ['revisor'],
  'usuarios:listar': ['admin', 'suporte'],
  'usuarios:papel': ['admin'],
  'auditoria:ler': ['admin'],
  'sistema:status': ['admin', 'suporte'],
  'instituicao:ver': ['instituicao', 'professor', 'admin'],
};

export function pode(usuario, permissao) {
  if (!usuario) return false;
  return (PERMISSOES[permissao] ?? []).includes(usuario.papel);
}

export function papelValido(papel) {
  return Object.hasOwn(PAPEIS, papel);
}

export const STATUS_REVISAO = {
  nao_revisado: 'Não revisado',
  em_revisao: 'Em revisão',
  revisado: 'Revisado',
};
