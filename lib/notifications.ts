/**
 * Avisos por e-mail: o lembrete diário dos retornos (quem atende) e o resumo
 * semanal (gestão). Aqui só o conteúdo; quem envia e quando fica em db/notifications.ts.
 * Os e-mails levam só o necessário para agir: nome do contato, cidade e próximo passo.
 */
export type EmailContent = { subject: string; html: string; text: string };
export type AgendaItem = { leadName: string; cityName: string; nextAction: string; dueAt: string; late: boolean };
export type DailyData = {
  name: string; organization: string; organizationId: number; appUrl: string; unsubscribeUrl: string;
  late: number; today: number; upcoming: number; items: AgendaItem[];
};
export type WeeklyData = {
  name: string; organization: string; organizationId: number; appUrl: string; unsubscribeUrl: string;
  since: string; until: string;
  people: number; places: number; opportunities: number; sales: number; salesCents: number;
  overdue: { name: string; late: number }[];
  platform?: { newRequests: number; openRequests: number; latePayments: string[] };
};
export type NotificationKind = "diario" | "semanal";
export const NOTIFICATION_LABEL: Record<NotificationKind, string> = { diario: "Lembrete diário dos retornos", semanal: "Resumo semanal da gestão" };
/** Horário do envio automático (Brasília); o resumo semanal sai às segundas. */
export const SEND_TIME = "7h30";

/** Quem recebe cada aviso se não escolher nada: o diário para quem atende, o semanal para o administrador. */
export function defaultPrefs(role: string) {
  return { daily: ["Administrador", "Coordenação", "Líder", "Comercial"].includes(role), weekly: role === "Administrador" };
}

const SP = "America/Sao_Paulo";
export const spDay = (time: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: SP }).format(new Date(time));
const hour = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: SP, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const dayMonth = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: SP, day: "2-digit", month: "2-digit" }).format(new Date(iso));
const brDate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Olá";
/** Dia da semana em Brasília (1 = segunda). */
export function weekdayInBrazil(time: number) {
  return ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[new Intl.DateTimeFormat("en-US", { timeZone: SP, weekday: "short" }).format(new Date(time))];
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
const link = (appUrl: string, organizationId: number, target: string) => appUrl ? `${appUrl}/?org=${organizationId}&${target}` : "";

/** Moldura do e-mail: fundo claro (lê bem em qualquer programa de e-mail), faixa dourada e rodapé com o link de saída. */
function frame(title: string, intro: string, body: string, action: { label: string; href: string } | null, footer: { organization: string; unsubscribeUrl: string; reason: string }) {
  const button = action?.href ? `<p style="margin:24px 0 0"><a href="${escapeHtml(action.href)}" style="display:inline-block;background:#c9a227;color:#111;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${escapeHtml(action.label)}</a></p>` : "";
  const leave = footer.unsubscribeUrl ? ` <a href="${escapeHtml(footer.unsubscribeUrl)}" style="color:#8a7a4a">Parar de receber este aviso</a>.` : "";
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f1ea;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1d1b16">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e0cf">
<tr><td style="background:#0b0b0a;padding:18px 24px;color:#e9c96b;font-size:13px;letter-spacing:.24em;font-weight:600">ELITE EXPANSION X</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 6px;font-size:22px;line-height:1.25">${escapeHtml(title)}</h1>
<p style="margin:0 0 18px;color:#5b5548;font-size:15px;line-height:1.5">${escapeHtml(intro)}</p>
${body}${button}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #efe9da;color:#8a8270;font-size:12px;line-height:1.5">${escapeHtml(footer.organization)} · ${escapeHtml(footer.reason)}${leave}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Lembrete diário: retornos atrasados e de hoje. Sem nada para hoje, não há e-mail. */
export function dailyEmail(d: DailyData): EmailContent | null {
  if (!d.late && !d.today) return null;
  const counts = [d.late && plural(d.late, "retorno atrasado", "retornos atrasados"), d.today && `${d.today} para hoje`].filter(Boolean).join(" e ");
  const subject = `${d.late ? "⚠ " : ""}Sua agenda de hoje: ${counts}`;
  const rows = d.items.map((item) => `<tr><td style="padding:10px 0;border-top:1px solid #efe9da;vertical-align:top">
<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${item.late ? "#b42318" : "#9a7b14"}">${item.late ? `Atrasado · ${dayMonth(item.dueAt)} ${hour(item.dueAt)}` : `Hoje · até ${hour(item.dueAt)}`}</div>
<div style="font-size:15px;font-weight:600;margin-top:2px">${escapeHtml(item.leadName)}</div>
<div style="font-size:13px;color:#5b5548">${escapeHtml(item.nextAction || "Sem próximo passo definido")} · ${escapeHtml(item.cityName)}</div></td></tr>`).join("");
  const more = d.late + d.today - d.items.length;
  const body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>${more > 0 ? `<p style="margin:12px 0 0;color:#5b5548;font-size:13px">E mais ${plural(more, "retorno", "retornos")} na agenda.</p>` : ""}${d.upcoming ? `<p style="margin:12px 0 0;color:#5b5548;font-size:13px">${plural(d.upcoming, "retorno marcado", "retornos marcados")} para os próximos dias.</p>` : ""}`;
  const href = link(d.appUrl, d.organizationId, "area=vendas&ver=agenda");
  const html = frame(`Bom dia, ${firstName(d.name)}`, `Você tem ${counts}. Comece pelos atrasados.`, body, { label: "Abrir a agenda", href }, { organization: d.organization, unsubscribeUrl: d.unsubscribeUrl, reason: `Lembrete diário dos seus retornos, às ${SEND_TIME}.` });
  const text = [`Bom dia, ${firstName(d.name)}. Você tem ${counts}.`, "", ...d.items.map((item) => `- ${item.late ? `ATRASADO (${dayMonth(item.dueAt)} ${hour(item.dueAt)})` : `Hoje até ${hour(item.dueAt)}`}: ${item.leadName} · ${item.nextAction || "Sem próximo passo definido"} · ${item.cityName}`),
    ...(more > 0 ? [`E mais ${plural(more, "retorno", "retornos")} na agenda.`] : []), "", ...(href ? [`Abrir a agenda: ${href}`] : []), ...(d.unsubscribeUrl ? [`Parar de receber: ${d.unsubscribeUrl}`] : [])].join("\n");
  return { subject, html, text };
}

/** Resumo semanal da gestão: o que a equipe fez nos últimos 7 dias e o que está atrasado agora. */
export function weeklyEmail(d: WeeklyData): EmailContent {
  const period = `${brDate(d.since)} a ${brDate(d.until)}`;
  const kpis: [string, string][] = [
    ["Pessoas mapeadas", String(d.people)], ["Locais novos", String(d.places)], ["Atendimentos abertos", String(d.opportunities)],
    ["Vendas confirmadas", d.sales ? `${d.sales} · ${money(d.salesCents)}` : "0"],
  ];
  const kpiHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${kpis.map(([label, value]) => `<td style="width:25%;padding:10px;border:1px solid #efe9da;border-radius:10px;vertical-align:top"><div style="font-size:11px;color:#8a8270;text-transform:uppercase;letter-spacing:.06em">${escapeHtml(label)}</div><div style="font-size:18px;font-weight:700;margin-top:4px">${escapeHtml(value)}</div></td>`).join("")}</tr></table>`;
  const late = d.overdue.filter((o) => o.late > 0);
  const lateHtml = late.length
    ? `<h2 style="font-size:15px;margin:22px 0 6px">Retornos atrasados agora</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${late.map((o) => `<tr><td style="padding:6px 0;border-top:1px solid #efe9da">${escapeHtml(o.name)}</td><td align="right" style="padding:6px 0;border-top:1px solid #efe9da;font-weight:600;color:#b42318">${o.late}</td></tr>`).join("")}</table>`
    : `<p style="margin:22px 0 0;color:#2f7a3d;font-size:14px">Nenhum retorno atrasado na equipe agora.</p>`;
  const p = d.platform;
  const platformHtml = p ? `<h2 style="font-size:15px;margin:22px 0 6px">Plataforma</h2><p style="margin:0;font-size:14px;line-height:1.6">${plural(p.newRequests, "pedido de assinatura novo", "pedidos de assinatura novos")} na semana · ${plural(p.openRequests, "aguardando resposta", "aguardando resposta")}.${p.latePayments.length ? `<br>Pagamento vencido: ${p.latePayments.map(escapeHtml).join(", ")}.` : ""}</p>` : "";
  const href = link(d.appUrl, d.organizationId, "area=resultados&ver=visao");
  const subject = `Resumo da semana (${period}) — ${d.organization}`;
  const html = frame(`Resumo da semana, ${firstName(d.name)}`, `O que a equipe fez de ${period} e o que precisa de atenção.`, kpiHtml + lateHtml + platformHtml, { label: "Ver os resultados", href }, { organization: d.organization, unsubscribeUrl: d.unsubscribeUrl, reason: `Resumo semanal da gestão, às segundas, ${SEND_TIME}.` });
  const text = [`Resumo da semana (${period}) — ${d.organization}`, "", ...kpis.map(([label, value]) => `${label}: ${value}`), "",
    late.length ? "Retornos atrasados agora:" : "Nenhum retorno atrasado na equipe agora.", ...late.map((o) => `- ${o.name}: ${o.late}`),
    ...(p ? ["", `Plataforma: ${p.newRequests} pedido(s) de assinatura novo(s) na semana, ${p.openRequests} aguardando resposta.`, ...(p.latePayments.length ? [`Pagamento vencido: ${p.latePayments.join(", ")}.`] : [])] : []),
    "", ...(href ? [`Ver os resultados: ${href}`] : []), ...(d.unsubscribeUrl ? [`Parar de receber: ${d.unsubscribeUrl}`] : [])].join("\n");
  return { subject, html, text };
}
