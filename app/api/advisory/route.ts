import { ZodError } from "zod";
import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { AdvisoryError, getAdvisoryPolicy, setAdvisoryPolicy } from "@/db/advisory";
import { sameOrigin } from "@/lib/session-cookie";
import { organizationFromRequest } from "@/lib/tenant-request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

async function accessOf(request: Request) {
  const user = await getCurrentUser();
  if (!user) throw new AdvisoryError("Sua sessão terminou. Entre de novo para continuar.", 401);
  const access = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
  if (!access) throw new AdvisoryError("Você não tem acesso a esta empresa.", 403);
  return access;
}
const fail = (error: unknown) => error instanceof AdvisoryError ? Response.json({ error: error.message }, { status: error.status, headers })
  : error instanceof ZodError ? Response.json({ error: error.issues[0]?.message ?? "Dados inválidos." }, { status: 400, headers })
  : Response.json({ error: "Não foi possível carregar agora. Tente novamente." }, { status: 503, headers });

/** Acesso da Assessoria Elite à empresa aberta: a regra e os últimos acessos. */
export async function GET(request: Request) {
  try { return Response.json({ data: await getAdvisoryPolicy(await accessOf(request)) }, { headers }); } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo." }, { status: 403, headers });
  try {
    const access = await accessOf(request);
    await setAdvisoryPolicy(access, await request.json().catch(() => null));
    return Response.json({ data: await getAdvisoryPolicy(access) }, { headers });
  } catch (error) { return fail(error); }
}
