import type { BLOCKERS, FECHA_LABELS } from "@/lib/followup";

/**
 * Roteiro do Método F.E.C.H.A. (treinamento "Método F.E.C.H.A. — Elite Frascaroli
 * Academy — Time de Vendas"). Orienta a conversa em cada etapa; não envia nada.
 */
export type FechaScript = { key: "retomada" | "financeiro" | "sumiu"; label: string; text: string };

const SCRIPTS: Record<FechaScript["key"], FechaScript> = {
  retomada: { key: "retomada", label: "Retomada", text: "Vi que você tinha decidido entrar, mas o pagamento ainda não foi concluído. O que te impediu de finalizar? Foi pagamento, alguma dúvida ou ficou para depois?" },
  financeiro: { key: "financeiro", label: "Financeiro", text: "Hoje o que está te impedindo é o valor total ou a forma de pagamento? Se resolvermos essa parte, você consegue começar?" },
  sumiu: { key: "sumiu", label: "Sumiu", text: "Você pediu para entrar e percebi que não finalizamos. Se aconteceu algo no caminho, me fala. Se decidiu não seguir agora, também pode me dizer." },
};

/** C — Corrigir: resolver só a trava que apareceu. */
const CORRECTION: Record<(typeof BLOCKERS)[number], string> = {
  "Dinheiro": "Entenda se é valor total, data ou condição de pagamento.",
  "Limite / cartão": "Veja outra forma de pagamento ou condição disponível.",
  "Dúvida": "Responda a dúvida exata e confirme se ficou claro.",
  "Medo / insegurança": "Volte ao motivo que fez a pessoa pedir para entrar.",
  "Prioridade": "Pergunte o que exatamente ainda precisa ser decidido.",
};

export type FechaStep = { letter: string; title: string; say?: string; guidance: string; avoid?: string; scripts: FechaScript[] };

export function fechaStep(status: keyof typeof FECHA_LABELS, blocker?: string): FechaStep | null {
  switch (status) {
    case "pending":
      return {
        letter: "F · E", title: "Fato e Entender",
        say: "“Você tinha me falado que queria entrar e eu vi que seu pagamento ainda não foi concluído. Me fala com sinceridade: o que te impediu de finalizar? Foi pagamento, alguma dúvida ou você acabou deixando para depois?”",
        guidance: "Lembre sem cobrar e descubra a trava real. Nunca tente corrigir um problema que você ainda não identificou.",
        avoid: "“Você ainda tem interesse?” — faz a pessoa voltar para o começo da decisão.",
        scripts: [SCRIPTS.retomada, SCRIPTS.sumiu],
      };
    case "blocker":
      return {
        letter: "C", title: "Corrigir",
        guidance: (blocker && CORRECTION[blocker as keyof typeof CORRECTION]) || "Resolva somente a trava que apareceu.",
        avoid: "Voltar para um discurso longo de vendas.",
        scripts: blocker === "Dinheiro" || blocker === "Limite / cartão" ? [SCRIPTS.financeiro] : [],
      };
    case "resolved":
      return {
        letter: "H", title: "Hora da decisão",
        say: "“Resolvido isso, faz sentido concluirmos sua entrada agora?”",
        guidance: "A conversa precisa terminar com uma decisão, uma data ou uma resposta clara.",
        avoid: "“Qualquer coisa me chama.”",
        scripts: [],
      };
    case "link":
      return {
        letter: "A", title: "Acompanhar",
        guidance: "Mandou o link? Continue presente até uma resposta objetiva: pagou (registre a venda), marcou data (registre dia e horário) ou não vai entrar (encerre a rodada).",
        scripts: [SCRIPTS.sumiu],
      };
    case "future":
      return {
        letter: "A", title: "Retomada futura",
        guidance: "A rodada de 72 horas terminou sem avanço. Saia da cobrança diária e retome só com uma nova data combinada.",
        scripts: [SCRIPTS.retomada],
      };
    default:
      return null;
  }
}

/** Mensagem pronta com o primeiro nome da pessoa. Adapte antes de enviar; nunca envie de forma mecânica. */
export function personalize(script: FechaScript, fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first ? `Oi, ${first}! ${script.text}` : script.text;
}
