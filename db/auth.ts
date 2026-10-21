import { audit, brazilTimestamp, database } from "@/db/runtime";
import { isPlatformAdvisor, isPlatformOwnerEmail } from "@/db/access";
import type { AccessView } from "@/lib/expansion-types";
import { hashPassword, isToken, passwordProblem, randomToken, sha256Hex, verifyPassword, type PasswordHash } from "@/lib/password";

export const SESSION_HOURS = 24;
export const LINK_HOURS = 72;
const LOCK_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_NETWORK = 20;

export class AuthError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
const normalize = (email: string) => email.trim().toLowerCase();

async function first(sql: string, ...args: (string | number | null)[]) {
  return (await database().prepare(sql).bind(...args).all()).results[0];
}

// Quando o e-mail não tem senha, ainda calculamos um PBKDF2 para que o tempo de
// resposta não revele quais e-mails estão cadastrados.
const DECOY: PasswordHash = { hash: "0".repeat(64), salt: "00000000000000000000000000000000", iterations: 100_000 };

/* ---------- Sessões ---------- */

export async function sessionEmail(token: string | null | undefined): Promise<string | null> {
  if (!isToken(token)) return null;
  const row = await first("SELECT email FROM user_sessions WHERE token_hash=? AND expires_at>?", await sha256Hex(token), iso());
  return row ? String(row.email) : null;
}

async function openSession(email: string): Promise<string> {
  const token = randomToken();
  const db = database();
  await db.batch([
    db.prepare("DELETE FROM user_sessions WHERE expires_at<=?").bind(iso()),
    db.prepare("INSERT INTO user_sessions(token_hash,email,created_at,expires_at) VALUES(?,?,?,?)")
      .bind(await sha256Hex(token), email, iso(), iso(SESSION_HOURS * 3_600_000)),
  ]);
  return token;
}

export async function closeSession(token: string | null | undefined) {
  if (!isToken(token)) return;
  await database().prepare("DELETE FROM user_sessions WHERE token_hash=?").bind(await sha256Hex(token)).run();
}

/* ---------- Bloqueio de tentativas ---------- */

async function lockedUntil(key: string): Promise<string | null> {
  const row = await first("SELECT locked_until FROM login_throttle WHERE key=?", key);
  const until = row?.locked_until ? String(row.locked_until) : null;
  return until && until > iso() ? until : null;
}

async function recordFailure(key: string, max: number) {
  const now = iso(), windowStart = iso(-LOCK_MINUTES * 60_000);
  const row = await first("SELECT failures,window_started_at FROM login_throttle WHERE key=?", key);
  const fresh = !row || String(row.window_started_at) < windowStart;
  const failures = fresh ? 1 : Number(row.failures) + 1;
  const locked = failures >= max ? iso(LOCK_MINUTES * 60_000) : null;
  await database().prepare(`INSERT INTO login_throttle(key,failures,window_started_at,locked_until) VALUES(?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,window_started_at=excluded.window_started_at,locked_until=excluded.locked_until`)
    .bind(key, failures, fresh ? now : String(row.window_started_at), locked).run();
}

/* ---------- Login ---------- */

/** Confere e-mail e senha e abre uma sessão. Devolve o token da sessão. */
export async function login(emailInput: string, password: string, network: string): Promise<string> {
  const email = normalize(emailInput);
  const emailKey = `email:${email}`, networkKey = `rede:${network || "desconhecida"}`;
  if (await lockedUntil(emailKey) || await lockedUntil(networkKey)) {
    throw new AuthError(`Muitas tentativas erradas. Aguarde ${LOCK_MINUTES} minutos e tente de novo.`, 429);
  }
  const row = await first("SELECT password_hash,password_salt,iterations FROM user_credentials WHERE email=?", email);
  const stored: PasswordHash = row
    ? { hash: String(row.password_hash), salt: String(row.password_salt), iterations: Number(row.iterations) }
    : DECOY;
  const ok = (await verifyPassword(password, stored)) && Boolean(row);
  if (!ok) {
    await recordFailure(emailKey, MAX_FAILURES_PER_EMAIL);
    await recordFailure(networkKey, MAX_FAILURES_PER_NETWORK);
    throw new AuthError("E-mail ou senha incorretos.", 401);
  }
  const db = database();
  await db.batch([
    db.prepare("DELETE FROM login_throttle WHERE key=?").bind(emailKey),
    db.prepare("UPDATE user_credentials SET last_login_at=? WHERE email=?").bind(iso(), email),
  ]);
  return openSession(email);
}

/* ---------- Links para criar ou trocar a senha ---------- */

/**
 * Quem pode gerar link para quem. Um link permite entrar como aquela pessoa em
 * TODAS as organizações dela; por isso um administrador comum só gera link para
 * quem pertence apenas à organização dele. Donos da plataforma podem gerar para
 * qualquer membro da organização aberta.
 */
export async function createPasswordLink(access: AccessView, targetInput: string): Promise<string> {
  if (!access.active || access.role !== "Administrador") throw new AuthError("Somente administradores geram links de acesso.", 403);
  const target = normalize(targetInput);
  const member = await first("SELECT id FROM app_users WHERE organization_id=? AND lower(email)=? AND active=1", access.organizationId, target);
  if (!member) throw new AuthError("Esta pessoa não tem perfil ativo nesta organização.", 403);
  if (!isPlatformOwnerEmail(access.email)) {
    if (isPlatformOwnerEmail(target) || await isPlatformAdvisor(target)) {
      throw new AuthError("O acesso da equipe Elite só pode ser gerado pelos donos da plataforma.", 403);
    }
    const elsewhere = await first("SELECT id FROM app_users WHERE lower(email)=? AND active=1 AND organization_id<>?", target, access.organizationId);
    if (elsewhere) throw new AuthError("Esta pessoa também participa de outra organização. Peça aos donos da plataforma.", 403);
  }
  const token = randomToken();
  const db = database();
  await db.batch([
    // Um link novo cancela os anteriores que ainda não foram usados.
    db.prepare("DELETE FROM password_links WHERE email=? AND used_at IS NULL").bind(target),
    db.prepare("INSERT INTO password_links(token_hash,email,created_by,created_at,expires_at) VALUES(?,?,?,?,?)")
      .bind(await sha256Hex(token), target, normalize(access.email), iso(), iso(LINK_HOURS * 3_600_000)),
  ]);
  await audit(db, access.organizationId, access.email, "password_link", "app_user", Number(member.id),
    `Link de acesso gerado para ${target} (válido por ${LINK_HOURS} horas, uso único).`);
  return token;
}

/** Para a tela de definir senha: de quem é o link e se ele ainda vale. */
export async function passwordLinkInfo(token: unknown): Promise<{ email: string; hasPassword: boolean } | null> {
  if (!isToken(token)) return null;
  const row = await first("SELECT email FROM password_links WHERE token_hash=? AND used_at IS NULL AND expires_at>?", await sha256Hex(token), iso());
  if (!row) return null;
  const email = String(row.email);
  return { email, hasPassword: Boolean(await first("SELECT email FROM user_credentials WHERE email=?", email)) };
}

/** Usa o link: grava a senha nova, encerra as sessões antigas e já abre uma sessão nova. */
export async function redeemPasswordLink(token: unknown, password: string): Promise<string> {
  const info = await passwordLinkInfo(token);
  if (!info || !isToken(token)) throw new AuthError("Este link é inválido, expirou ou já foi usado. Peça um novo ao administrador.", 403);
  const problem = passwordProblem(password, info.email);
  if (problem) throw new AuthError(problem);
  const hashed = await hashPassword(password);
  const db = database();
  // Marca o link como usado antes de tudo; se dois envios chegarem juntos, só um passa.
  const claim = await db.prepare("UPDATE password_links SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>?")
    .bind(iso(), await sha256Hex(token), iso()).run();
  if (Number(claim.meta?.changes ?? 0) !== 1) throw new AuthError("Este link acabou de ser usado. Peça um novo ao administrador.", 403);
  await db.batch([
    db.prepare(`INSERT INTO user_credentials(email,password_hash,password_salt,iterations,updated_at,last_login_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,password_salt=excluded.password_salt,iterations=excluded.iterations,updated_at=excluded.updated_at,last_login_at=excluded.last_login_at`)
      .bind(info.email, hashed.hash, hashed.salt, hashed.iterations, brazilTimestamp(), iso()),
    db.prepare("DELETE FROM user_sessions WHERE email=?").bind(info.email),
    db.prepare("DELETE FROM login_throttle WHERE key=?").bind(`email:${info.email}`),
  ]);
  return openSession(info.email);
}
