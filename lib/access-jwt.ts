/**
 * Verificação do token do Cloudflare Access (Cf-Access-Jwt-Assertion).
 *
 * O Access fica na frente do site: pede o e-mail, confere a lista de pessoas
 * autorizadas e só então repassa a requisição com um JWT assinado (RS256).
 * Aqui conferimos assinatura, emissor (time), destino (AUD da aplicação) e
 * validade. Sem isso, qualquer um poderia forjar o cabeçalho de identidade.
 */

export type AccessConfig = { teamDomain: string; aud: string };
export type KeyLookup = (kid: string) => Promise<CryptoKey | null>;

const CLOCK_SKEW_SECONDS = 60;

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
 const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
 const binary = atob(base64);
 const bytes = new Uint8Array(new ArrayBuffer(binary.length));
 for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
 return bytes;
}

function decodeJson(part: string): Record<string, unknown> | null {
 try {
  const value = JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
 } catch { return null; }
}

/** Normaliza "time.cloudflareaccess.com", aceitando também com https:// ou barra final. */
export function normalizeTeamDomain(value: string | undefined): string | null {
 const domain = value?.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
 return domain && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null;
}

/** Devolve o e-mail autenticado (minúsculo) ou null se o token não for válido. */
export async function verifyAccessJwt(token: string | null | undefined, config: AccessConfig, getKey: KeyLookup, nowSeconds = Date.now() / 1000): Promise<string | null> {
 if (!token) return null;
 const parts = token.split('.');
 if (parts.length !== 3 || parts.some(p => !p)) return null;
 const header = decodeJson(parts[0]), payload = decodeJson(parts[1]);
 if (!header || !payload || header.alg !== 'RS256' || typeof header.kid !== 'string') return null;

 const key = await getKey(header.kid);
 if (!key) return null;
 let valid = false;
 try {
  valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
 } catch { return null; }
 if (!valid) return null;

 if (payload.iss !== `https://${config.teamDomain}`) return null;
 const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
 if (!aud.includes(config.aud)) return null;
 if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_SECONDS < nowSeconds) return null;
 if (typeof payload.nbf === 'number' && payload.nbf - CLOCK_SKEW_SECONDS > nowSeconds) return null;
 if (typeof payload.email !== 'string' || !payload.email.includes('@')) return null;
 return payload.email.trim().toLowerCase();
}

/** Chaves públicas do time, com cache curto e nova busca quando aparece um kid desconhecido. */
export function accessKeyLookup(teamDomain: string, fetcher: typeof fetch = fetch, ttlMs = 10 * 60 * 1000): KeyLookup {
 let cache: { at: number; keys: Map<string, CryptoKey> } | null = null;
 async function load(): Promise<Map<string, CryptoKey>> {
  const response = await fetcher(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error('Chaves do Cloudflare Access indisponíveis.');
  const body = await response.json() as { keys?: (JsonWebKey & { kid?: string })[] };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of body.keys ?? []) {
   if (!jwk.kid || jwk.kty !== 'RSA') continue;
   keys.set(jwk.kid, await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
  }
  cache = { at: Date.now(), keys };
  return keys;
 }
 return async (kid) => {
  let keys = cache && Date.now() - cache.at < ttlMs ? cache.keys : await load();
  // Chave nova após rotação: busca de novo, no máximo uma vez por minuto, para
  // que tokens com kid inventado não virem uma enxurrada de buscas.
  if (!keys.has(kid) && cache && Date.now() - cache.at > 60_000) keys = await load();
  return keys.get(kid) ?? null;
 };
}
