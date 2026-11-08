/*
 * "Como abordar": dicas curtas pelo nível da pessoa e pelo tipo e setor do local principal.
 * Nunca falam de horário, residência ou rotina da pessoa; em setor sensível (igreja, saúde),
 * só a dica institucional (falar com a instituição, nunca abordar quem a frequenta).
 * A Etapa 5 amplia estas dicas para o plano de plantio de cada lugar.
 */
import type { PlaceType } from "@/lib/places";

export type Level = "Cliente" | "Indicador" | "Multiplicador" | null;

const BY_LEVEL: Record<"Cliente" | "Indicador" | "Multiplicador" | "Sem nível", string> = {
  "Sem nível": "Comece pelo que a pessoa já conhece: quem apresentou vocês ou o local onde ela trabalha.",
  Cliente: "Pergunte como está o resultado e, se ela estiver satisfeita, peça uma indicação de alguém do mesmo meio.",
  Indicador: "Agradeça a indicação e conte o que aconteceu com quem ela indicou; isso a anima a indicar de novo.",
  Multiplicador: "Ela já trouxe clientes: convide para um papel na rede, como embaixadora, com um combinado claro.",
};

const BY_TYPE: Record<PlaceType, string> = {
  Empresa: "Proponha uma conversa rápida com quem decide e leve um exemplo de outro negócio do mesmo setor.",
  "Escritório": "Ofereça um encontro curto para a equipe do escritório, combinado antes com quem coordena.",
  "Network / comunidade": "Peça espaço na pauta de um encontro do grupo, sempre com a autorização de quem organiza.",
  "Instituição de ensino": "Fale com a coordenação ou a direção sobre uma ação institucional; nunca aborde alunos.",
  "Ponto de encontro": "Use o local como referência para marcar a conversa, não como lugar para abordar a pessoa.",
};

const INSTITUTIONAL = "Neste tipo de local, fale só com a instituição (direção ou responsável) e nunca aborde quem o frequenta.";
export const SENSITIVE_SECTORS = ["Religioso", "Saúde"] as const;

/** Até 2 dicas: uma pelo nível e uma pelo local (em setor sensível, só a institucional). */
export function plantingTips(level: Level, place: { type: string; sector: string } | null): string[] {
  const tips = [BY_LEVEL[level ?? "Sem nível"]];
  if (place) {
    if ((SENSITIVE_SECTORS as readonly string[]).includes(place.sector)) return [INSTITUTIONAL];
    const byType = BY_TYPE[place.type as PlaceType];
    if (byType) tips.push(byType);
  }
  return tips.slice(0, 2);
}

/** A situação do gancho pelo nível da pessoa (Banco de Ganchos). */
export const hookSituationFor = (level: Level, hasAttendance: boolean) =>
  level ? "Indicação" : hasAttendance ? "Retomada" : "Primeiro contato";
