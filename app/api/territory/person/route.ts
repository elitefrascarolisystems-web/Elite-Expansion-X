import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { getPersonPage, NOT_FOUND, PersonPageError } from "@/db/person-page";
import { organizationFromRequest } from "@/lib/tenant-request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

/** Página da pessoa: ?id=<uuid> (&all=1 traz o histórico inteiro). Sem contato e sem coordenada. */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new PersonPageError("Sua sessão terminou. Entre de novo para continuar.", 401);
    const access = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
    if (!access) throw new PersonPageError("Esta página é da equipe.", 403);
    const params = new URL(request.url).searchParams;
    return Response.json({ data: await getPersonPage(access, params.get("id") ?? "", { all: params.get("all") === "1" }) }, { headers });
  } catch (error) {
    if (error instanceof PersonPageError) return Response.json({ error: error.status === 404 ? NOT_FOUND : error.message }, { status: error.status, headers });
    return Response.json({ error: "Não foi possível abrir a página agora. Tente de novo." }, { status: 503, headers });
  }
}
