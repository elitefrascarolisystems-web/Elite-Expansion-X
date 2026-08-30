import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getUserAccess } from "@/db/access";
import { executeAction } from "@/db/mutations";
import { getDashboardData } from "@/db/queries";
import { actionNameSchema, parseActionPayload } from "@/lib/expansion-validation";
import { ZodError } from "zod";

export const dynamic = "force-dynamic";

const responseHeaders = { "Cache-Control": "no-store" };

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Acesso não autorizado." }, { status: 401, headers: responseHeaders });
  const access = await getUserAccess(user.email, user.displayName);
  if (!access) return Response.json({ error: "Seu perfil ainda não foi liberado dentro da plataforma." }, { status: 403, headers: responseHeaders });
  return Response.json({ data: await getDashboardData(access) }, { headers: responseHeaders });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origem da solicitação não permitida." }, { status: 403, headers: responseHeaders });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Acesso não autorizado." }, { status: 401, headers: responseHeaders });
  const access = await getUserAccess(user.email, user.displayName);
  if (!access) return Response.json({ error: "Seu perfil ainda não foi liberado dentro da plataforma." }, { status: 403, headers: responseHeaders });

  try {
    const payload = (await request.json()) as { action?: unknown; data?: unknown };
    const action = actionNameSchema.parse(payload.action);
    const data = parseActionPayload(action, payload.data ?? {});
    await executeAction(action, data, access);
    return Response.json({ data: await getDashboardData(access) }, { headers: responseHeaders });
  } catch (error) {
    const raw = error instanceof ZodError
      ? error.issues[0]?.message ?? "Revise os campos informados."
      : error instanceof Error ? error.message : "Não foi possível salvar.";
    const message = raw.includes("UNIQUE constraint failed")
      ? "Já existe um registro com esse nome, código ou e-mail."
      : raw;
    const status = /permissão|fora do seu acesso|próprio embaixador|Origem da solicitação/.test(message) ? 403 : 400;
    return Response.json({ error: message }, { status, headers: responseHeaders });
  }
}
