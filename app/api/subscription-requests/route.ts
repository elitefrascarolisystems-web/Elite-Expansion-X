import { ZodError } from "zod";
import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { deleteRequest, listRequests, RequestError, submitRequest, updateRequest } from "@/db/subscription-requests";
import { sameOrigin } from "@/lib/session-cookie";
import { organizationFromRequest } from "@/lib/tenant-request";
import { validationMessage } from "@/lib/validation-message";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

async function access(request: Request) {
  const user = await getCurrentUser();
  if (!user) throw new RequestError("Sua sessão terminou. Entre de novo para continuar.", 401);
  const a = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
  if (!a) throw new RequestError("Você não tem acesso a esta parte da plataforma.", 403);
  return a;
}
function failure(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: validationMessage(error, "Revise os campos.") }, { status: 400, headers });
  if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status, headers });
  return Response.json({ error: "Não foi possível enviar agora. Tente de novo em instantes." }, { status: 503, headers });
}

/** Lista dos pedidos (donos da plataforma). */
export async function GET(request: Request) {
  try { return Response.json({ requests: await listRequests(await access(request)) }, { headers }); } catch (error) { return failure(error); }
}

/** submit: página pública /conheca, sem login · update/delete: donos da plataforma. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Envie o pedido pela página da Elite Expansion X." }, { status: 403, headers });
  try {
    const body = await request.json().catch(() => null) as { action?: unknown; data?: unknown } | null;
    if (body?.action === "submit") return Response.json(await submitRequest(body.data, request.headers.get("cf-connecting-ip") ?? ""), { headers });
    const a = await access(request);
    if (body?.action === "update") return Response.json(await updateRequest(a, body.data), { headers });
    if (body?.action === "delete") return Response.json(await deleteRequest(a, (body.data as { id?: unknown } | undefined)?.id), { headers });
    return Response.json({ error: "Esta ação não está disponível. Atualize a página e tente de novo." }, { status: 400, headers });
  } catch (error) { return failure(error); }
}
