import { z } from "zod";
import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { AuthError, createPasswordLink, LINK_HOURS } from "@/db/auth";
import { sameOrigin } from "@/lib/session-cookie";
import { organizationFromRequest } from "@/lib/tenant-request";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const body = z.object({ email: z.string().trim().email().max(254) });

/** Administrador gera o link de uso único para alguém criar ou trocar a senha. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origem da solicitação não permitida." }, { status: 403, headers });
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Entre para acessar." }, { status: 401, headers });
    const access = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
    if (!access) return Response.json({ error: "Acesso não autorizado." }, { status: 403, headers });
    const v = body.safeParse(await request.json().catch(() => null));
    if (!v.success) return Response.json({ error: "E-mail inválido." }, { status: 400, headers });
    const token = await createPasswordLink(access, v.data.email);
    const link = new URL(`/definir-senha#${token}`, request.url).toString();
    return Response.json({ link, hours: LINK_HOURS }, { headers });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status, headers });
    return Response.json({ error: "Não foi possível gerar o link agora. Tente novamente." }, { status: 503, headers });
  }
}
