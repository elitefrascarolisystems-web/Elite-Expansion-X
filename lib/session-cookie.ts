/**
 * Cookie da sessão. "__Host-" obriga o navegador a só aceitá-lo com Secure, sem
 * Domain e em Path=/; HttpOnly impede que scripts da página o leiam.
 */
export const SESSION_COOKIE = "__Host-elite_sessao";

export function readSessionCookie(cookieHeader: string | null): string | null {
  for (const part of (cookieHeader ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return value.join("=") || null;
  }
  return null;
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

/** Pedidos que mudam algo só valem vindos do próprio site (proteção contra CSRF). */
export function sameOrigin(request: Request): boolean {
  return request.headers.get("origin") === new URL(request.url).origin;
}
