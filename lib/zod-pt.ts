import { z } from "zod";

/**
 * Mensagens de validação em português para toda a plataforma. Mensagens escritas
 * no próprio formulário continuam tendo prioridade; este mapa cobre as padrão,
 * que antes chegavam em inglês para quem estava usando ("Required", "Invalid literal value").
 */
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return { message: issue.received === "undefined" || issue.received === "null" ? "Preencha todos os campos obrigatórios." : "Algum campo está em formato inválido. Revise e tente de novo." };
    case z.ZodIssueCode.invalid_literal:
      return { message: issue.expected === true ? "Marque a confirmação para continuar." : "Valor não permitido." };
    case z.ZodIssueCode.too_small:
      if (issue.type === "string") return { message: issue.minimum === 1 ? "Preencha todos os campos obrigatórios." : `Preencha com pelo menos ${issue.minimum} caracteres.` };
      if (issue.type === "number") return { message: `O valor mínimo é ${issue.minimum}.` };
      return { message: "Faltam informações obrigatórias." };
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `Use no máximo ${issue.maximum} caracteres.` };
      if (issue.type === "number") return { message: `O valor máximo é ${issue.maximum}.` };
      return { message: "Informação acima do limite permitido." };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "Informe um e-mail válido." };
      if (issue.validation === "url") return { message: "Informe um link completo, começando com https://." };
      return { message: "Formato inválido." };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "Escolha uma das opções da lista." };
    case z.ZodIssueCode.invalid_date:
      return { message: "Informe uma data válida." };
    case z.ZodIssueCode.not_finite:
    case z.ZodIssueCode.not_multiple_of:
      return { message: "Informe um número válido." };
    default:
      return { message: ctx.defaultError };
  }
});

export {};
