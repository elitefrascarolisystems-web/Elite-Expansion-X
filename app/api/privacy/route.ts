import { ZodError } from "zod";
import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { anonymizeSubject, correctSubject, exportSubject, listRequests, PrivacyError, revokeSubject, searchSubjects, subjectDetails } from "@/db/privacy";
import { sameOrigin } from "@/lib/session-cookie";
import { organizationFromRequest } from "@/lib/tenant-request";
import { validationMessage } from "@/lib/validation-message";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

async function access(request: Request) {
  const user = await getCurrentUser();
  if (!user) throw new PrivacyError("Sua sessão terminou. Entre de novo para continuar.", 401);
  const a = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
  if (!a) throw new PrivacyError("Você não tem acesso a esta parte da plataforma. Fale com o administrador se precisar.", 403);
  return a;
}
function failure(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: validationMessage(error, "Revise os campos.") }, { status: 400, headers });
  if (error instanceof PrivacyError) return Response.json({ error: error.message }, { status: error.status, headers });
  return Response.json({ error: "Não foi possível concluir. Confira a conexão e tente de novo." }, { status: 503, headers });
}

/** ?q= busca titulares · ?subject= ficha do titular · sem parâmetros: pedidos atendidos. */
export async function GET(request: Request) {
  try {
    const a = await access(request), params = new URL(request.url).searchParams;
    if (params.has("q")) return Response.json({ subjects: await searchSubjects(a, params.get("q") ?? "") }, { headers });
    if (params.has("subject")) return Response.json({ subject: await subjectDetails(a, params.get("subject") ?? "") }, { headers });
    return Response.json({ requests: await listRequests(a) }, { headers });
  } catch (error) { return failure(error); }
}

const ACTIONS = { export: exportSubject, correct: correctSubject, revoke: revokeSubject, anonymize: anonymizeSubject } as const;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo." }, { status: 403, headers });
  try {
    const a = await access(request);
    const body = await request.json().catch(() => null) as { action?: unknown; data?: unknown } | null;
    const run = typeof body?.action === "string" && Object.hasOwn(ACTIONS, body.action) ? ACTIONS[body.action as keyof typeof ACTIONS] : null;
    if (!run) return Response.json({ error: "Esta ação não está disponível. Atualize a página e tente de novo." }, { status: 400, headers });
    return Response.json({ ok: true, result: await run(a, body?.data) }, { headers });
  } catch (error) { return failure(error); }
}
