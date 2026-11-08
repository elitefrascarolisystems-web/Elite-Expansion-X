/*
 * Página da pessoa → "Próximo passo": 1 frase e 1 botão. As regras são testadas nesta ordem
 * e a primeira que vale decide. Quem não vê o atendimento (o Comercial que só cadastrou a pessoa)
 * pula as regras 2 a 6: cada pessoa tem um atendimento só, e ele é de outra pessoa da equipe.
 */
export type NextStepAction =
  | "nenhuma" | "registrar-retorno" | "abrir-acompanhamento" | "continuar-fecha" | "iniciar-atendimento" | "peca-gestao"
  | "pedir-indicacao" | "marcar-encontro" | "registrar-visita" | "planejar-visita" | "ver-indicacoes" | "cadastrar-embaixador" | "registrar-interacao";

export type NextStepInput = {
  revoked: boolean;
  /** Atendimento vigente que quem vê pode ver (gestão ou responsável). */
  attendance: { late: boolean; today: boolean; fecha: boolean } | null;
  /** Existe atendimento, mesmo que de outra pessoa da equipe. */
  hasAttendance: boolean;
  /** Quem vê não enxerga o atendimento (é de outra pessoa da equipe). */
  attendanceHidden: boolean;
  canStartAttendance: boolean;
  isClient: boolean;
  referredCount: number;
  /** Só para o Administrador, que cuida de Rede → Mentorados. */
  mentoradoWithoutMeeting: boolean;
  plantingVisitOverdue?: boolean;
  placeAdvanceWithoutPlan?: boolean;
  referredWithoutAttendance: number;
  multiplierWithoutAmbassador: boolean;
  canAddAmbassador: boolean;
};

export type NextStep = { rule: number; text: string; action: NextStepAction; button: string | null };

export function nextStep(p: NextStepInput): NextStep {
  if (p.revoked) return { rule: 1, text: "A pessoa revogou a autorização: não entre em contato.", action: "nenhuma", button: null };
  if (!p.attendanceHidden) {
    if (p.attendance?.late) return { rule: 2, text: "O retorno está atrasado.", action: "registrar-retorno", button: "Registrar retorno" };
    if (p.attendance?.today) return { rule: 3, text: "Tem retorno marcado para hoje.", action: "abrir-acompanhamento", button: "Abrir acompanhamento" };
    if (p.attendance?.fecha) return { rule: 4, text: "O Método F.E.C.H.A. está em andamento.", action: "continuar-fecha", button: "Continuar F.E.C.H.A." };
    if (!p.hasAttendance) return p.canStartAttendance
      ? { rule: 5, text: "Ainda não há atendimento com esta pessoa.", action: "iniciar-atendimento", button: "Iniciar atendimento" }
      : { rule: 5, text: "Ainda não há atendimento: peça à gestão para iniciar.", action: "peca-gestao", button: null };
    if (p.isClient && p.referredCount === 0) return { rule: 6, text: "É Cliente e ainda não indicou ninguém.", action: "pedir-indicacao", button: "Pedir indicação" };
  }
  if (p.mentoradoWithoutMeeting) return { rule: 7, text: "Mentorado sem próximo encontro marcado.", action: "marcar-encontro", button: "Marcar encontro" };
  if (p.plantingVisitOverdue) return { rule: 8, text: "A visita de plantio passou da data.", action: "registrar-visita", button: "Registrar visita" };
  if (p.placeAdvanceWithoutPlan) return { rule: 9, text: "Um lugar dela está pronto para avançar e ainda não tem plano.", action: "planejar-visita", button: "Planejar visita" };
  if (p.referredWithoutAttendance > 0) return { rule: 10, text: `${p.referredWithoutAttendance === 1 ? "1 pessoa indicada por ela ainda não tem" : `${p.referredWithoutAttendance} pessoas indicadas por ela ainda não têm`} atendimento.`, action: "ver-indicacoes", button: "Ver indicações" };
  if (p.multiplierWithoutAmbassador && p.canAddAmbassador) return { rule: 11, text: "É Multiplicadora e ainda não tem papel de embaixador.", action: "cadastrar-embaixador", button: "Cadastrar papel de embaixador" };
  return { rule: 12, text: "Tudo em dia. Registre a próxima conversa ou visita.", action: "registrar-interacao", button: "Registrar interação" };
}
