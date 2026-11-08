import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { CalculatorError, getCalculatorBase } from "@/db/calculator";
import { applyGoal, goalHistory, goalProgress, GoalError, listGoals, managementPremises, splitBase, splitGoal } from "@/db/goals";
import { sameOrigin } from "@/lib/session-cookie";
import { PersonPageError, whereToLook, WHERE_LISTS, type WhereList } from "@/db/person-page";
import { organizationFromRequest } from "@/lib/tenant-request";
import { ZodError } from "zod";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

async function access(request: Request) {
  const user = await getCurrentUser();
  if (!user) throw new CalculatorError("Sua sessão terminou. Entre de novo para continuar.", 401);
  const a = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
  if (!a) throw new CalculatorError("Seu perfil não possui acesso comercial.", 403);
  return a;
}

function fail(error: unknown) {
  if (error instanceof CalculatorError || error instanceof GoalError || error instanceof PersonPageError) return Response.json({ error: error.message }, { status: error.status, headers });
  if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Dados inválidos." }, { status: 400, headers });
  return Response.json({ error: "Não foi possível calcular agora. Tente de novo." }, { status: 503, headers });
}

/**
 * Taxas da Calculadora (só agregados, sem nomes nem contatos), no escopo da função, e as metas.
 * ?view=goals: só o progresso das metas (cartão de Hoje, Metas e rotina, Saúde das cidades).
 * ?view=split&cityId=: o que cada pessoa fez nas últimas 8 semanas, para "Dividir pela equipe".
 * GET sem checagem de Origin: o navegador não manda esse cabeçalho num GET da mesma origem.
 */
export async function GET(request: Request) {
  try {
    const a = await access(request);
    const params = new URL(request.url).searchParams;
    const raw = params.get("cityId");
    const cityId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
    const view = params.get("view");
    // "Onde buscar": à parte da resposta das taxas; a lista (até 50, só nome e motivo) vem por pedido.
    if (view === "where") {
      const list = params.get("list");
      return Response.json({ data: await whereToLook(a, list && list in WHERE_LISTS ? list as WhereList : null, cityId) }, { headers });
    }
    if (view === "goals") return Response.json({ data: await goalProgress(a) }, { headers });
    if (view === "split") {
      if (!cityId) throw new GoalError("Escolha a cidade.");
      return Response.json({ data: await splitBase(a, cityId) }, { headers });
    }
    const base = await getCalculatorBase(a, { cityId });
    const scopeCity = base.scope.cityId;
    const active = (await listGoals(a)).filter((g) => a.role === "Comercial" || (scopeCity === null ? g.scope === "Empresa" : g.cityId === scopeCity));
    return Response.json({ data: base, goals: { active, history: await goalHistory(a, scopeCity), premises: await managementPremises(a) } }, { headers });
  } catch (error) {
    return fail(error);
  }
}

/** Ações: "apply" (Aplicar como meta) e "split" (Dividir pela equipe). Aplicar nunca cria tarefa, missão, mensagem ou rotina. */
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo." }, { status: 403, headers });
    const a = await access(request);
    const body = await request.json().catch(() => null) as { action?: string; data?: unknown } | null;
    if (body?.action === "apply") return Response.json({ data: await applyGoal(a, body.data) }, { headers });
    if (body?.action === "split") return Response.json({ data: await splitGoal(a, body.data) }, { headers });
    throw new GoalError("Ação inválida.");
  } catch (error) {
    return fail(error);
  }
}
