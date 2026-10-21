import { ZodError } from "zod";
import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { HookError, importHooks, listHooks, saveHook } from "@/db/hooks";
import { sameOrigin } from "@/lib/session-cookie";
import { organizationFromRequest } from "@/lib/tenant-request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

async function access(request: Request) {
  const user = await getCurrentUser();
  if (!user) throw new HookError("Sua sessão terminou. Entre de novo para continuar.", 401);
  const a = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
  if (!a) throw new HookError("Você não tem acesso a esta parte da plataforma. Fale com o administrador se precisar.", 403);
  return a;
}
function failure(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Revise os campos." }, { status: 400, headers });
  if (error instanceof HookError) return Response.json({ error: error.message }, { status: error.status, headers });
  return Response.json({ error: "Não foi possível concluir. Confira a conexão e tente de novo." }, { status: 503, headers });
}

export async function GET(request: Request) {
  try { return Response.json(await listHooks(await access(request)), { headers }); } catch (error) { return failure(error); }
}

/** save: criar ou editar (inclusive aprovar e retirar) · import: várias linhas de uma vez. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo." }, { status: 403, headers });
  try {
    const a = await access(request);
    const body = await request.json().catch(() => null) as { action?: unknown; data?: unknown } | null;
    if (body?.action === "save") return Response.json({ ok: true, result: await saveHook(a, body.data) }, { headers });
    if (body?.action === "import") return Response.json({ ok: true, result: await importHooks(a, body.data) }, { headers });
    return Response.json({ error: "Esta ação não está disponível. Atualize a página e tente de novo." }, { status: 400, headers });
  } catch (error) { return failure(error); }
}
