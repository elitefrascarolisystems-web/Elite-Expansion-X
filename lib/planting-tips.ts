/*
 * "Como abordar": as dicas da casa (fixas, revisadas na Etapa 0), escolhidas pelo nível da pessoa e pelo
 * tipo, setor, vínculo e situação do lugar. Até 2, da mais específica para a genérica. Em setor sensível
 * (igreja, saúde fora do trabalho, associação), só a institucional. Nunca horário marcado, residência ou
 * rotina da pessoa; variáveis {primeiro_nome}, {lugar} e {empresa}.
 */
import type { PlaceSituation } from "@/lib/place-situation";
import type { PlaceType } from "@/lib/places";

export type Level = "Cliente" | "Indicador" | "Multiplicador" | null;
export type TipContext = {
  nivel: Level; tipo?: string | null; setor?: string | null; vinculo?: string | null; situacao?: PlaceSituation | null;
  publico?: "equipe" | "mentorado"; semAtendimento?: boolean; indicacaoSemCompra?: boolean;
};

type Tip = { id: string; text: string; when: (c: TipContext) => boolean; weight: number };
const has = (list: readonly (string | null | undefined)[], value: string | null | undefined) => !!value && list.includes(value);

export const INSTITUTIONAL = "Trabalhe com a instituição, nunca com a lista de quem frequenta. Faça: combine com o responsável o apoio a um evento ou projeto aberto e registre em Rede → Parceiros e eventos. Evite: registrar quem frequenta, abordar durante celebração ou reunião, ou usar lista de membros.";

const TIPS: Tip[] = [
  { id: "autorizacao", weight: 9, when: (c) => !!c.semAtendimento,
    text: "Primeiro, a autorização. Faça: antes de qualquer mensagem, pergunte pessoalmente se {primeiro_nome} aceita contato da {empresa} e para quê, e registre em \"Iniciar atendimento\". Evite: mandar WhatsApp para quem ainda não autorizou." },
  { id: "dono", weight: 8, when: (c) => c.nivel === "Cliente" && (c.tipo === "Empresa" || c.setor === "Comércio e varejo") && c.vinculo === "Sócio / dono" && c.situacao === "Avançar",
    text: "Peça a indicação de outro dono. Faça: nas primeiras semanas depois do pagamento, peça um nome por vez. Diga: \"{primeiro_nome}, quem do {lugar} ou do seu ramo também quer crescer este ano?\" Evite: pedir lista de contatos ou falar com alguém antes de essa pessoa autorizar." },
  { id: "ciclo", weight: 7, when: (c) => c.nivel === "Indicador" && !!c.indicacaoSemCompra,
    text: "Feche o ciclo da indicação. Faça: conte a {primeiro_nome} que a pessoa indicada já foi atendida e agradeça, sem valores nem detalhes da conversa. Evite: cobrar dela o resultado da indicação." },
  { id: "multiplicar", weight: 8, when: (c) => c.nivel === "Multiplicador" && c.tipo === "Network / comunidade" && c.vinculo === "Membro do network" && c.situacao === "Dominado",
    text: "Convide para multiplicar de propósito. Faça: agradeça em particular e convide para o programa de embaixadores ou para apresentar a {empresa} no próximo encontro do {lugar}. Evite: expor a pessoa indicada ou prometer recompensa fora das regras do programa." },
  { id: "balcao", weight: 7, when: (c) => c.vinculo === "Colaborador" && has(["Comércio e varejo", "Alimentação"], c.setor) && c.situacao === "Plantar",
    text: "Plante pelo responsável, não pelo balcão. Faça: peça a {primeiro_nome} que apresente quem decide, combine a visita num horário tranquilo do estabelecimento e leve só material aprovado. Evite: abordar clientes da loja ou atrapalhar o atendimento." },
  { id: "esporte", weight: 7, when: (c) => c.nivel === "Cliente" && c.setor === "Esporte e lazer" && c.vinculo === "Frequenta",
    text: "Relação antes de negócio. Faça: peça a {primeiro_nome} que apresente você ao dono ou ao professor e proponha uma conversa aberta para alunos que empreendem. Evite: abordar alunos durante o treino. Nunca anote dias ou horários em que ela treina." },
  { id: "ensino", weight: 6, when: (c) => (c.tipo === "Instituição de ensino" || c.setor === "Educação") && has(["Responsável", "Colaborador"], c.vinculo),
    text: "Fale com a coordenação, não com os alunos. Faça: proponha uma aula aberta ou oficina gratuita, com inscrição em que a própria pessoa autoriza o contato. Evite: pedir lista de alunos e qualquer contato com menores de idade." },
];

/** Dica genérica de cada tipo de lugar (quando não há dica específica). */
const BY_TYPE: Record<PlaceType, string> = {
  Empresa: "Proponha uma conversa rápida com quem decide no {lugar} e leve um exemplo de outro negócio do mesmo setor. Evite: chegar sem ser apresentado.",
  "Escritório": "Ofereça um encontro curto para a equipe do {lugar}, combinado antes com quem coordena. Evite: abordar pessoas uma a uma no escritório.",
  "Network / comunidade": "Peça espaço na pauta de um encontro do {lugar}, sempre com a autorização de quem organiza. Evite: usar a lista de membros.",
  "Instituição de ensino": "Fale com a coordenação ou a direção sobre uma ação institucional. Evite: qualquer contato com alunos ou menores de idade.",
  "Ponto de encontro": "Use o {lugar} só como referência para marcar a conversa. Evite: transformar o lugar em ponto de abordagem.",
};
const BY_LEVEL: Record<"Cliente" | "Indicador" | "Multiplicador" | "Sem nível", string> = {
  "Sem nível": "Comece pelo que {primeiro_nome} já conhece: quem apresentou vocês ou o lugar onde trabalha.",
  Cliente: "Pergunte a {primeiro_nome} como está o resultado e, se estiver satisfeita, peça uma indicação de alguém do mesmo meio.",
  Indicador: "Agradeça a indicação e conte a {primeiro_nome} o que aconteceu com quem ela indicou, sem detalhes da conversa.",
  Multiplicador: "{primeiro_nome} já trouxe clientes: convide para um papel na rede, como embaixadora, com um combinado claro.",
};
export const MENTORADO_TIP = "No {lugar}: quem você conhece que quer crescer? Conte para a pessoa antes e, se ela aceitar, use \"Indicar alguém\". Uma boa ideia: sugerir ao responsável uma conversa curta com a {empresa}.";
export const SENSITIVE_SECTORS = ["Religioso", "Saúde", "Associação / entidade"] as const;

/** Lugar sensível para dicas: igreja, associação, ou saúde fora de um vínculo de trabalho. */
const sensitivePlace = (c: TipContext) => c.setor === "Religioso" || c.setor === "Associação / entidade" || (c.setor === "Saúde" && !has(["Sócio / dono", "Colaborador", "Responsável"], c.vinculo));

/** Até 2 dicas, da mais específica para a genérica. */
export function tipsFor(c: TipContext): string[] {
  if (c.publico === "mentorado") return [MENTORADO_TIP];
  if (c.setor && sensitivePlace(c)) return [INSTITUTIONAL];
  const specific = TIPS.filter((t) => t.when(c)).sort((x, y) => y.weight - x.weight).map((t) => t.text);
  const generic = c.tipo && BY_TYPE[c.tipo as PlaceType] ? [BY_TYPE[c.tipo as PlaceType]] : [];
  return [...new Set([...specific, ...generic, BY_LEVEL[c.nivel ?? "Sem nível"]])].slice(0, 2);
}

/** Troca as variáveis; o que faltar vira "a pessoa", "este lugar" ou "sua empresa". */
export const fillTip = (text: string, v: { firstName?: string; place?: string; company?: string }) =>
  text.replaceAll("{primeiro_nome}", v.firstName || "a pessoa").replaceAll("{lugar}", v.place || "este lugar").replaceAll("{empresa}", v.company || "sua empresa");

/** Compatível com a Etapa 4: dicas pelo nível e pelo local principal. */
export function plantingTips(level: Level, place: { type: string; sector: string } | null): string[] {
  return tipsFor({ nivel: level, tipo: place?.type ?? null, setor: place?.sector ?? null });
}

/** A situação do gancho para a pessoa e o lugar (Banco de Ganchos). */
export function hookSituationFor(level: Level, hasAttendance: boolean, extra: { late?: boolean; eventPlan?: boolean; oldClient?: boolean } = {}) {
  if (extra.eventPlan) return "Evento";
  if (!hasAttendance) return "Primeiro contato";
  if (extra.late) return "Retomada";
  if (extra.oldClient) return "Pós-venda";
  return level ? "Indicação" : "Retomada";
}
