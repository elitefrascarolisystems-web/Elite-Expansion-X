import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { accessKeyLookup, normalizeTeamDomain, verifyAccessJwt, type KeyLookup } from "@/lib/access-jwt";

/**
 * Identidade da pessoa conectada, validada pelo Cloudflare Access.
 *
 * Configuração (variáveis do Worker):
 * - ACCESS_TEAM_DOMAIN: domínio do time no Zero Trust, ex. "elite.cloudflareaccess.com"
 * - ACCESS_AUD: "Application Audience (AUD) Tag" da aplicação protegida
 *
 * Sem essa configuração, ninguém entra (falha fechada): nunca confiamos em
 * cabeçalhos de identidade sem conferir a assinatura.
 */
export type CurrentUser = { displayName: string; email: string; fullName: string | null };

const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
const SIGN_OUT_PATH = "/cdn-cgi/access/logout";

let lookup: { team: string; get: KeyLookup } | null = null;

function accessConfig() {
  const vars = env as unknown as Record<string, string | undefined>;
  const teamDomain = normalizeTeamDomain(vars.ACCESS_TEAM_DOMAIN);
  const aud = vars.ACCESS_AUD?.trim();
  return teamDomain && aud ? { teamDomain, aud } : null;
}

export function isAuthConfigured(): boolean {
  return accessConfig() !== null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const config = accessConfig();
  if (!config) return null;
  if (lookup?.team !== config.teamDomain) lookup = { team: config.teamDomain, get: accessKeyLookup(config.teamDomain) };
  try {
    const token = (await headers()).get(ACCESS_JWT_HEADER);
    const email = await verifyAccessJwt(token, config, lookup.get);
    return email ? { displayName: email, email, fullName: null } : null;
  } catch {
    return null; // chaves indisponíveis: nega o acesso em vez de arriscar
  }
}

/** Sai do Cloudflare Access (encerra a sessão em todos os sistemas protegidos pelo time). */
export function signOutPath(): string {
  return SIGN_OUT_PATH;
}
