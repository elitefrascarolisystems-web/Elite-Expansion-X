import type { ZodError } from "zod";

/**
 * Nome de cada campo como aparece nos formulários. Mensagens de validação
 * genéricas ("Use no máximo 30 caracteres.") ganham o nome do campo na frente,
 * para a pessoa saber o que corrigir.
 */
const FIELD_LABELS: Record<string, string> = {
  name: "Nome", email: "E-mail", whatsapp: "WhatsApp", code: "Código único", city: "Cidade", cityId: "Cidade",
  title: "Título", body: "Texto", note: "Observação", notes: "Observações", description: "Descrição", message: "Mensagem",
  ownerEmail: "E-mail do responsável", ownerName: "Nome do responsável", assignedToEmail: "Responsável comercial",
  consentSource: "Como a autorização foi recebida", consentPurpose: "Finalidade informada", sourceLabel: "Origem detalhada",
  campaign: "Campanha", utmSource: "UTM source", utmMedium: "UTM medium", utmCampaign: "UTM campaign",
  nextAction: "Próxima ação", dueDate: "Data", dueAt: "Data", reason: "Motivo", category: "Categoria", type: "Tipo",
  status: "Situação", level: "Nível", role: "Função", channel: "Canal", period: "Período", plan: "Plano", priceCents: "Valor",
  amountCents: "Valor", product: "Produto", segment: "Atividade", address: "Endereço comercial", district: "Bairro",
  sector: "Setor", placeType: "Tipo de local", placeLink: "Vínculo", link: "Link", url: "Link", company: "Empresa",
  contactName: "Nome", teamSize: "Tamanho da equipe", state: "Estado", phase: "Fase", task: "Tarefa", situation: "Situação",
  temperature: "Temperatura", stage: "Etapa", lostReason: "Motivo da perda", pauseReason: "Motivo de pausa",
  referralBaseUrl: "Link-base de indicação", salesGoal: "Meta de vendas", ambassadorGoal: "Meta de embaixadores",
  trainingProgress: "Treinamento concluído", satisfaction: "Satisfação", region: "Região", responsible: "Responsável",
};

/** Primeira mensagem do erro, com o nome do campo quando ela ainda não diz qual é. */
export function validationMessage(error: ZodError, fallback = "Revise os campos.") {
  let issue = error.issues[0];
  // Em campos com mais de uma forma aceita, o caminho do campo está dentro da primeira tentativa.
  if (issue?.code === "invalid_union") {
    const inner = issue.unionErrors.flatMap((e) => e.issues);
    issue = inner.find((i) => i.code !== "invalid_literal" && i.code !== "invalid_type") ?? inner[0] ?? issue;
  }
  if (!issue) return fallback;
  const key = [...issue.path].reverse().find((part) => typeof part === "string") as string | undefined;
  const label = key ? FIELD_LABELS[key] : undefined;
  // Mensagens escritas para o campo ("WhatsApp: DDD e número.") já dizem qual é.
  if (!label || issue.message.includes(":") || issue.message.toLowerCase().includes(label.toLowerCase())) return issue.message;
  return `${label}: ${issue.message.charAt(0).toLowerCase()}${issue.message.slice(1)}`;
}
