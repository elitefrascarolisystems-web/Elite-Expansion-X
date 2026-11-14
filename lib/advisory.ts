/**
 * Acesso da Assessoria Elite às empresas clientes: quem decide é a empresa.
 * "liberado" (padrão, como sempre foi), "prazo" (até uma data, inclusive) ou "desligado".
 */
export const ADVISORY_MODES = ["liberado", "prazo", "desligado"] as const;
export type AdvisoryMode = (typeof ADVISORY_MODES)[number];

export type AdvisoryPolicy = {
  mode: AdvisoryMode; until: string | null; allowed: boolean; label: string; changedBy: string; changedAt: string | null;
  /** Últimas entradas da assessoria e mudanças da regra (do Histórico). */
  events: { at: string; actor: string; action: string; summary: string }[];
};

/** Vale hoje? `today` e `until` no formato AAAA-MM-DD (dia de Brasília). */
export function advisoryAllowed(mode: string | null | undefined, until: string | null | undefined, today: string): boolean {
  if (mode === "desligado") return false;
  if (mode === "prazo") return Boolean(until) && String(until) >= today;
  return true;
}

export function advisoryLabel(mode: string | null | undefined, until: string | null | undefined, today: string): string {
  if (mode === "desligado") return "Desligado pela empresa";
  if (mode === "prazo") {
    const date = until ? until.split("-").reverse().join("/") : "";
    return advisoryAllowed(mode, until, today) ? `Liberado até ${date}` : `Prazo encerrado em ${date}`;
  }
  return "Liberado";
}
