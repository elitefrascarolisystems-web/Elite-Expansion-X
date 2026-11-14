import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { ExportError, exportOrganization } from "@/db/data-export";
import { sameOrigin } from "@/lib/session-cookie";
import { organizationFromRequest } from "@/lib/tenant-request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

/** Cópia completa dos dados da empresa aberta (ZIP). POST: só de dentro da plataforma. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo." }, { status: 403, headers });
  try {
    const user = await getCurrentUser();
    if (!user) throw new ExportError("Sua sessão terminou. Entre de novo para continuar.", 401);
    const access = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
    if (!access) throw new ExportError("Você não tem acesso a esta empresa.", 403);
    const { filename, bytes } = await exportOrganization(access);
    return new Response(bytes as BodyInit, { headers: { ...headers, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (error) {
    return error instanceof ExportError ? Response.json({ error: error.message }, { status: error.status, headers })
      : Response.json({ error: "Não foi possível montar a cópia agora. Tente novamente em alguns minutos." }, { status: 503, headers });
  }
}
