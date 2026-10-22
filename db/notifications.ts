import { env } from "cloudflare:workers";
import { isPlatformOwnerEmail } from "@/db/access";
import { getAgenda } from "@/db/agenda";
import { brazilTimestamp, database } from "@/db/runtime";
import type { AccessView, UserRole } from "@/lib/expansion-types";
import { dailyEmail, defaultPrefs, spDay, weekdayInBrazil, weeklyEmail, type EmailContent, type NotificationKind } from "@/lib/notifications";

export class NotificationError extends Error { constructor(message: string, public status = 400) { super(message); } }

type Row = Record<string, unknown>;
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
async function rows(sql: string, values: unknown[] = []) { return (await database().prepare(sql).bind(...values).all()).results as Row[]; }
const TEAM_ROLES = ["Administrador", "Coordenação", "Líder", "Comercial"];
const MAX_RECIPIENTS = 500;

/**
 * Envio pelo Resend (resend.com). Fica desligado até a publicação ter as três
 * configurações: a chave do serviço, o remetente (de um domínio verificado) e o
 * endereço da plataforma, usado nos links dos e-mails.
 */
export function emailConfig() {
  const e = env as unknown as { RESEND_API_KEY?: string; EMAIL_FROM?: string; PUBLIC_APP_URL?: string };
  const missing = [!e.RESEND_API_KEY && "RESEND_API_KEY", !e.EMAIL_FROM && "EMAIL_FROM", !e.PUBLIC_APP_URL && "PUBLIC_APP_URL"].filter(Boolean) as string[];
  return { configured: missing.length === 0, missing, from: e.EMAIL_FROM ?? "", appUrl: (e.PUBLIC_APP_URL ?? "").replace(/\/+$/, ""), key: e.RESEND_API_KEY ?? "" };
}

export type Sender = (to: string, content: EmailContent) => Promise<void>;
export const resendSender: Sender = async (to, content) => {
  const config = emailConfig();
  if (!config.configured) throw new NotificationError("O envio de e-mail ainda não foi configurado.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${config.key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: config.from, to: [to], subject: content.subject, html: content.html, text: content.text }),
  });
  if (!response.ok) throw new NotificationError(`O serviço de e-mail recusou o envio (código ${response.status}).`);
};

/** Preferência da pessoa nesta empresa; sem escolha, vale o padrão da função (e a linha nasce com o token do link de saída). */
async function prefsOf(organizationId: number, email: string, role: string) {
  const key = email.toLowerCase();
  let row = (await rows("SELECT daily,weekly,token FROM notification_prefs WHERE organization_id=? AND email=?", [organizationId, key]))[0];
  if (!row) {
    const d = defaultPrefs(role);
    await database().prepare("INSERT OR IGNORE INTO notification_prefs(organization_id,email,daily,weekly,token,updated_by,updated_at) VALUES(?,?,?,?,?,?,?)")
      .bind(organizationId, key, Number(d.daily), Number(d.weekly), crypto.randomUUID().replaceAll("-", ""), "padrão", brazilTimestamp()).run();
    row = (await rows("SELECT daily,weekly,token FROM notification_prefs WHERE organization_id=? AND email=?", [organizationId, key]))[0];
  }
  return { daily: Boolean(Number(row.daily)), weekly: Boolean(Number(row.weekly)), token: str(row.token) };
}

const unsubscribeUrl = (appUrl: string, token: string, kind: NotificationKind) => appUrl ? `${appUrl}/avisos/sair?t=${token}&tipo=${kind}` : "";
/** O mínimo que a agenda precisa para calcular os retornos de alguém da equipe. */
const agendaAccess = (organizationId: number, email: string, role: string) => ({ active: true, role: role as UserRole, isAdvisory: false, organizationId, email } as AccessView);

async function dailyFor(organizationId: number, organization: string, user: { email: string; name: string; role: string }, appUrl: string, token: string, now: number) {
  const agenda = await getAgenda(agendaAccess(organizationId, user.email, user.role), now);
  if (!agenda) return null;
  return dailyEmail({ name: user.name || user.email, organization, organizationId, appUrl, unsubscribeUrl: unsubscribeUrl(appUrl, token, "diario"), late: agenda.late, today: agenda.today, upcoming: agenda.upcoming, items: agenda.items });
}

async function weeklyFor(organizationId: number, organization: string, user: { email: string; name: string }, appUrl: string, token: string, now: number) {
  const since = spDay(now - 7 * 86_400_000), until = spDay(now - 86_400_000);
  const inOrg = "city_id IN (SELECT id FROM cities WHERE organization_id=?)";
  const count = async (sql: string, values: unknown[]) => Number((await rows(sql, values))[0]?.n ?? 0);
  const people = await count(`SELECT COUNT(*) AS n FROM territory_people WHERE ${inOrg} AND substr(created_at,1,10)>=? AND substr(created_at,1,10)<=?`, [organizationId, since, until]);
  const places = await count("SELECT COUNT(*) AS n FROM businesses WHERE organization_id=? AND substr(created_at,1,10)>=? AND substr(created_at,1,10)<=?", [organizationId, since, until]);
  const opportunities = await count("SELECT COUNT(*) AS n FROM opportunities WHERE organization_id=? AND substr(created_at,1,10)>=? AND substr(created_at,1,10)<=?", [organizationId, since, until]);
  const sale = (await rows(`SELECT COUNT(*) AS n,COALESCE(SUM(amount_cents),0) AS total FROM sales WHERE ${inOrg} AND status='Pagamento confirmado' AND substr(paid_at,1,10)>=? AND substr(paid_at,1,10)<=?`, [organizationId, since, until]))[0];
  const team = await rows(`SELECT email,name,role FROM app_users WHERE organization_id=? AND active=1 AND role IN (${TEAM_ROLES.map(() => "?").join(",")}) ORDER BY name LIMIT 100`, [organizationId, ...TEAM_ROLES]);
  const overdue = [];
  for (const member of team) {
    const agenda = await getAgenda(agendaAccess(organizationId, str(member.email), str(member.role)), now);
    if (agenda?.late) overdue.push({ name: str(member.name) || str(member.email), late: agenda.late });
  }
  overdue.sort((a, b) => b.late - a.late);
  const platform = organizationId === 1 && isPlatformOwnerEmail(user.email) ? {
    newRequests: await count("SELECT COUNT(*) AS n FROM subscription_requests WHERE substr(created_at,1,10)>=? AND substr(created_at,1,10)<=?", [since, until]),
    openRequests: await count("SELECT COUNT(*) AS n FROM subscription_requests WHERE status IN ('Novo','Em conversa')", []),
    latePayments: (await rows("SELECT o.name FROM organization_subscriptions s JOIN organizations o ON o.id=s.organization_id WHERE o.active=1 AND s.paid_until IS NOT NULL AND s.paid_until<? ORDER BY o.name LIMIT 20", [spDay(now)])).map((r) => str(r.name)),
  } : undefined;
  return weeklyEmail({
    name: user.name || user.email, organization, organizationId, appUrl, unsubscribeUrl: unsubscribeUrl(appUrl, token, "semanal"),
    since, until, people, places, opportunities, sales: Number(sale?.n ?? 0), salesCents: Number(sale?.total ?? 0), overdue, platform,
  });
}

/**
 * Rodada automática (todo dia às 7h30 de Brasília; o resumo semanal às segundas).
 * Cada aviso sai uma vez por pessoa, empresa e período, mesmo se a rodada repetir.
 */
export async function runNotifications(now = Date.now(), send: Sender = resendSender, config = emailConfig()) {
  const day = spDay(now), weekly = weekdayInBrazil(now) === 1;
  const totals = { sent: 0, failed: 0, skipped: 0 };
  const recipients = config.configured ? await rows(`SELECT u.organization_id,u.email,u.name,u.role,o.name AS organization FROM app_users u JOIN organizations o ON o.id=u.organization_id
    WHERE u.active=1 AND o.active=1 AND u.role IN (${TEAM_ROLES.map(() => "?").join(",")}) ORDER BY u.organization_id,u.email LIMIT ${MAX_RECIPIENTS}`, TEAM_ROLES) : [];
  for (const r of recipients) {
    const organizationId = Number(r.organization_id), user = { email: str(r.email).toLowerCase(), name: str(r.name), role: str(r.role) };
    const prefs = await prefsOf(organizationId, user.email, user.role);
    const jobs: [NotificationKind, () => Promise<EmailContent | null>][] = [];
    if (prefs.daily) jobs.push(["diario", () => dailyFor(organizationId, str(r.organization), user, config.appUrl, prefs.token, now)]);
    if (weekly && prefs.weekly && user.role === "Administrador") jobs.push(["semanal", () => weeklyFor(organizationId, str(r.organization), user, config.appUrl, prefs.token, now)]);
    for (const [kind, build] of jobs) {
      const content = await build();
      if (!content) { totals.skipped++; continue; }
      const id = crypto.randomUUID();
      const claimed = await database().prepare("INSERT OR IGNORE INTO notification_log(id,organization_id,email,kind,period,status,created_at) VALUES(?,?,?,?,?,'enviando',?)").bind(id, organizationId, user.email, kind, day, brazilTimestamp()).run();
      if (!claimed.meta.changes) { totals.skipped++; continue; }
      try {
        await send(user.email, content);
        await database().prepare("UPDATE notification_log SET status='enviado' WHERE id=?").bind(id).run();
        totals.sent++;
      } catch (error) {
        await database().prepare("UPDATE notification_log SET status='falhou',detail=? WHERE id=?").bind(error instanceof Error ? error.message.slice(0, 300) : "Falha no envio.", id).run();
        totals.failed++;
      }
    }
  }
  const detail = config.configured ? "" : `Envio desligado: falta configurar ${config.missing.join(", ")}.`;
  await database().prepare("INSERT INTO notification_runs(id,ran_at,configured,sent,failed,skipped,detail) VALUES(?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), brazilTimestamp(new Date(now)), Number(config.configured), totals.sent, totals.failed, totals.skipped, detail).run();
  return { ...totals, configured: config.configured };
}

/** Link "parar de receber" do e-mail: funciona sem entrar na plataforma. */
export async function unsubscribe(token: string, kind: string) {
  if (!/^[0-9a-f]{32}$/.test(token) || (kind !== "diario" && kind !== "semanal")) return null;
  const column = kind === "diario" ? "daily" : "weekly";
  const row = (await rows("SELECT p.organization_id,o.name FROM notification_prefs p JOIN organizations o ON o.id=p.organization_id WHERE p.token=?", [token]))[0];
  if (!row) return null;
  await database().prepare(`UPDATE notification_prefs SET ${column}=0,updated_by='link do e-mail',updated_at=? WHERE token=?`).bind(brazilTimestamp(), token).run();
  return { organization: str(row.name), kind: kind as NotificationKind };
}

/** As escolhas de quem está conectado (e, para o administrador, de toda a equipe). */
export async function myPrefs(a: AccessView) {
  const prefs = await prefsOf(a.organizationId, a.email, a.role);
  return { daily: prefs.daily, weekly: prefs.weekly, canWeekly: a.role === "Administrador", configured: emailConfig().configured };
}

export async function setPrefs(a: AccessView, input: unknown) {
  const v = input as { email?: unknown; daily?: unknown; weekly?: unknown } | null;
  if (typeof v?.daily !== "boolean" || typeof v?.weekly !== "boolean") throw new NotificationError("Escolha os avisos.");
  const target = typeof v.email === "string" && v.email ? v.email.toLowerCase() : a.email.toLowerCase();
  if (target !== a.email.toLowerCase()) {
    if (a.role !== "Administrador") throw new NotificationError("Só o administrador muda os avisos de outra pessoa.", 403);
    if (!(await rows("SELECT 1 FROM app_users WHERE organization_id=? AND lower(email)=? AND active=1", [a.organizationId, target]))[0]) throw new NotificationError("Pessoa não encontrada na equipe.", 404);
  }
  const role = str((await rows("SELECT role FROM app_users WHERE organization_id=? AND lower(email)=?", [a.organizationId, target]))[0]?.role) || a.role;
  await prefsOf(a.organizationId, target, role);
  await database().prepare("UPDATE notification_prefs SET daily=?,weekly=?,updated_by=?,updated_at=? WHERE organization_id=? AND email=?")
    .bind(Number(v.daily), Number(v.weekly && role === "Administrador"), a.email.toLowerCase(), brazilTimestamp(), a.organizationId, target).run();
  return { ok: true };
}

function admin(a: AccessView) {
  if (!a.active || a.role !== "Administrador") throw new NotificationError("Somente o administrador vê a configuração dos avisos.", 403);
}

/** Gestão → Avisos: situação do envio, última rodada, quem recebe o quê e a prévia de cada e-mail. */
export async function notificationsOverview(a: AccessView, appUrl: string, now = Date.now()) {
  admin(a);
  const config = emailConfig(), url = config.appUrl || appUrl;
  const team = await rows(`SELECT email,name,role FROM app_users WHERE organization_id=? AND active=1 AND role IN (${TEAM_ROLES.map(() => "?").join(",")}) ORDER BY name LIMIT 200`, [a.organizationId, ...TEAM_ROLES]);
  const last = await rows("SELECT email,kind,MAX(created_at) AS at FROM notification_log WHERE organization_id=? AND status='enviado' GROUP BY email,kind", [a.organizationId]);
  const lastOf = (email: string, kind: string) => str(last.find((l) => str(l.email) === email && str(l.kind) === kind)?.at) || null;
  const people = [];
  for (const m of team) {
    const email = str(m.email).toLowerCase(), prefs = await prefsOf(a.organizationId, email, str(m.role));
    people.push({ email, name: str(m.name) || email, role: str(m.role), daily: prefs.daily, weekly: prefs.weekly && str(m.role) === "Administrador", lastDaily: lastOf(email, "diario"), lastWeekly: lastOf(email, "semanal") });
  }
  const me = await prefsOf(a.organizationId, a.email, a.role), user = { email: a.email, name: a.name, role: a.role };
  const run = (await rows("SELECT * FROM notification_runs ORDER BY ran_at DESC LIMIT 1"))[0];
  return {
    configured: config.configured, missing: config.missing, people,
    lastRun: run ? { ranAt: str(run.ran_at), configured: Boolean(Number(run.configured)), sent: Number(run.sent), failed: Number(run.failed), skipped: Number(run.skipped), detail: str(run.detail) } : null,
    preview: { daily: await dailyFor(a.organizationId, a.organizationName, user, url, me.token, now), weekly: await weeklyFor(a.organizationId, a.organizationName, user, url, me.token, now) },
  };
}

/** "Enviar teste para mim": os dois e-mails, marcados como teste, só para quem pediu. */
export async function sendTest(a: AccessView, send: Sender = resendSender, now = Date.now()) {
  admin(a);
  const config = emailConfig();
  if (!config.configured) throw new NotificationError(`O envio ainda não está ligado: falta configurar ${config.missing.join(", ")}.`);
  const me = await prefsOf(a.organizationId, a.email, a.role), user = { email: a.email, name: a.name, role: a.role };
  const contents = [await dailyFor(a.organizationId, a.organizationName, user, config.appUrl, me.token, now), await weeklyFor(a.organizationId, a.organizationName, user, config.appUrl, me.token, now)].filter(Boolean) as EmailContent[];
  for (const content of contents) await send(a.email, { ...content, subject: `[Teste] ${content.subject}` });
  return { sent: contents.length };
}
