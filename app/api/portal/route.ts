import { ZodError } from "zod";
import { getCurrentUser } from "@/app/auth";
import { getUserAccess } from "@/db/access";
import { getPortalAdmin, getPortalData, portalAction, portalAdminAction, PortalError } from "@/db/portal";
import { sameOrigin } from "@/lib/session-cookie";
import { organizationFromRequest } from "@/lib/tenant-request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const ADMIN_ACTIONS = new Set(["save_step", "delete_step", "move_step", "set_member"]);

async function access(request: Request) {
  const user = await getCurrentUser();
  if (!user) throw new PortalError("Entre para acessar.", 401);
  const a = await getUserAccess(user.email, user.displayName, organizationFromRequest(request));
  if (!a) throw new PortalError("Acesso não autorizado.", 403);
  return a;
}
function failure(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Revise os campos." }, { status: 400, headers });
  if (error instanceof PortalError) return Response.json({ error: error.message }, { status: error.status, headers });
  return Response.json({ error: "Não foi possível concluir agora. Tente de novo." }, { status: 503, headers });
}

/** Portal: o membro lê a própria área (GET); o administrador lê a gestão com ?admin=1. */
export async function GET(request: Request) {
  try {
    const a = await access(request);
    const admin = new URL(request.url).searchParams.get("admin") === "1";
    return Response.json({ data: admin ? await getPortalAdmin(a) : await getPortalData(a) }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origem da solicitação não permitida." }, { status: 403, headers });
  try {
    const a = await access(request);
    const body = await request.json().catch(() => null) as { action?: unknown; data?: unknown } | null;
    const action = String(body?.action ?? "");
    const result = ADMIN_ACTIONS.has(action) ? await portalAdminAction(a, action, body?.data) : await portalAction(a, action, body?.data);
    return Response.json({ ok: true, result }, { headers });
  } catch (error) { return failure(error); }
}
