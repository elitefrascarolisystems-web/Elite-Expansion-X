/**
 * Senhas e tokens do login por e-mail e senha.
 *
 * A senha nunca é guardada: só o PBKDF2-SHA256 com sal aleatório próprio.
 * 100 mil iterações é o máximo que o Cloudflare Workers aceita.
 * Tokens (sessão e link de senha) vão para o navegador; no banco fica só o SHA-256.
 */
export const PASSWORD_ITERATIONS = 100_000;
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Token aleatório de 256 bits, em hexadecimal (64 caracteres). */
export function randomToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export function isToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export async function sha256Hex(value: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return toHex(new Uint8Array(bits));
}

export type PasswordHash = { hash: string; salt: string; iterations: number };

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: await pbkdf2(password, salt, PASSWORD_ITERATIONS), salt: toHex(salt), iterations: PASSWORD_ITERATIONS };
}

/** Compara em tempo constante para não revelar, pelo tempo de resposta, quanto da senha bateu. */
export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const candidate = await pbkdf2(password, fromHex(stored.salt), stored.iterations);
  if (candidate.length !== stored.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ stored.hash.charCodeAt(i);
  return diff === 0;
}

/** Regras da senha nova. Devolve a mensagem de erro, ou null se estiver boa. */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/[0-9]/.test(password)) return "Use letras e números na senha.";
  const user = email.split("@")[0].toLowerCase();
  if (user.length >= 4 && password.toLowerCase().includes(user)) return "A senha não pode conter o seu e-mail.";
  return null;
}
