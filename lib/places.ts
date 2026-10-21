/**
 * Locais do mapa: empresas, escritórios, redes de network, instituições e pontos de
 * encontro. Cada local tem um tipo e, se for empresa, um setor; o ícone no mapa vem
 * do tipo (ou do setor, para empresas), para identificar o que é olhando de cima.
 */
export const PLACE_TYPES = ["Empresa", "Escritório Elite", "Network / comunidade", "Instituição de ensino", "Ponto de encontro"] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

export const SECTORS = [
  "Comércio e varejo", "Alimentação", "Saúde", "Beleza e estética", "Educação", "Tecnologia", "Indústria",
  "Construção", "Imobiliário", "Finanças e seguros", "Agronegócio", "Serviços profissionais",
  "Transporte e logística", "Automotivo", "Turismo e eventos", "Esporte e lazer", "Religioso",
  "Associação / entidade", "Governo / público", "Outro",
] as const;
export type Sector = (typeof SECTORS)[number];

/** Situação da empresa na relação com a Elite. */
export const BUSINESS_STATUSES = ["Identificada", "Selecionada", "Contato autorizado", "Cliente", "Assinante", "Parceira"] as const;

/** Como a pessoa se liga ao local (aparece no ponto do local, nunca na residência). */
export const PLACE_LINKS = ["Sócio / dono", "Colaborador", "Mentorado", "Membro do network", "Responsável", "Frequenta"] as const;

/** Papéis de pessoa no mapa (além de Líder, Embaixador, Lead e Cliente, que vêm de outros cadastros). */
export const PERSON_ROLES = ["Mentor", "Mentorado", "Equipe", "Parceiro", "Vendedor", "Assinante", "Network"] as const;

/** Rótulo usado para o ícone de um local a partir dos papéis gravados ("Tipo,Setor"). */
export function placeIconLabel(roles: string[]): string {
  const type = roles[0];
  if (type && type !== "Empresa" && (PLACE_TYPES as readonly string[]).includes(type)) return type;
  return roles.find((r) => (SECTORS as readonly string[]).includes(r)) ?? "Empresa";
}
