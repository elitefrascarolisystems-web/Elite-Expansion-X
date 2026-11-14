import { z } from "zod";
import { AuthError, login, loginWithCode, SESSION_HOURS } from "@/db/auth";
import { sameOrigin, sessionCookie } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
// 1º passo: e-mail e senha. 2º passo (verificação em duas etapas ligada): o desafio e o código do app.
const body = z.union([
  z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(200) }),
  z.object({ challenge: z.string().max(64), code: z.string().trim().min(6).max(20) }),
]);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo." }, { status: 403, headers });
  try {
    const v = body.safeParse(await request.json().catch(() => null));
    if (!v.success) return Response.json({ error: "Informe e-mail e senha." }, { status: 400, headers });
    const network = request.headers.get("cf-connecting-ip") ?? "";
    if ("challenge" in v.data) {
      const token = await loginWithCode(v.data.challenge, v.data.code, network);
      return Response.json({ ok: true }, { headers: { ...headers, "Set-Cookie": sessionCookie(token, SESSION_HOURS * 3600) } });
    }
    const result = await login(v.data.email, v.data.password, network);
    if ("challenge" in result) return Response.json({ ok: true, mfa: true, challenge: result.challenge }, { headers });
    return Response.json({ ok: true }, { headers: { ...headers, "Set-Cookie": sessionCookie(result.session, SESSION_HOURS * 3600) } });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status, headers });
    return Response.json({ error: "Não foi possível entrar agora. Tente novamente." }, { status: 503, headers });
  }
}
