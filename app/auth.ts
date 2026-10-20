/// <reference types="vite/client" />
import { headers } from "next/headers";
import { sessionEmail } from "@/db/auth";
import { readSessionCookie } from "@/lib/session-cookie";

/**
 * Identidade da pessoa conectada: a sessão aberta pelo login com e-mail e senha
 * (ver db/auth.ts). Sem sessão válida, ninguém entra.
 */
export type CurrentUser = { displayName: string; email: string; fullName: string | null };

export const SIGN_IN_PATH = "/entrar";
const SIGN_OUT_PATH = "/api/auth/logout";

/**
 * Só em `npm run dev` (máquina local): entra direto como o dono da plataforma.
 * `import.meta.env.DEV` é falso em `npm run build`, então este atalho é removido
 * da versão publicada e nunca vale na web. Para testar o login de verdade em
 * desenvolvimento: `VITE_LOGIN_REAL=1 npm run dev`.
 */
const DEV_LOGIN_EMAIL = "elitefrascarolisystems@gmail.com";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (import.meta.env.DEV && import.meta.env.VITE_LOGIN_REAL !== "1") {
    // Para testar outra função no modo local: VITE_DEV_LOGIN_EMAIL=pessoa@exemplo npm run dev
    const email = import.meta.env.VITE_DEV_LOGIN_EMAIL || DEV_LOGIN_EMAIL;
    return { displayName: email, email, fullName: null };
  }
  try {
    const email = await sessionEmail(readSessionCookie((await headers()).get("cookie")));
    return email ? { displayName: email, email, fullName: null } : null;
  } catch {
    return null; // banco indisponível: nega o acesso em vez de arriscar
  }
}

/** Encerra a sessão e volta para a tela de entrada. */
export function signOutPath(): string {
  return SIGN_OUT_PATH;
}
