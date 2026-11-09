import type { SettingsView } from "@/lib/expansion-types";

/**
 * As regras da expansão em frases (Gestão → Empresa → Regras e cálculos). Os números ficam dentro de "Editar".
 * Simplificação, parte 4 (S9).
 */
export function rulesSentences(s: Pick<SettingsView, "minActiveAmbassadors" | "minConfirmedPayments" | "minActivePartners" | "minDataPeriods" | "inactivityDays" | "organicGoalPercent">): string[] {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = [
    s.minActiveAmbassadors > 0 ? plural(s.minActiveAmbassadors, "embaixador ativo", "embaixadores ativos") : "",
    s.minConfirmedPayments > 0 ? plural(s.minConfirmedPayments, "pagamento confirmado", "pagamentos confirmados") : "",
    s.minActivePartners > 0 ? plural(s.minActivePartners, "parceiro ativo", "parceiros ativos") : "",
  ].filter(Boolean);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}` : parts[0];
  const out: string[] = [];
  if (!list || !s.minDataPeriods) out.push("Ainda falta definir quando uma cidade avança: toque em “Editar” e preencha os mínimos (embaixadores, pagamentos e meses de dados).");
  else out.push(`Uma cidade avança quando tem ${list}, com pelo menos ${plural(s.minDataPeriods, "mês", "meses")} de dados.`);
  out.push(s.organicGoalPercent > 0 ? `A meta é que ${s.organicGoalPercent}% dos atendimentos venham sem mídia paga.` : "Não há meta de atendimentos sem mídia paga.");
  out.push(s.inactivityDays > 0 ? `Um embaixador fica inativo depois de ${plural(s.inactivityDays, "dia", "dias")} sem atividade.` : "Qualquer atividade registrada conta para o embaixador ficar ativo.");
  return out;
}
