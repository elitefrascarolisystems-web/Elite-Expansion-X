import { getCurrentUser } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { CalculatorError, getCalculatorBase } from "@/db/calculator";
import { organizationFromRequest } from "@/lib/tenant-request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

/**
 * Taxas da Calculadora (só agregados, sem nomes nem contatos), no escopo da função.
 * GET sem checagem de Origin: o navegador não manda esse cabeçalho num GET da mesma origem.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new CalculatorError("Sua sessão terminou. Entre de novo para continuar.", 401);
    const access = await getTeamAccess(user.email, user.displayName, organizationFromRequest(request));
    if (!access) throw new CalculatorError("Seu perfil não possui acesso comercial.", 403);
    const raw = new URL(request.url).searchParams.get("cityId");
    const cityId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
    return Response.json({ data: await getCalculatorBase(access, { cityId }) }, { headers });
  } catch (error) {
    if (error instanceof CalculatorError) return Response.json({ error: error.message }, { status: error.status, headers });
    return Response.json({ error: "Não foi possível calcular agora. Tente de novo." }, { status: 503, headers });
  }
}
