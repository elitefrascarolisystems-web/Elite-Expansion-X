import {organizationFromRequest} from '@/lib/tenant-request';
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getUserAccess } from "@/db/access";
import { ActionError, executeAction } from "@/db/mutations";
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
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Acesso não autorizado." }, { status: 401, headers: responseHeaders });
  const access = await getUserAccess(user.email, user.displayName,organizationFromRequest(request));
  if (!access) return Response.json({ error: "Seu perfil ainda não foi liberado dentro da plataforma." }, { status: 403, headers: responseHeaders });
  return Response.json({ data: await getDashboardData(access) }, { headers: responseHeaders });
 } catch { return Response.json({error:"Não foi possível carregar os dados. Tente novamente."},{status:503,headers:responseHeaders}); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origem da solicitação não permitida." }, { status: 403, headers: responseHeaders });
  try {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Acesso não autorizado." }, { status: 401, headers: responseHeaders });
  const access = await getUserAccess(user.email, user.displayName,organizationFromRequest(request));
  if (!access) return Response.json({ error: "Seu perfil ainda não foi liberado dentro da plataforma." }, { status: 403, headers: responseHeaders });

    const payload = (await request.json()) as { action?: unknown; data?: unknown };
    const action = actionNameSchema.parse(payload.action);
    const data = parseActionPayload(action, payload.data ?? {});
    await executeAction(action, data, access);
    return Response.json({ data: await getDashboardData(access) }, { headers: responseHeaders });
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    const duplicate = raw.includes('UNIQUE constraint failed');
    const known = error instanceof ZodError || error instanceof ActionError || duplicate;
    const message = error instanceof ZodError ? error.issues[0]?.message ?? 'Revise os campos informados.'
      : duplicate ? 'Já existe um registro com esse nome, código ou e-mail.'
      : error instanceof ActionError ? raw : 'Não foi possível salvar. Atualize os dados antes de tentar novamente.';
    const status = !known ? 503 : /permissão|fora do seu acesso|próprio embaixador|não possui acesso/.test(message) ? 403 : 400;
    return Response.json({ error: message }, { status, headers: responseHeaders });
  }
}
