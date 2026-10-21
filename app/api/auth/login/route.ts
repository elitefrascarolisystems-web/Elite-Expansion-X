import { z } from "zod";
import { AuthError, login, SESSION_HOURS } from "@/db/auth";
import { sameOrigin, sessionCookie } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const body = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo." }, { status: 403, headers });
  try {
    const v = body.safeParse(await request.json().catch(() => null));
    if (!v.success) return Response.json({ error: "Informe e-mail e senha." }, { status: 400, headers });
    const token = await login(v.data.email, v.data.password, request.headers.get("cf-connecting-ip") ?? "");
    return Response.json({ ok: true }, { headers: { ...headers, "Set-Cookie": sessionCookie(token, SESSION_HOURS * 3600) } });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status, headers });
    return Response.json({ error: "Não foi possível entrar agora. Tente novamente." }, { status: 503, headers });
  }
}
