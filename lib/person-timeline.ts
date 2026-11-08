/*
 * Página da pessoa → "Histórico": junta as fontes numa linha do tempo só com o dia (sem hora).
 * Cada item sai com `at` no meio-dia de Brasília: uma data só com o dia lida como meia-noite UTC
 * cairia no dia anterior.
 */
export type PersonEventKind =
  | "privacidade" | "pagamento" | "venda" | "etapa" | "atividade" | "acompanhamento" | "atendimento"
  | "autorizacao" | "revogacao" | "indicacao" | "interacao" | "mentoria" | "embaixador" | "papel" | "atualizacao" | "cadastro";

/** Desempate dentro do mesmo dia: o mais importante primeiro. */
const ORDER: PersonEventKind[] = ["privacidade", "pagamento", "venda", "etapa", "atividade", "acompanhamento", "atendimento", "revogacao", "autorizacao", "indicacao", "interacao", "mentoria", "embaixador", "papel", "atualizacao", "cadastro"];

export type PersonEvent = { id: string; kind: PersonEventKind; date: string; title: string; detail?: string };
export type PersonTimelineItem = PersonEvent & { at: string; day: string };

const toneOf: Partial<Record<PersonEventKind, "gold" | "good" | "alert">> = { pagamento: "good", venda: "gold", revogacao: "alert", privacidade: "alert", indicacao: "gold" };
export const timelineTone = (kind: PersonEventKind) => toneOf[kind] ?? "neutral";

/** O dia de Brasília de uma data em qualquer um dos formatos gravados (só o dia, com -03:00, ou UTC). */
export function brazilDay(value: string): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/-03:00$/.test(value)) return value.slice(0, 10);
  const iso = /[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : value.replace(" ", "T") + "Z";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return new Date(time - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** Ordena do mais novo para o mais antigo, desempata pelo tipo e entrega `at` ao meio-dia de Brasília. */
export function buildPersonTimeline(events: PersonEvent[], limit = 30): { items: PersonTimelineItem[]; more: boolean } {
  const list = events.flatMap((e) => { const day = brazilDay(e.date); return day ? [{ ...e, day, at: `${day}T12:00:00-03:00` }] : []; })
    .sort((x, y) => y.day.localeCompare(x.day) || ORDER.indexOf(x.kind) - ORDER.indexOf(y.kind) || x.id.localeCompare(y.id));
  return { items: list.slice(0, limit), more: list.length > limit };
}
