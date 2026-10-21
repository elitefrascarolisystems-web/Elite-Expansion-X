import { z } from "zod";
import { AuthError, passwordLinkInfo, SESSION_HOURS, redeemPasswordLink } from "@/db/auth";
import { sameOrigin, sessionCookie } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("info"), token: z.string().max(64) }),
  z.object({ action: z.literal("set"), token: z.string().max(64), password: z.string().max(200) }),
]);

/** Tela "definir senha": confere o link (info) e grava a senha nova (set). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Por segurança, esta ação só pode ser feita dentro da plataforma. Atualize a página e tente de novo." }, { status: 403, headers });
  try {
    const v = body.safeParse(await request.json().catch(() => null));
    if (!v.success) return Response.json({ error: "Pedido inválido." }, { status: 400, headers });
    if (v.data.action === "info") {
      const info = await passwordLinkInfo(v.data.token);
      if (!info) return Response.json({ error: "Este link é inválido, expirou ou já foi usado. Peça um novo ao administrador." }, { status: 404, headers });
      return Response.json(info, { headers });
    }
    const token = await redeemPasswordLink(v.data.token, v.data.password);
    return Response.json({ ok: true }, { headers: { ...headers, "Set-Cookie": sessionCookie(token, SESSION_HOURS * 3600) } });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status, headers });
    return Response.json({ error: "Não foi possível salvar a senha agora. Tente novamente." }, { status: 503, headers });
  }
}
