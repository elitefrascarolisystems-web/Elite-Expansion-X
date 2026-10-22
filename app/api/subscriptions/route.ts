import { ZodError } from "zod";
import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { OrganizationError } from "@/db/organizations";
import { createSubscriber, getSubscriptions, saveSubscription, setSubscriptionStatus } from "@/db/subscriptions";
import { sameOrigin } from "@/lib/session-cookie";
import { organizationFromRequest } from "@/lib/tenant-request";
import { validationMessage } from "@/lib/validation-message";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

async function owner(request: Request) {
  const user = await getCurrentUser();
  if (!user) throw new OrganizationError("Sua sessão terminou. Entre de novo para continuar.", 401);
  const access = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
  if (!access?.isPlatformOwner) throw new OrganizationError("Somente os donos da plataforma gerenciam assinaturas.", 403);
  return access;
}

function failure(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: validationMessage(error, "Revise os campos.") }, { status: 400, headers });
  if (error instanceof OrganizationError) return Response.json({ error: error.message }, { status: error.status, headers });
  return Response.json({ error: "Não foi possível concluir. Tente novamente." }, { status: 503, headers });
}

export async function GET(request: Request) {
  try { return Response.json(await getSubscriptions(await owner(request)), { headers }); }
  catch (error) { return failure(error); }
}

/** save: plano e limites · status: suspender ou reativar · create: nova empresa assinante. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo." }, { status: 403, headers });
  try {
    const access = await owner(request);
    const body = await request.json().catch(() => null) as { action?: unknown; data?: unknown } | null;
    const result = body?.action === "save" ? await saveSubscription(access, body.data)
      : body?.action === "status" ? await setSubscriptionStatus(access, body.data)
      : body?.action === "create" ? await createSubscriber(access, body.data)
      : null;
    if (!result) return Response.json({ error: "Ação inválida." }, { status: 400, headers });
    return Response.json({ ok: true, result, data: await getSubscriptions(access) }, { headers });
  } catch (error) { return failure(error); }
}
