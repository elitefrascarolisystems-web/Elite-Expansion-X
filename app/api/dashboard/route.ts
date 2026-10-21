import {organizationFromRequest} from '@/lib/tenant-request';
import {getCurrentUser} from '@/app/auth';
import { getTeamAccess } from "@/db/access";
import { ActionError, executeAction } from "@/db/mutations";
import { planLimitFromDatabase } from "@/db/plan";
import { getDashboardData } from "@/db/queries";
import { actionNameSchema, parseActionPayload } from "@/lib/expansion-validation";
import { ZodError } from "zod";

export const dynamic = "force-dynamic";

const responseHeaders = { "Cache-Control": "no-store" };

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

export async function GET(request:Request) {
 try {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Você não tem acesso a esta parte da plataforma. Fale com o administrador se precisar." }, { status: 401, headers: responseHeaders });
  const access = await getTeamAccess(user.email, user.displayName,organizationFromRequest(request));
  if (!access) return Response.json({ error: "Seu perfil ainda não foi liberado dentro da plataforma." }, { status: 403, headers: responseHeaders });
  return Response.json({ data: await getDashboardData(access) }, { headers: responseHeaders });
 } catch { return Response.json({error:"Não foi possível carregar os dados. Tente novamente."},{status:503,headers:responseHeaders}); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo." }, { status: 403, headers: responseHeaders });
  try {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Você não tem acesso a esta parte da plataforma. Fale com o administrador se precisar." }, { status: 401, headers: responseHeaders });
  const access = await getTeamAccess(user.email, user.displayName,organizationFromRequest(request));
  if (!access) return Response.json({ error: "Seu perfil ainda não foi liberado dentro da plataforma." }, { status: 403, headers: responseHeaders });

    const payload = (await request.json()) as { action?: unknown; data?: unknown };
    const action = actionNameSchema.parse(payload.action);
    const data = parseActionPayload(action, payload.data ?? {});
    await executeAction(action, data, access);
    return Response.json({ data: await getDashboardData(access) }, { headers: responseHeaders });
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    const duplicate = raw.includes('UNIQUE constraint failed');
    const planLimit = planLimitFromDatabase(raw);
    const known = error instanceof ZodError || error instanceof ActionError || duplicate || planLimit !== null;
    const message = error instanceof ZodError ? error.issues[0]?.message ?? 'Revise os campos informados.'
      : planLimit ? planLimit
      : duplicate ? 'Já existe um registro com esse nome, código ou e-mail.'
      : error instanceof ActionError ? raw : 'Não foi possível salvar agora. Atualize a página e tente de novo; se continuar, fale com o administrador.';
    const status = !known ? 503 : /permissão|fora do seu acesso|próprio embaixador|não possui acesso/.test(message) ? 403 : 400;
    return Response.json({ error: message }, { status, headers: responseHeaders });
  }
}
