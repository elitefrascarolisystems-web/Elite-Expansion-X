import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { PersonPageError } from "@/db/person-page";
import { nearbySituations, placeDetail, PlaceError, plantingToday } from "@/db/person-places";
import { organizationFromRequest } from "@/lib/tenant-request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

/** Ficha do local (?id=): situação, pessoas da rede no escopo, plano e última visita. ?view=today: visitas de plantio de hoje. ?view=nearby&ids=: situação dos locais próximos (Em campo). */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new PlaceError("Sua sessão terminou. Entre de novo para continuar.", 401);
    const access = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
    if (!access) throw new PlaceError("Esta ficha é da equipe.", 403);
    const params = new URL(request.url).searchParams;
    if (params.get("view") === "today") return Response.json({ data: await plantingToday(access) }, { headers });
    // Em campo: situação dos locais próximos (só ids; a posição do aparelho não é enviada).
    if (params.get("view") === "nearby") return Response.json({ data: await nearbySituations(access, (params.get("ids") ?? "").split(",")) }, { headers });
    const id = params.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new PlaceError("Local não encontrado nesta empresa.", 404);
    return Response.json({ data: await placeDetail(access, id) }, { headers });
  } catch (error) {
    if (error instanceof PlaceError || error instanceof PersonPageError) return Response.json({ error: error.message }, { status: error.status, headers });
    return Response.json({ error: "Não foi possível abrir a ficha do local agora." }, { status: 503, headers });
  }
}
