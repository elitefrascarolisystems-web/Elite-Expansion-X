/*
 * Lugares de relacionamento da pessoa: regras de LGPD que valem em todas as telas e no servidor.
 * - Vínculo sensível (igreja, ou clínica como paciente, membro ou mentorado) não aponta a pessoa no local:
 *   até a gestão revisar, ela aparece no centro do bairro ou da cidade, e o nome do local só a gestão vê.
 * - Ligações novas (local principal ou lugar extra) passam por `linkRefusal`, conferida no servidor
 *   pelo setor gravado no local (não pelo que a tela mandou).
 * Finalidade: criar relacionamentos nos lugares onde a pessoa já tem vínculo, com a ajuda dela.
 */
import { z } from "zod";

import { PLACE_LINKS } from "@/lib/places";

export const SENSITIVE_HEALTH_LINKS = ["Frequenta", "Membro do network", "Mentorado"] as const;
export const WORK_LINKS = ["Sócio / dono", "Colaborador", "Responsável"] as const;
export const MAX_PLACES = 5;

export const PLACE_PURPOSE = "Para criar relacionamentos nos lugares onde a pessoa já tem vínculo, com a ajuda dela: indicações, parcerias e eventos. Só trabalho, negócios e comunidades: nunca a casa dela, e sem horários.";

export const REFUSAL = {
  religious: "Igreja revela religião (dado sensível). Mapeie o lugar, mas não ligue pessoas a ele.",
  health: "Ser paciente revela dado de saúde.",
  noSector: "Escolha o setor deste local antes de ligar pessoas a ele.",
  association: "Confirme que não é sindicato, partido nem entidade religiosa.",
  school: "Confirme que a própria pessoa estuda ou trabalha aqui (não use para a escola dos filhos).",
  importConfirm: "Ligue esta pessoa pelo mapa, com a confirmação.",
  limit: `Cada pessoa pode ter até ${MAX_PLACES} lugares, contando o local principal.`,
  consent: "Lugares além do principal só com autorização de contato vigente ou papel de Mentorado ou Embaixador ativo.",
  authorize: "Marque que a pessoa contou que tem esse vínculo e concordou em ajudar.",
  otherCity: "O lugar precisa ser da mesma cidade da pessoa.",
} as const;

/** Verdadeiro quando o vínculo pessoa ↔ local é sensível (a pessoa não aparece no ponto do local). */
export function sensitiveLink(place: { sector?: string | null } | null | undefined, link: string | null | undefined): boolean {
  if (!place) return false;
  if (place.sector === "Religioso") return true;
  return place.sector === "Saúde" && (SENSITIVE_HEALTH_LINKS as readonly string[]).includes(String(link ?? ""));
}

export const isSchool = (place: { type?: string | null; sector?: string | null }) => place.type === "Instituição de ensino" || place.sector === "Educação";

/**
 * Por que este vínculo não pode ser gravado (ou null se pode). `confirmations` vêm das caixas da tela;
 * nas importações não há caixa (`fromImport`), e os casos que pedem confirmação são recusados.
 */
export function linkRefusal(place: { type?: string | null; sector?: string | null }, link: string, confirmations: { association?: boolean; school?: boolean } = {}, fromImport = false): string | null {
  const sector = place.sector ?? "";
  if (!sector) return REFUSAL.noSector;
  if (sector === "Religioso") return REFUSAL.religious;
  if (sector === "Saúde" && !(WORK_LINKS as readonly string[]).includes(link)) return REFUSAL.health;
  if (sector === "Associação / entidade") return fromImport ? REFUSAL.importConfirm : confirmations.association ? null : REFUSAL.association;
  if (isSchool(place) && link === "Frequenta") return fromImport ? REFUSAL.importConfirm : confirmations.school ? null : REFUSAL.school;
  return null;
}

/** Vínculo que entra em "A revisar": sensível, local sem setor, associação ou escola com "Frequenta" (antigos). */
export function linkNeedsReview(place: { type?: string | null; sector?: string | null }, link: string) {
  return sensitiveLink(place, link) || !place.sector || place.sector === "Associação / entidade" || (isSchool(place) && link === "Frequenta");
}

/** A mesma regra de `sensitiveLink` em SQL: `b` é o local (businesses) e `tp` a pessoa (territory_people). */
export const sensitiveLinkSql = (b: string, tp: string, linkColumn = `${tp}.place_link`) =>
  `(${b}.sector='Religioso' OR (${b}.sector='Saúde' AND ${linkColumn} IN (${SENSITIVE_HEALTH_LINKS.map((v) => `'${v}'`).join(",")})))`;

/** Local "seguro" da pessoa: o local principal, ou NULL quando o vínculo é sensível. */
export const safePlaceSql = (tp: string) =>
  `(CASE WHEN EXISTS(SELECT 1 FROM businesses sbx WHERE sbx.id=${tp}.place_id AND ${sensitiveLinkSql("sbx", tp)}) THEN NULL ELSE ${tp}.place_id END)`;

/** Vínculo que entra na contagem e na situação do lugar: nem sensível, nem em local sem setor. */
export const countableLinkSql = (b: string, linkColumn: string) => `(${b}.sector<>'' AND NOT ${sensitiveLinkSql(b, "x", linkColumn)})`;

const uuid = z.string().uuid();
export const personPlaceInput = z.object({
  personId: uuid, businessId: uuid, link: z.enum(PLACE_LINKS),
  authorized: z.literal(true, { errorMap: () => ({ message: REFUSAL.authorize }) }),
  confirmAssociation: z.boolean().default(false), confirmSchool: z.boolean().default(false),
});
export const removePlaceInput = z.object({ personId: uuid, businessId: uuid });

/** Visitas de plantio: só listas fixas (sem texto livre). */
export const PLANT_STEPS = ["Pedir apresentação ao responsável", "Visitar junto com {primeiro_nome}", "Levar material aprovado", "Propor evento ou palestra", "Propor parceria", "Pedir indicação"] as const;
export const VISIT_RESULTS = ["Conheci o responsável", "Deixei material aprovado", "Combinei evento ou conversa", "Não deu certo"] as const;
export const stepLabel = (step: string, firstName: string) => step.replace("{primeiro_nome}", firstName || "a pessoa");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
export const planInput = z.object({
  businessId: uuid, personId: uuid.nullable().default(null), step: z.enum(PLANT_STEPS), dueDate: day,
  responsible: z.string().email().max(200), bridge: z.boolean().default(false), requestId: uuid.optional(),
});
export const visitInput = z.object({
  businessId: uuid, personId: uuid.nullable().default(null), result: z.enum(VISIT_RESULTS), day, requestId: uuid.optional(),
});
/** Nome gravado na ação: o passo do plano, "<passo> — <resultado>" ou, sem plano, "Visita — <resultado>". */
export function visitNameAllowed(name: string) {
  const [step, result, extra] = name.split(" — ");
  if (extra !== undefined) return false;
  const stepOk = step === "Visita" ? result !== undefined : (PLANT_STEPS as readonly string[]).some((s) => s.includes("{primeiro_nome}") ? /^Visitar junto com .{1,80}$/.test(step) : s === step);
  return stepOk && (result === undefined || (VISIT_RESULTS as readonly string[]).includes(result));
}
