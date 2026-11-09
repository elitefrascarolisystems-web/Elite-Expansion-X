/**
 * Situação do embaixador na tela (simplificação, parte 3): 4 em vez de 8. As gravadas continuam como estão:
 * Convidado, Em análise, Aprovado e Em treinamento aparecem como "Em preparação"; Inativo como "Desligado".
 * Escolher "Em preparação" grava "Em treinamento" (a etapa que já conta para a ativação).
 */
export const AMBASSADOR_STEPS = ["Em preparação", "Ativo", "Pausado", "Desligado"] as const;
export type AmbassadorStep = (typeof AMBASSADOR_STEPS)[number];
export function ambassadorStep(status: string | null | undefined): AmbassadorStep {
  if (status === "Ativo" || status === "Pausado") return status;
  if (status === "Desligado" || status === "Inativo") return "Desligado";
  return "Em preparação";
}
export function ambassadorStatusFromStep(step: string, current?: string | null): string {
  if (current && ambassadorStep(current) === step) return current;
  return step === "Em preparação" ? "Em treinamento" : step;
}
/** Código do link do embaixador quando ninguém digita um: EMB- e 6 letras ou números (sem 0/O e 1/I). */
export function ambassadorCode(random: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "EMB-" + Array.from({ length: 6 }, () => chars[random(chars.length)]).join("");
}
