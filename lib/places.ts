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

/** Chave para comparar nomes sem acento, caixa ou espaços repetidos ("Flávia  Silva" = "flavia silva"). */
export function nameKey(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fromList<T extends string>(list: readonly T[], value: string, aliases: Record<string, T> = {}): T | null {
  const key = nameKey(value);
  if (!key) return null;
  return list.find((item) => nameKey(item) === key) ?? aliases[key] ?? list.find((item) => nameKey(item).startsWith(key) && key.length >= 4) ?? null;
}

/** Valores escritos na planilha → opções da plataforma (aceita sem acento e formas curtas). */
export const placeTypeFromText = (value: string) => fromList(PLACE_TYPES, value, {
  escritorio: "Escritório Elite", "escritorio elite": "Escritório Elite", network: "Network / comunidade", comunidade: "Network / comunidade",
  instituicao: "Instituição de ensino", escola: "Instituição de ensino", faculdade: "Instituição de ensino", "ponto de encontro": "Ponto de encontro",
});
export const sectorFromText = (value: string) => fromList(SECTORS, value, {
  comercio: "Comércio e varejo", varejo: "Comércio e varejo", beleza: "Beleza e estética", estetica: "Beleza e estética",
  financas: "Finanças e seguros", seguros: "Finanças e seguros", transporte: "Transporte e logística", logistica: "Transporte e logística",
  turismo: "Turismo e eventos", eventos: "Turismo e eventos", esporte: "Esporte e lazer", lazer: "Esporte e lazer",
  associacao: "Associação / entidade", entidade: "Associação / entidade", governo: "Governo / público", publico: "Governo / público",
  servicos: "Serviços profissionais", agro: "Agronegócio",
});
export const placeLinkFromText = (value: string) => fromList(PLACE_LINKS, value, {
  socio: "Sócio / dono", dono: "Sócio / dono", proprietario: "Sócio / dono", funcionario: "Colaborador", membro: "Membro do network",
});
export const personRoleFromText = (value: string) => fromList(PERSON_ROLES, value, { mentorada: "Mentorado", assinante: "Assinante" });
