import { closeSession } from "@/db/auth";
import { clearedSessionCookie, readSessionCookie } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

/** Encerra a sessão deste navegador e volta para a tela de entrada. */
export async function GET(request: Request) {
  try { await closeSession(readSessionCookie(request.headers.get("cookie"))); } catch { /* o cookie é apagado mesmo assim */ }
  return new Response(null, {
    status: 303,
    headers: { Location: new URL("/entrar", request.url).toString(), "Set-Cookie": clearedSessionCookie(), "Cache-Control": "no-store" },
  });
}
