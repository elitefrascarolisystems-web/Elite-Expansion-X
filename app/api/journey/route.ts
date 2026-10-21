import { ZodError } from "zod";
import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { JourneyError, startAttendance } from "@/db/journey";
import { ActionError } from "@/db/mutations";
import { CommercialError } from "@/db/commercial";
import { sameOrigin } from "@/lib/session-cookie";
import { organizationFromRequest } from "@/lib/tenant-request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

/** Jornada do mapa à venda: "start" inicia o atendimento de uma pessoa do mapa (lead + oportunidade). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo." }, { status: 403, headers });
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Sua sessão terminou. Entre de novo para continuar." }, { status: 401, headers });
    const access = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
    if (!access) return Response.json({ error: "Você não tem acesso a esta parte da plataforma. Fale com o administrador se precisar." }, { status: 403, headers });
    const body = await request.json().catch(() => null) as { action?: unknown; data?: unknown } | null;
    if (body?.action !== "start") return Response.json({ error: "Esta ação não está disponível. Atualize a página e tente de novo." }, { status: 400, headers });
    return Response.json({ ok: true, result: await startAttendance(access, body.data) }, { headers });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Revise os campos." }, { status: 400, headers });
    if (error instanceof JourneyError) return Response.json({ error: error.message, leadId: error.leadId }, { status: error.status, headers });
    if (error instanceof ActionError || error instanceof CommercialError) return Response.json({ error: error.message }, { status: 400, headers });
    return Response.json({ error: "Não foi possível iniciar o atendimento agora. Tente de novo." }, { status: 503, headers });
  }
}
