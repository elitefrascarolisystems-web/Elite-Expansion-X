import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { GoalError } from "@/db/goals";
import { monthlyReport, ReportError } from "@/db/report";
import { organizationFromRequest } from "@/lib/tenant-request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

/** Relatório executivo do mês (?month=AAAA-MM): metas no fim do mês, mapeamento, decisões e atendimentos. */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Sua sessão terminou. Entre de novo para continuar." }, { status: 401, headers });
    const access = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
    if (!access) return Response.json({ error: "Você não tem acesso a esta empresa." }, { status: 403, headers });
    const month = new URL(request.url).searchParams.get("month") ?? "";
    return Response.json({ data: await monthlyReport(access, month) }, { headers });
  } catch (error) {
    if (error instanceof ReportError || error instanceof GoalError) return Response.json({ error: error.message }, { status: error.status, headers });
    return Response.json({ error: "Não foi possível montar o relatório agora. Tente novamente." }, { status: 503, headers });
  }
}
