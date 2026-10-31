import { z, ZodError } from "zod";
import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { AuthError, createPasswordLink } from "@/db/auth";
import { ActionError, executeAction } from "@/db/mutations";
import { planLimitFromDatabase } from "@/db/plan";
import { markGuideSeen, resetGuides } from "@/db/guides";
import { getDashboardData } from "@/db/queries";
import { brazilTimestamp, database } from "@/db/runtime";
import { canPerform } from "@/lib/expansion-permissions";
import { parseActionPayload } from "@/lib/expansion-validation";
import { sameOrigin } from "@/lib/session-cookie";
import { isGuideKey } from "@/lib/tab-guide-keys";
import { MAX_TEAM_ROWS } from "@/lib/team";
import { organizationFromRequest } from "@/lib/tenant-request";
import { validationMessage } from "@/lib/validation-message";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const inviteBody = z.object({
  action: z.literal("invite"),
  rows: z.array(z.object({
    name: z.string(), email: z.string(), role: z.string(), cityId: z.number().int().nullable(),
    title: z.string().default(""), mentorshipCycle: z.number().int().default(0),
  })).min(1).max(MAX_TEAM_ROWS),
});

type InviteResult = { email: string; name: string; ok: boolean; link?: string; error?: string };

function rowError(error: unknown) {
  if (error instanceof ZodError) return validationMessage(error, "Revise os dados desta pessoa.");
  if (error instanceof ActionError || error instanceof AuthError) return error.message;
  const planLimit = error instanceof Error ? planLimitFromDatabase(error.message) : null;
  if (planLimit) return planLimit;
  return "Não foi possível cadastrar agora. Tente de novo.";
}

/**
 * Equipe:
 * - invite: o administrador cadastra várias pessoas de uma vez e recebe o link de acesso de cada uma;
 * - welcome: a pessoa fechou a tela de boas-vindas (não aparece de novo);
 * - guide_seen / guides_reset: o "já vi" dos guias "Como usar" da própria pessoa.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo." }, { status: 403, headers });
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Sua sessão terminou. Entre de novo para continuar." }, { status: 401, headers });
    const access = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
    if (!access) return Response.json({ error: "Você não tem acesso a esta parte da plataforma. Fale com o administrador se precisar." }, { status: 403, headers });
    const body = await request.json().catch(() => null) as { action?: unknown } | null;

    if (body?.action === "welcome") {
      if (!access.isAdvisory) {
        await database().prepare("UPDATE app_users SET welcomed_at=? WHERE id=? AND organization_id=? AND welcomed_at IS NULL")
          .bind(brazilTimestamp(), access.id, access.organizationId).run();
      }
      return Response.json({ ok: true }, { headers });
    }

    // Guias "Como usar": a Assessoria Elite não grava na empresa cliente (o "já vi" dela fica só no aparelho).
    if (body?.action === "guide_seen" || body?.action === "guides_reset") {
      const key = (body as { key?: unknown }).key;
      if (body.action === "guide_seen" && !isGuideKey(key)) return Response.json({ error: "Guia desconhecido." }, { status: 400, headers });
      if (!access.isAdvisory) {
        if (body.action === "guides_reset") await resetGuides(access.id, access.organizationId);
        else await markGuideSeen(access.id, access.organizationId, key);
      }
      return Response.json({ ok: true }, { headers });
    }

    if (!canPerform(access, "create_user")) return Response.json({ error: "Somente administradores convidam a equipe." }, { status: 403, headers });
    const parsed = inviteBody.safeParse(body);
    if (!parsed.success) return Response.json({ error: `Envie de 1 a ${MAX_TEAM_ROWS} pessoas por vez.` }, { status: 400, headers });

    const results: InviteResult[] = [];
    const seen = new Set<string>();
    for (const row of parsed.data.rows) {
      const email = row.email.trim().toLowerCase();
      try {
        if (seen.has(email)) throw new ActionError("E-mail repetido na lista.");
        seen.add(email);
        if (row.role === "Embaixador") throw new ActionError("Embaixador precisa ser ligado ao cadastro dele: use \"Adicionar pessoa\".");
        const data = parseActionPayload("create_user", { ...row, email, ambassadorId: null });
        await executeAction("create_user", data, access);
        const token = await createPasswordLink(access, email);
        results.push({ email, name: row.name.trim(), ok: true, link: new URL(`/definir-senha#${token}`, request.url).toString() });
      } catch (error) {
        results.push({ email, name: row.name.trim(), ok: false, error: rowError(error) });
      }
    }
    return Response.json({ results, data: await getDashboardData(access) }, { headers });
  } catch {
    return Response.json({ error: "Não foi possível concluir agora. Tente novamente." }, { status: 503, headers });
  }
}
