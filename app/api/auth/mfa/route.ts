import { z } from "zod";
import { getCurrentUser } from "@/app/auth";
import { getUserAccess } from "@/db/access";
import { adminResetMfa, confirmEnrollment, disableMfa, hasMfa, MfaError, mfaStatus, organizationRequiresMfa, regenerateRecovery, setMfaRequired, startEnrollment } from "@/db/mfa";
import { sameOrigin } from "@/lib/session-cookie";
import { organizationFromRequest } from "@/lib/tenant-request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const code = z.string().trim().min(6).max(20);
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("confirm"), code }),
  z.object({ action: z.literal("disable"), code }),
  z.object({ action: z.literal("recovery"), code }),
  z.object({ action: z.literal("reset"), email: z.string().trim().email().max(254) }),
  z.object({ action: z.literal("policy"), required: z.boolean() }),
]);

/** Segurança da conta: a verificação em duas etapas de quem está conectado e a regra da empresa aberta. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sua sessão terminou. Entre de novo para continuar." }, { status: 401, headers });
  const organizationId = organizationFromRequest(request);
  const required = organizationId ? await organizationRequiresMfa(organizationId) : false;
  return Response.json({ data: { ...(await mfaStatus(user.email)), required } }, { headers });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo." }, { status: 403, headers });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sua sessão terminou. Entre de novo para continuar." }, { status: 401, headers });
  try {
    const v = body.safeParse(await request.json().catch(() => null));
    if (!v.success) return Response.json({ error: "Pedido inválido." }, { status: 400, headers });
    const d = v.data;
    if (d.action === "start") return Response.json({ data: await startEnrollment(user.email) }, { headers });
    if (d.action === "confirm") return Response.json({ data: { recoveryCodes: await confirmEnrollment(user.email, d.code) } }, { headers });
    if (d.action === "disable") {
      // Com a exigência da empresa, desligar trancaria a pessoa fora: só redefinindo pela gestão.
      const organizationId = organizationFromRequest(request);
      if (organizationId && await organizationRequiresMfa(organizationId)) throw new MfaError("Sua empresa exige a verificação em duas etapas. Para trocar de celular, gere códigos novos ou peça ao administrador para redefinir.", 409);
      await disableMfa(user.email, d.code);
      return Response.json({ ok: true }, { headers });
    }
    if (d.action === "recovery") return Response.json({ data: { recoveryCodes: await regenerateRecovery(user.email, d.code) } }, { headers });
    // Ações da gestão: valem na empresa aberta (?org=), só para o administrador dela.
    const access = await getUserAccess(user.email, user.displayName, organizationFromRequest(request));
    if (!access) return Response.json({ error: "Você não tem acesso a esta empresa." }, { status: 403, headers });
    if (d.action === "reset") { await adminResetMfa(access, d.email); return Response.json({ ok: true }, { headers }); }
    await setMfaRequired(access, d.required, await hasMfa(user.email));
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    if (error instanceof MfaError) return Response.json({ error: error.message }, { status: error.status, headers });
    return Response.json({ error: "Não foi possível salvar agora. Tente novamente." }, { status: 503, headers });
  }
}
