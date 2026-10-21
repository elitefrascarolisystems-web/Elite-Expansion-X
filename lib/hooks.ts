import { z } from "zod";
import "./zod-pt";
import { SECTORS } from "./places";

/** Banco de Ganchos (Sistema de Prospecção): situações, canais e o preenchimento das variáveis. */
export const HOOK_SITUATIONS = ["Primeiro contato", "Retomada", "Indicação", "Evento", "Objeção", "Pós-venda"] as const;
export const HOOK_CHANNELS = ["WhatsApp", "Ligação", "Presencial", "E-mail"] as const;
export const HOOK_STATUSES = ["Rascunho", "Aprovado", "Retirado"] as const;
/** Variáveis que o gancho pode usar; a plataforma troca pelos dados do atendimento. */
export const HOOK_VARIABLES = [["{nome}", "nome da pessoa"], ["{primeiro_nome}", "primeiro nome"], ["{cidade}", "cidade"], ["{responsavel}", "quem atende"], ["{empresa}", "sua empresa"]] as const;
export const MAX_HOOK_IMPORT = 50;

export const hookSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().trim().min(3).max(120),
  situation: z.enum(HOOK_SITUATIONS),
  channel: z.enum(HOOK_CHANNELS).default("WhatsApp"),
  sector: z.union([z.enum(SECTORS), z.literal("")]).default(""),
  body: z.string().trim().min(10, "Escreva o gancho com pelo menos 10 letras.").max(1500),
  status: z.enum(HOOK_STATUSES).default("Rascunho"),
});
export type HookInput = z.infer<typeof hookSchema>;
export type HookRecord = HookInput & { id: number; createdBy: string; updatedAt: string };

export type HookContext = { name?: string; city?: string; owner?: string; organization?: string };

/** Troca as variáveis; as que ficarem sem dado viram “…” para a pessoa completar antes de enviar. */
export function fillHook(body: string, context: HookContext): string {
  const firstName = (context.name ?? "").trim().split(/\s+/)[0] ?? "";
  const values: Record<string, string> = {
    "{nome}": context.name?.trim() ?? "", "{primeiro_nome}": firstName, "{cidade}": context.city?.trim() ?? "",
    "{responsavel}": context.owner?.trim() ?? "", "{empresa}": context.organization?.trim() ?? "",
  };
  return body.replace(/\{(nome|primeiro_nome|cidade|responsavel|empresa)\}/g, (key) => values[key] || "…");
}

/** Linhas coladas: "Título | Situação | Texto" (canal e setor opcionais: "| Canal | Setor"). */
export function parseHookLines(text: string): { line: number; input?: Partial<HookInput>; error?: string }[] {
  return text.split(/\r?\n/).map((raw, index) => ({ raw: raw.trim(), line: index + 1 })).filter(({ raw }) => raw).map(({ raw, line }) => {
    const [title, situation, body, channel, sector] = raw.split("|").map((part) => part.trim());
    if (!title || !situation || !body) return { line, error: "Use: Título | Situação | Texto" };
    const sit = HOOK_SITUATIONS.find((s) => s.toLowerCase() === situation.toLowerCase());
    if (!sit) return { line, error: `Situação "${situation}" não existe. Use: ${HOOK_SITUATIONS.join(", ")}.` };
    const ch = channel ? HOOK_CHANNELS.find((c) => c.toLowerCase() === channel.toLowerCase()) : "WhatsApp";
    if (!ch) return { line, error: `Canal "${channel}" não existe. Use: ${HOOK_CHANNELS.join(", ")}.` };
    return { line, input: { title, situation: sit, body, channel: ch, sector: (sector ?? "") as HookInput["sector"] } };
  });
}
