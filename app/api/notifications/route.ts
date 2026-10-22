import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { myPrefs, NotificationError, notificationsOverview, sendTest, setPrefs } from "@/db/notifications";
import { sameOrigin } from "@/lib/session-cookie";
import { organizationFromRequest } from "@/lib/tenant-request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

async function access(request: Request) {
  const user = await getCurrentUser();
  if (!user) throw new NotificationError("Sua sessão terminou. Entre de novo para continuar.", 401);
  const a = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
  if (!a) throw new NotificationError("Você não tem acesso a esta parte da plataforma.", 403);
  return a;
}
function failure(error: unknown) {
  if (error instanceof NotificationError) return Response.json({ error: error.message }, { status: error.status, headers });
  return Response.json({ error: "Não foi possível concluir. Confira a conexão e tente de novo." }, { status: 503, headers });
}

/** Sem parâmetros: os meus avisos · ?visao=1: configuração, equipe e prévia (administrador). */
export async function GET(request: Request) {
  try {
    const a = await access(request), url = new URL(request.url);
    if (url.searchParams.has("visao")) return Response.json(await notificationsOverview(a, url.origin), { headers });
    return Response.json(await myPrefs(a), { headers });
  } catch (error) { return failure(error); }
}

/** prefs: ligar/desligar (a própria pessoa, ou o administrador para alguém da equipe) · test: enviar a prévia para mim. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Por segurança, esta ação só pode ser feita dentro da plataforma." }, { status: 403, headers });
  try {
    const a = await access(request);
    const body = await request.json().catch(() => null) as { action?: unknown; data?: unknown } | null;
    if (body?.action === "prefs") return Response.json({ ok: true, result: await setPrefs(a, body.data) }, { headers });
    if (body?.action === "test") return Response.json({ ok: true, result: await sendTest(a) }, { headers });
    return Response.json({ error: "Esta ação não está disponível." }, { status: 400, headers });
  } catch (error) { return failure(error); }
}
