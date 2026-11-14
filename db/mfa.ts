/**
 * Verificação em duas etapas (app autenticador) e a regra da empresa que pode exigi-la da equipe.
 * A chave do app fica só no banco; dos códigos de recuperação, só o hash (SHA-256).
 * Quem decide: cada pessoa liga ou desliga a sua (com um código válido); o administrador da empresa
 * pode exigir da equipe e redefinir a de alguém que perdeu o celular (fica no Histórico).
 */
import { audit, database } from "@/db/runtime";
import { isPlatformAdvisor, isPlatformOwnerEmail } from "@/db/access";
import type { AccessView } from "@/lib/expansion-types";
import { isToken, randomToken, sha256Hex } from "@/lib/password";
import { looksLikeRecoveryCode, newRecoveryCodes, newSecret, normalizeRecoveryCode, otpauthUrl, verifyTotp } from "@/lib/totp";

export const MFA_ISSUER = "Elite Expansion X";
export const CHALLENGE_MINUTES = 5;
export const MAX_CHALLENGE_ATTEMPTS = 5;

export class MfaError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type Row = Record<string, unknown>;
const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
const normalize = (email: string) => email.trim().toLowerCase();
async function first(sql: string, ...args: (string | number | null)[]): Promise<Row | undefined> {
  return (await database().prepare(sql).bind(...args).all()).results[0] as Row | undefined;
}
const hashes = (row: Row | undefined): string[] => { try { const v = JSON.parse(String(row?.recovery_hashes ?? "[]")); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };

/** Registra no Histórico de cada empresa da pessoa (é uma mudança da conta, não de uma empresa só). */
async function auditEverywhere(email: string, actor: string, action: string, summary: string) {
  const db = database();
  const orgs = (await db.prepare("SELECT DISTINCT organization_id FROM app_users WHERE lower(email)=? AND active=1").bind(email).all()).results;
  for (const row of orgs) await audit(db, Number(row.organization_id), actor, action, "app_user", null, summary);
}

export async function hasMfa(emailInput: string): Promise<boolean> {
  return Boolean(await first("SELECT 1 AS ok FROM user_mfa WHERE email=? AND enabled_at IS NOT NULL", normalize(emailInput)));
}

export async function mfaStatus(emailInput: string): Promise<{ enabled: boolean; enabledAt: string | null; recoveryLeft: number }> {
  const row = await first("SELECT enabled_at,recovery_hashes FROM user_mfa WHERE email=?", normalize(emailInput));
  const enabledAt = row?.enabled_at ? String(row.enabled_at) : null;
  return { enabled: Boolean(enabledAt), enabledAt, recoveryLeft: enabledAt ? hashes(row).length : 0 };
}

/** Começa (ou recomeça) o cadastro: chave nova, ainda desligada até a pessoa confirmar com um código. */
export async function startEnrollment(emailInput: string): Promise<{ secret: string; otpauth: string }> {
  const email = normalize(emailInput);
  if (await hasMfa(email)) throw new MfaError("A verificação em duas etapas já está ativa nesta conta.", 409);
  const secret = newSecret(), now = iso();
  await database().prepare(`INSERT INTO user_mfa(email,secret,enabled_at,recovery_hashes,last_step,created_at,updated_at) VALUES(?,?,NULL,'[]',0,?,?)
    ON CONFLICT(email) DO UPDATE SET secret=excluded.secret,enabled_at=NULL,recovery_hashes='[]',last_step=0,updated_at=excluded.updated_at`).bind(email, secret, now, now).run();
  return { secret, otpauth: otpauthUrl(MFA_ISSUER, email, secret) };
}

async function storeRecovery(codes: string[]) {
  const list = await Promise.all(codes.map((code) => sha256Hex(normalizeRecoveryCode(code))));
  return JSON.stringify(list);
}

/** Confirma o cadastro com o primeiro código do app. Devolve os códigos de recuperação (mostrados uma vez só). */
export async function confirmEnrollment(emailInput: string, code: string, now = Date.now()): Promise<string[]> {
  const email = normalize(emailInput);
  const row = await first("SELECT secret,enabled_at FROM user_mfa WHERE email=?", email);
  if (!row) throw new MfaError("Comece o cadastro de novo: a chave não foi encontrada.", 404);
  if (row.enabled_at) throw new MfaError("A verificação em duas etapas já está ativa nesta conta.", 409);
  const step = await verifyTotp(String(row.secret), code, now);
  if (step === null) throw new MfaError("Código incorreto. Confira se o horário do celular está automático e digite o código que aparece agora.", 401);
  const codes = newRecoveryCodes();
  await database().prepare("UPDATE user_mfa SET enabled_at=?,last_step=?,recovery_hashes=?,updated_at=? WHERE email=? AND enabled_at IS NULL")
    .bind(iso(), step, await storeRecovery(codes), iso(), email).run();
  await auditEverywhere(email, email, "mfa_enabled", "Verificação em duas etapas ligada.");
  return codes;
}

/**
 * Confere o segundo fator: o código do app (sem aceitar o mesmo duas vezes) ou um código de recuperação
 * (que vale uma vez só). Devolve como entrou, ou null.
 */
export async function checkSecondFactor(emailInput: string, code: string, now = Date.now()): Promise<"app" | "recuperacao" | null> {
  const email = normalize(emailInput);
  const row = await first("SELECT secret,last_step,recovery_hashes FROM user_mfa WHERE email=? AND enabled_at IS NOT NULL", email);
  if (!row) return null;
  const db = database();
  if (looksLikeRecoveryCode(code)) {
    const hash = await sha256Hex(normalizeRecoveryCode(code));
    const list = hashes(row);
    if (!list.includes(hash)) return null;
    const left = JSON.stringify(list.filter((h) => h !== hash));
    // Só vale se ninguém usou o mesmo código no mesmo instante.
    const r = await db.prepare("UPDATE user_mfa SET recovery_hashes=?,updated_at=? WHERE email=? AND recovery_hashes=?").bind(left, iso(), email, String(row.recovery_hashes)).run();
    return Number(r.meta?.changes ?? 0) === 1 ? "recuperacao" : null;
  }
  const step = await verifyTotp(String(row.secret), code, now, Number(row.last_step ?? 0));
  if (step === null) return null;
  const r = await db.prepare("UPDATE user_mfa SET last_step=?,updated_at=? WHERE email=? AND last_step<?").bind(step, iso(), email, step).run();
  return Number(r.meta?.changes ?? 0) === 1 ? "app" : null;
}

/** Desliga a própria verificação (exige um código válido). */
export async function disableMfa(emailInput: string, code: string): Promise<void> {
  const email = normalize(emailInput);
  if (!(await hasMfa(email))) throw new MfaError("A verificação em duas etapas não está ativa.", 409);
  if (!(await checkSecondFactor(email, code))) throw new MfaError("Código incorreto.", 401);
  await database().prepare("DELETE FROM user_mfa WHERE email=?").bind(email).run();
  await auditEverywhere(email, email, "mfa_disabled", "Verificação em duas etapas desligada pela própria pessoa.");
}

/** Gera códigos de recuperação novos (os antigos deixam de valer). */
export async function regenerateRecovery(emailInput: string, code: string): Promise<string[]> {
  const email = normalize(emailInput);
  if (!(await hasMfa(email))) throw new MfaError("A verificação em duas etapas não está ativa.", 409);
  if (!(await checkSecondFactor(email, code))) throw new MfaError("Código incorreto.", 401);
  const codes = newRecoveryCodes();
  await database().prepare("UPDATE user_mfa SET recovery_hashes=?,updated_at=? WHERE email=?").bind(await storeRecovery(codes), iso(), email).run();
  await auditEverywhere(email, email, "mfa_recovery", "Códigos de recuperação gerados de novo.");
  return codes;
}

/* ---------- Desafio no login ---------- */

/** Depois da senha certa: um desafio de 5 minutos. O navegador guarda o token; aqui fica só o hash. */
export async function createChallenge(emailInput: string): Promise<string> {
  const email = normalize(emailInput);
  const token = randomToken(), db = database();
  await db.batch([
    db.prepare("DELETE FROM mfa_challenges WHERE expires_at<=? OR email=?").bind(iso(), email),
    db.prepare("INSERT INTO mfa_challenges(token_hash,email,attempts,created_at,expires_at) VALUES(?,?,0,?,?)")
      .bind(await sha256Hex(token), email, iso(), iso(CHALLENGE_MINUTES * 60_000)),
  ]);
  return token;
}

/** E-mail do desafio ainda válido (sem gastar tentativa). */
export async function challengeEmail(token: unknown): Promise<string | null> {
  if (!isToken(token)) return null;
  const row = await first("SELECT email FROM mfa_challenges WHERE token_hash=? AND expires_at>?", await sha256Hex(token), iso());
  return row ? String(row.email) : null;
}

/** Confere o código do desafio. Até 5 tentativas; depois, é preciso digitar a senha de novo. */
export async function redeemChallenge(token: unknown, code: string): Promise<string> {
  if (!isToken(token)) throw new MfaError("Digite a senha de novo para continuar.", 401);
  const hash = await sha256Hex(token), db = database();
  const row = await first("SELECT email,attempts FROM mfa_challenges WHERE token_hash=? AND expires_at>?", hash, iso());
  if (!row) throw new MfaError("O tempo para digitar o código acabou. Digite a senha de novo.", 401);
  const attempts = Number(row.attempts) + 1;
  await db.prepare("UPDATE mfa_challenges SET attempts=? WHERE token_hash=?").bind(attempts, hash).run();
  if (attempts > MAX_CHALLENGE_ATTEMPTS) {
    await db.prepare("DELETE FROM mfa_challenges WHERE token_hash=?").bind(hash).run();
    throw new MfaError("Muitas tentativas. Digite a senha de novo.", 429);
  }
  const how = await checkSecondFactor(String(row.email), code);
  if (!how) throw new MfaError("Código incorreto. Use o código que aparece agora no app ou um código de recuperação.", 401);
  await db.prepare("DELETE FROM mfa_challenges WHERE token_hash=?").bind(hash).run();
  if (how === "recuperacao") await auditEverywhere(String(row.email), String(row.email), "mfa_recovery_used", "Entrada com um código de recuperação.");
  return String(row.email);
}

/* ---------- Gestão da empresa ---------- */

/** A empresa exige a verificação da equipe? */
export async function organizationRequiresMfa(organizationId: number): Promise<boolean> {
  return Boolean(Number((await first("SELECT mfa_required FROM organizations WHERE id=?", organizationId))?.mfa_required ?? 0));
}

/** Liga ou desliga a exigência para a equipe (administrador da própria empresa). */
export async function setMfaRequired(access: AccessView, required: boolean, actorHasMfa: boolean): Promise<void> {
  if (!access.active || access.role !== "Administrador" || access.isAdvisory) throw new MfaError("Somente o administrador da empresa muda esta regra.", 403);
  // Quem liga a exigência precisa ter a própria verificação ativa (para não se trancar fora).
  if (required && !actorHasMfa) throw new MfaError("Ative primeiro a sua verificação em duas etapas (Segurança da conta) e depois exija da equipe.", 409);
  const db = database();
  await db.prepare("UPDATE organizations SET mfa_required=? WHERE id=?").bind(required ? 1 : 0, access.organizationId).run();
  await audit(db, access.organizationId, access.email, "mfa_policy", "organization", access.organizationId,
    required ? "Verificação em duas etapas passou a ser exigida da equipe." : "Verificação em duas etapas deixou de ser exigida da equipe.");
}

/**
 * Redefine a verificação de alguém da equipe que perdeu o celular. Mesmas regras do link de acesso:
 * administrador comum só para quem é apenas da empresa dele; a equipe Elite, só os donos da plataforma.
 */
export async function adminResetMfa(access: AccessView, targetInput: string): Promise<void> {
  if (!access.active || access.role !== "Administrador" || access.isAdvisory) throw new MfaError("Somente o administrador da empresa redefine a verificação.", 403);
  const target = normalize(targetInput);
  const member = await first("SELECT id FROM app_users WHERE organization_id=? AND lower(email)=? AND active=1", access.organizationId, target);
  if (!member) throw new MfaError("Esta pessoa não tem perfil ativo nesta empresa.", 403);
  if (!isPlatformOwnerEmail(access.email)) {
    if (isPlatformOwnerEmail(target) || await isPlatformAdvisor(target)) throw new MfaError("A verificação da equipe Elite só pode ser redefinida pelos donos da plataforma.", 403);
    const elsewhere = await first("SELECT id FROM app_users WHERE lower(email)=? AND active=1 AND organization_id<>?", target, access.organizationId);
    if (elsewhere) throw new MfaError("Esta pessoa também participa de outra empresa. Peça aos donos da plataforma.", 403);
  }
  const db = database();
  await db.batch([
    db.prepare("DELETE FROM user_mfa WHERE email=?").bind(target),
    db.prepare("DELETE FROM mfa_challenges WHERE email=?").bind(target),
    // Sessões abertas continuam valendo só até a pessoa sair; quem pediu a redefinição costuma estar sem acesso.
  ]);
  await audit(db, access.organizationId, access.email, "mfa_reset", "app_user", Number(member.id), `Verificação em duas etapas redefinida para ${target}.`);
}

/** Quem da equipe tem a verificação ativa (para a lista da Equipe). */
export async function mfaEnabledEmails(emails: string[]): Promise<Set<string>> {
  const list = [...new Set(emails.map(normalize))].slice(0, 500);
  const out = new Set<string>();
  for (let i = 0; i < list.length; i += 90) {
    const batch = list.slice(i, i + 90);
    const rows = (await database().prepare(`SELECT email FROM user_mfa WHERE enabled_at IS NOT NULL AND email IN (${batch.map(() => "?").join(",")})`).bind(...batch).all()).results;
    for (const r of rows) out.add(String(r.email));
  }
  return out;
}
