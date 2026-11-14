/**
 * Verificação em duas etapas: códigos de 6 dígitos que mudam a cada 30 segundos (TOTP, RFC 6238),
 * os mesmos do Google Authenticator, Microsoft Authenticator, Authy e 1Password.
 * Só usa a Web Crypto do próprio ambiente (navegador e servidor), sem serviço externo.
 */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD = 30;
export const TOTP_DIGITS = 6;
/** Aceita o código do passo anterior e do seguinte (relógio do celular um pouco adiantado ou atrasado). */
export const TOTP_WINDOW = 1;
export const RECOVERY_CODES = 10;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  const out: number[] = [];
  let bits = 0, value = 0;
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("Chave inválida.");
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

/** Chave nova: 20 bytes aleatórios (160 bits), em base32. */
export function newSecret(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

/** Código HOTP (RFC 4226) para um contador. */
export async function hotp(secret: string, counter: number, digits = TOTP_DIGITS): Promise<string> {
  const key = await crypto.subtle.importKey("raw", base32Decode(secret) as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const message = new Uint8Array(8);
  let rest = counter;
  for (let i = 7; i >= 0; i--) { message[i] = rest & 255; rest = Math.floor(rest / 256); }
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = mac[mac.length - 1] & 15;
  const binary = ((mac[offset] & 127) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export const stepAt = (timeMs: number) => Math.floor(timeMs / 1000 / TOTP_PERIOD);
export const totp = (secret: string, timeMs: number, digits = TOTP_DIGITS) => hotp(secret, stepAt(timeMs), digits);

/**
 * Confere o código. Devolve o passo aceito (para não aceitar o mesmo código duas vezes) ou null.
 * `lastStep`: o último passo já usado por esta pessoa.
 */
export async function verifyTotp(secret: string, code: string, timeMs: number, lastStep = 0): Promise<number | null> {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const now = stepAt(timeMs);
  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
    const step = now + delta;
    if (step <= lastStep) continue;
    if (await hotp(secret, step) === clean) return step;
  }
  return null;
}

/** Endereço que o app autenticador lê pelo QR code. */
export function otpauthUrl(issuer: string, account: string, secret: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/** Chave em grupos de 4, para digitar à mão no app. */
export const groupSecret = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim();

/** Códigos de recuperação: 10 códigos de uso único, no formato XXXX-XXXX (sem letras que confundem). */
export function newRecoveryCodes(count = RECOVERY_CODES): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: count }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
}

/** O mesmo código, digitado com ou sem hífen, em maiúsculas ou minúsculas. */
export const normalizeRecoveryCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const looksLikeRecoveryCode = (code: string) => /^[A-Z0-9]{8}$/.test(normalizeRecoveryCode(code)) && !/^\d+$/.test(code.trim());
