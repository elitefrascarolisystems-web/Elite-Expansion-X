/*
 * Página da pessoa (GET /api/territory/person?id=<uuid>): tudo de uma pessoa num lugar só.
 * Consultas por id (sem o CTE de todas as entidades do mapa), com o mesmo escopo do mapa:
 * Administrador, a empresa; Coordenação e Líder, a cidade (sem cidade, nada); Comercial, quem tem
 * atendimento com ele (sem revogação) ou foi cadastrado por ele. Embaixador e Mentorado: 403.
 * Fora do acesso, de outra empresa, inexistente ou anonimizada: 404 com a mesma mensagem.
 * A página nunca manda contato (WhatsApp, e-mail) nem coordenada da pessoa.
 */
import { database, brazilTimestamp } from "@/db/runtime";
import type { AccessView } from "@/lib/expansion-types";
import { canPerform } from "@/lib/expansion-permissions";
import { fechaStatus, rowDue, type Followup } from "@/lib/followup";
import { fillHook } from "@/lib/hooks";
import { nextStep, type NextStep } from "@/lib/next-step";
import { sensitiveLink } from "@/lib/person-places";
import { buildPersonTimeline, brazilDay, type PersonEvent, type PersonTimelineItem } from "@/lib/person-timeline";
import { hookSituationFor, plantingTips, type Level } from "@/lib/planting-tips";
import { ANONYMOUS_LABEL, PRIVACY_KIND_LABEL, type PrivacyKind } from "@/lib/privacy";

export class PersonPageError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const NOT_FOUND = "Pessoa não encontrada ou fora do seu acesso.";

type Row = Record<string, unknown>;
type Value = string | number | null;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const all = async (sql: string, args: Value[] = []) => (await database().prepare(sql).bind(...args).all()).results as Row[];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MANAGEMENT = ["Administrador", "Coordenação", "Líder"];
const ACTION_LABELS: Record<string, string> = { contact: "Retorno registrado", start: "F.E.C.H.A. iniciado", identify: "Trava identificada", resolve: "Solução registrada", link: "Link reenviado", date: "Data combinada", wait: "Aguardando", future: "Retomada futura", resume: "Acompanhamento retomado", aftercare: "Pós-venda" };

/** Escopo de pessoas da página (o mesmo do mapa). `p` é territory_people; inclui a organização. */
export function personScopeSql(a: AccessView, p = "p"): { sql: string; args: Value[] } {
  if (!a.active || ["Embaixador", "Mentorado"].includes(a.role)) throw new PersonPageError("Esta página é da equipe.", 403);
  const base = `${p}.city_id IN (SELECT id FROM cities WHERE organization_id=?) AND ${p}.name NOT LIKE '${ANONYMOUS_LABEL}%'`;
  if (a.role === "Administrador") return { sql: base, args: [a.organizationId] };
  if (a.role === "Coordenação" || a.role === "Líder") return a.cityId ? { sql: `${base} AND ${p}.city_id=?`, args: [a.organizationId, a.cityId] } : { sql: "1=0", args: [] };
  return { sql: `${base} AND (lower(${p}.created_by)=lower(?) OR EXISTS(SELECT 1 FROM leads sl WHERE sl.person_id=${p}.id AND sl.consent_revoked_at IS NULL AND lower(sl.assigned_to_email)=lower(?)))`, args: [a.organizationId, a.email, a.email] };
}

export type PersonPage = {
  id: string; name: string; cityId: number; cityName: string; regionName: string;
  level: Level; badges: string[];
  onMap: { kind: "local"; name: string } | { kind: "bairro"; name: string } | { kind: "cidade" };
  place: { id: string; name: string; type: string; sector: string; link: string } | null;
  placeReview: { id: string; name: string; link: string } | null;
  consent: { at: string; source: string; purpose: string; revokedAt: string | null } | null;
  attendance: null | { hidden: true } | {
    hidden: false; leadId: number; opportunityId: string | null; stage: string; temperature: string; dueDate: string; ownerName: string;
    fecha: string | null; late: boolean; today: boolean; sale: { status: string; amountCents: number; paid: boolean } | null; channel: string;
  };
  referrer: { kind: "pessoa"; id: string; name: string } | { kind: "fora" } | null;
  referred: { total: number; bought: number; withoutAttendance: number; people: { id: string; name: string; client: boolean }[] };
  mentorship: { done: number; total: number; nextMeeting: string | null; owner: string } | null;
  ambassador: { status: string; level: string; training: number; lastUpdate: string; openTasks: number; doneTasks: number; leads: number; sales: number } | null;
  tips: string[];
  hook: { title: string; text: string } | null;
  timeline: { items: PersonTimelineItem[]; more: boolean };
  next: NextStep;
  can: { startAttendance: boolean; recordSale: boolean; edit: boolean; markLeader: boolean; manageMentorship: boolean; addAmbassador: boolean };
  updatedAt: string;
};

export async function getPersonPage(a: AccessView, id: string, opts: { all?: boolean; now?: number } = {}): Promise<PersonPage> {
  const s = personScopeSql(a);
  if (!UUID.test(id)) throw new PersonPageError(NOT_FOUND, 404);
  const now = opts.now ?? Date.now();
  const today = brazilTimestamp(new Date(now)).slice(0, 10);
  const management = MANAGEMENT.includes(a.role);
  const me = a.email.toLowerCase();

  const person = (await all(`SELECT p.*,c.name AS city_name,rg.name AS region_name,b.id AS b_id,b.name AS b_name,COALESCE(NULLIF(b.place_type,''),'Empresa') AS b_type,b.sector AS b_sector FROM territory_people p JOIN cities c ON c.id=p.city_id LEFT JOIN territory_regions rg ON rg.id=p.region_id LEFT JOIN businesses b ON b.id=p.place_id AND b.organization_id=c.organization_id WHERE p.id=? AND ${s.sql}`, [id, ...s.args]))[0];
  if (!person) throw new PersonPageError(NOT_FOUND, 404);

  const [leads, roles, ambassadorRows, childRows, mentorRows, userRows] = await Promise.all([
    all(`SELECT l.*,o.id AS o_id,o.owner_email,o.stage,o.temperature,o.due_date,o.followup_json,s.status AS sale_status,s.amount_cents,s.paid_at,s.created_at AS sale_created FROM leads l LEFT JOIN opportunities o ON o.lead_id=l.id LEFT JOIN sales s ON s.lead_id=l.id WHERE l.person_id=? ORDER BY l.consent_revoked_at IS NOT NULL, l.id DESC LIMIT 5`, [id]),
    all(`SELECT role,status,created_at FROM territory_roles WHERE person_id=? ORDER BY role LIMIT 20`, [id]),
    all(`SELECT a.id,a.status,a.level,a.training_progress,a.created_at,(SELECT MAX(created_at) FROM ambassador_updates u WHERE u.ambassador_id=a.id) AS last_update,(SELECT COUNT(*) FROM tasks t WHERE t.ambassador_id=a.id AND t.status<>'Concluída') AS open_tasks,(SELECT COUNT(*) FROM tasks t WHERE t.ambassador_id=a.id AND t.status='Concluída') AS done_tasks,(SELECT COUNT(*) FROM leads l WHERE l.ambassador_id=a.id) AS leads,(SELECT COUNT(*) FROM sales sa WHERE sa.ambassador_id=a.id AND sa.status='Pagamento confirmado' AND sa.paid_at IS NOT NULL) AS sales FROM ambassadors a WHERE a.person_id=? LIMIT 1`, [id]),
    // Quem ela indicou, só entre as pessoas que quem vê pode ver.
    all(`SELECT p.id,p.name,p.created_at,EXISTS(SELECT 1 FROM leads lc JOIN sales sc ON sc.lead_id=lc.id WHERE lc.person_id=p.id AND lc.consent_revoked_at IS NULL AND sc.status='Pagamento confirmado' AND sc.paid_at IS NOT NULL) AS client,EXISTS(SELECT 1 FROM leads lc WHERE lc.person_id=p.id) AS has_lead FROM territory_people p WHERE p.referrer_id=? AND NOT EXISTS(SELECT 1 FROM leads lx WHERE lx.person_id=p.id AND lx.consent_revoked_at IS NOT NULL) AND ${s.sql} ORDER BY p.name LIMIT 200`, [id, ...s.args]),
    a.role === "Administrador" ? all(`SELECT u.id,u.next_meeting_at,u.portal_owner_email,(SELECT name FROM app_users o WHERE o.organization_id=u.organization_id AND lower(o.email)=lower(u.portal_owner_email)) AS owner_name,(SELECT COUNT(*) FROM portal_progress pp JOIN portal_steps st ON st.id=pp.step_id WHERE pp.user_id=u.id) AS done,(SELECT COUNT(*) FROM portal_steps st WHERE st.organization_id=u.organization_id AND st.audience='Mentorados') AS total FROM app_users u WHERE u.organization_id=? AND u.person_id=? AND u.role='Mentorado' AND u.active=1 LIMIT 1`, [a.organizationId, id]) : Promise.resolve([]),
    all(`SELECT lower(email) AS email,name FROM app_users WHERE organization_id=? AND role IN ('Administrador','Coordenação','Líder','Comercial') LIMIT 500`, [a.organizationId]),
  ]);
  const nameOf = new Map(userRows.map((u) => [str(u.email), str(u.name)]));

  // Atendimento: o vigente (sem revogação) primeiro; a gestão e o responsável veem os detalhes.
  const lead = leads[0] ?? null;
  const revoked = Boolean(lead && lead.consent_revoked_at);
  const liveLead = leads.find((l) => !l.consent_revoked_at) ?? null;
  const owner = liveLead ? str(liveLead.owner_email || liveLead.assigned_to_email).toLowerCase() : "";
  const sees = (l: Row | null) => !!l && (management || (str(l.assigned_to_email).toLowerCase() === me && (!l.o_id || str(l.owner_email).toLowerCase() === me)));
  const visible = sees(liveLead);
  let attendance: PersonPage["attendance"] = null;
  if (liveLead && !visible) attendance = { hidden: true };
  if (liveLead && visible) {
    const followup = JSON.parse(str(liveLead.followup_json) || "{}") as Followup;
    const paid = liveLead.sale_status === "Pagamento confirmado" && !!liveLead.paid_at;
    const due = liveLead.o_id ? rowDue({ followup, due_date: str(liveLead.due_date), stage: str(liveLead.stage), payment_status: liveLead.sale_status ? str(liveLead.sale_status) : null, paid_at: liveLead.paid_at ? str(liveLead.paid_at) : null }, now) : null;
    const fecha = liveLead.o_id ? fechaStatus(followup, paid, now) : null;
    const dueDay = due ? brazilDay(due) : null;
    attendance = {
      hidden: false, leadId: num(liveLead.id), opportunityId: liveLead.o_id ? str(liveLead.o_id) : null, stage: str(liveLead.stage) || str(liveLead.status), temperature: str(liveLead.temperature),
      dueDate: dueDay ?? "", ownerName: nameOf.get(owner) || "", fecha, late: !!due && Date.parse(due) < now && dueDay !== today, today: dueDay === today, channel: str(liveLead.channel),
      sale: liveLead.sale_status ? { status: str(liveLead.sale_status), amountCents: num(liveLead.amount_cents), paid } : null,
    };
  }

  // Nível na rede: Multiplicador > Indicador > Cliente.
  const isClient = leads.some((l) => !l.consent_revoked_at && l.sale_status === "Pagamento confirmado" && l.paid_at);
  const bought = childRows.filter((c) => num(c.client)).length;
  const level: Level = bought > 0 ? "Multiplicador" : childRows.length > 0 ? "Indicador" : isClient ? "Cliente" : null;
  const roleNames = roles.filter((r) => !["Desligado", "Inativo"].includes(str(r.status))).map((r) => str(r.role));
  const badges = [...new Set([...(roleNames.includes("Mentorado") || person.place_link === "Mentorado" ? ["Mentorado"] : []), ...(ambassadorRows[0] ? ["Embaixador"] : []), ...(num(person.leader) ? ["Líder"] : [])])];

  // Local principal: o vínculo sensível nunca aponta a pessoa no local; só a gestão vê o nome, "a revisar".
  const hasPlace = !!person.b_id;
  const sensitive = hasPlace && sensitiveLink({ sector: str(person.b_sector) }, str(person.place_link));
  const place = hasPlace && !sensitive ? { id: str(person.b_id), name: str(person.b_name), type: str(person.b_type), sector: str(person.b_sector), link: str(person.place_link) } : null;
  const placeReview = hasPlace && sensitive && management ? { id: str(person.b_id), name: str(person.b_name), link: str(person.place_link) } : null;
  const onMap: PersonPage["onMap"] = place ? { kind: "local", name: place.name } : person.region_name ? { kind: "bairro", name: str(person.region_name) } : { kind: "cidade" };

  // Quem indicou: a gestão vê o nome; o Comercial só se a pessoa estiver no escopo dele (sem id de quem está fora).
  let referrer: PersonPage["referrer"] = null;
  if (person.referrer_id) {
    const ref = (await all(`SELECT p.id,p.name FROM territory_people p WHERE p.id=? AND ${s.sql}`, [str(person.referrer_id), ...s.args]))[0];
    referrer = ref ? { kind: "pessoa", id: str(ref.id), name: str(ref.name) } : (await all(`SELECT 1 FROM territory_people WHERE id=? AND name NOT LIKE '${ANONYMOUS_LABEL}%'`, [str(person.referrer_id)]))[0] ? { kind: "fora" } : null;
  }

  const mentorRow = mentorRows[0];
  const mentorship = mentorRow ? { done: num(mentorRow.done), total: num(mentorRow.total), nextMeeting: mentorRow.next_meeting_at ? str(mentorRow.next_meeting_at) : null, owner: str(mentorRow.owner_name) || str(mentorRow.portal_owner_email) } : null;
  const amb = ambassadorRows[0];
  const ambassador = amb && management ? { status: str(amb.status), level: str(amb.level), training: num(amb.training_progress), lastUpdate: str(amb.last_update), openTasks: num(amb.open_tasks), doneTasks: num(amb.done_tasks), leads: num(amb.leads), sales: num(amb.sales) } : null;

  // Como abordar: dicas pelo nível e pelo local seguro, e 1 gancho aprovado casado com ela.
  const tips = plantingTips(level, place ? { type: place.type, sector: place.sector } : null);
  const situation = hookSituationFor(level, !!liveLead);
  const hookRow = (await all(`SELECT title,body FROM prospect_hooks WHERE organization_id=? AND status='Aprovado' AND situation=? AND (sector='' OR sector=?) ORDER BY sector=? DESC, updated_at DESC LIMIT 1`, [a.organizationId, situation, place?.sector ?? "", place?.sector ?? ""]))[0];
  const orgName = str((await all("SELECT name FROM organizations WHERE id=?", [a.organizationId]))[0]?.name);
  const hook = hookRow ? { title: str(hookRow.title), text: fillHook(str(hookRow.body), { name: str(person.name), city: str(person.city_name), owner: nameOf.get(owner) || "", organization: orgName }) } : null;

  // Histórico: uma consulta por fonte, com limite; a regra de quem vê o quê fica aqui.
  const events: PersonEvent[] = [];
  const push = (e: PersonEvent) => events.push(e);
  const creator = str(person.created_by).toLowerCase();
  push({ id: "cadastro", kind: "cadastro", date: str(person.created_at), title: management && nameOf.get(creator) ? `Cadastrada no mapa por ${nameOf.get(creator)}` : "Cadastrada no mapa pela equipe" });
  if (brazilDay(str(person.updated_at)) && brazilDay(str(person.updated_at)) !== brazilDay(str(person.created_at))) push({ id: "atualizada", kind: "atualizacao", date: str(person.updated_at), title: "Dados atualizados" });
  for (const r of roles) push({ id: `papel-${str(r.role)}`, kind: "papel", date: str(r.created_at), title: `Papel atual: ${str(r.role)} · ${str(r.status)}` });
  if (amb) push({ id: "papel-embaixador", kind: "papel", date: str(amb.created_at), title: `Papel atual: Embaixador · ${str(amb.status)}` });
  const sensitiveName = sensitive ? str(person.b_name) : "";
  for (const l of leads) {
    const lid = num(l.id);
    push({ id: `autorizacao-${lid}`, kind: "autorizacao", date: str(l.consent_at), title: "Autorizou contato", detail: [str(l.consent_source), str(l.consent_purpose) ? `para ${str(l.consent_purpose)}` : ""].filter(Boolean).join(" · ") });
    if (l.consent_revoked_at) push({ id: `revogacao-${lid}`, kind: "revogacao", date: str(l.consent_revoked_at), title: "Autorização revogada" });
    const label = str(l.source_label);
    const origin = sensitiveName && label.includes(sensitiveName) ? "Mapeamento" : label;
    push({ id: `atendimento-${lid}`, kind: "atendimento", date: str(l.created_at), title: ["Atendimento iniciado", str(l.channel), origin].filter(Boolean).join(" · ") });
    const own = sees(l);
    if (l.sale_created && own) push({ id: `venda-${lid}`, kind: "venda", date: str(l.sale_created), title: "Venda registrada", detail: `R$ ${(num(l.amount_cents) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` });
    if (l.sale_status === "Pagamento confirmado" && l.paid_at) push({ id: `pagamento-${lid}`, kind: "pagamento", date: str(l.paid_at), title: "Pagamento confirmado", ...(own ? { detail: `R$ ${(num(l.amount_cents) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` } : {}) });
  }
  const oppIds = leads.filter((l) => l.o_id && sees(l)).map((l) => str(l.o_id));
  if (oppIds.length) {
    const marks = oppIds.map(() => "?").join(",");
    const [stages, acts, fups] = await Promise.all([
      all(`SELECT id,from_stage,to_stage,created_at FROM opportunity_stage_events WHERE organization_id=? AND opportunity_id IN (${marks}) ORDER BY created_at DESC LIMIT 50`, [a.organizationId, ...oppIds]),
      all(`SELECT id,kind,note,activity_date,created_at FROM commercial_activities WHERE organization_id=? AND opportunity_id IN (${marks}) AND kind IN ('Contato','Follow-up','Reunião','Proposta') ORDER BY created_at DESC LIMIT 50`, [a.organizationId, ...oppIds]),
      all(`SELECT id,action,note,created_at FROM followup_events WHERE organization_id=? AND opportunity_id IN (${marks}) ORDER BY created_at DESC LIMIT 50`, [a.organizationId, ...oppIds]),
    ]);
    for (const e of stages) push({ id: `etapa-${str(e.id)}`, kind: "etapa", date: str(e.created_at), title: str(e.id).startsWith("ini-") ? `Etapa no início do registro: ${str(e.to_stage)}` : `Etapa: ${e.from_stage ? `${str(e.from_stage)} → ` : ""}${str(e.to_stage)}` });
    for (const e of acts) push({ id: `atividade-${str(e.id)}`, kind: "atividade", date: str(e.activity_date) || str(e.created_at), title: str(e.kind), detail: str(e.note) });
    for (const e of fups) push({ id: `acomp-${str(e.id)}`, kind: "acompanhamento", date: str(e.created_at), title: ACTION_LABELS[str(e.action)] ?? "Acompanhamento", detail: str(e.note) });
  }
  for (const c of childRows.slice(0, 50)) push({ id: `indicou-${str(c.id)}`, kind: "indicacao", date: str(c.created_at), title: `Indicou ${str(c.name)}` });
  const [actions, steps, updates, doneTasks, privacy] = await Promise.all([
    all(`SELECT id,name,category,status,due_date,updated_at FROM territory_actions WHERE person_id=? ORDER BY updated_at DESC LIMIT 50`, [id]),
    mentorRow ? all(`SELECT pp.step_id,pp.done_at,st.title FROM portal_progress pp JOIN portal_steps st ON st.id=pp.step_id WHERE pp.user_id=? ORDER BY pp.done_at DESC LIMIT 50`, [num(mentorRow.id)]) : Promise.resolve([]),
    amb && management ? all(`SELECT id,period,created_at FROM ambassador_updates WHERE ambassador_id=? ORDER BY created_at DESC LIMIT 50`, [num(amb.id)]) : Promise.resolve([]),
    amb && management ? all(`SELECT id,title,completed_at FROM tasks WHERE ambassador_id=? AND status='Concluída' AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 50`, [num(amb.id)]) : Promise.resolve([]),
    a.role === "Administrador" ? all(`SELECT id,kind,completed_at FROM privacy_requests WHERE organization_id=? AND (subject_ref=? OR subject_ref IN (${leads.map(() => "?").join(",") || "''"})) ORDER BY completed_at DESC LIMIT 50`, [a.organizationId, `person:${id}`, ...leads.map((l) => `lead:${num(l.id)}`)]) : Promise.resolve([]),
  ]);
  for (const t of actions) push({ id: `acao-${str(t.id)}`, kind: "interacao", date: str(t.status) === "Realizado" ? str(t.due_date) || str(t.updated_at) : str(t.updated_at), title: `${str(t.category)}: ${str(t.name)}`, detail: str(t.status) });
  for (const st of steps) push({ id: `mentoria-${str(st.step_id)}`, kind: "mentoria", date: str(st.done_at), title: `Etapa da mentoria concluída: ${str(st.title)}` });
  for (const u of updates) push({ id: `atualizacao-${str(u.id)}`, kind: "embaixador", date: str(u.created_at), title: `Atualização de embaixador (${str(u.period)})` });
  for (const t of doneTasks) push({ id: `tarefa-${str(t.id)}`, kind: "embaixador", date: str(t.completed_at), title: `Tarefa concluída: ${str(t.title)}` });
  for (const r of privacy) push({ id: `privacidade-${str(r.id)}`, kind: "privacidade", date: str(r.completed_at), title: `Pedido do titular: ${PRIVACY_KIND_LABEL[str(r.kind) as PrivacyKind] ?? str(r.kind)}` });

  const can = {
    startAttendance: a.canManagePipeline && !liveLead && !revoked,
    recordSale: canPerform(a, "record_sale") && visible,
    edit: management || a.role === "Comercial",
    markLeader: management,
    manageMentorship: a.role === "Administrador",
    addAmbassador: management && canPerform(a, "create_ambassador"),
  };
  const next = nextStep({
    revoked: revoked && !liveLead,
    attendance: attendance && !attendance.hidden ? { late: attendance.late, today: attendance.today, fecha: !!attendance.fecha && ["pending", "blocker", "resolved", "link"].includes(attendance.fecha) } : null,
    hasAttendance: !!liveLead,
    attendanceHidden: a.role === "Comercial" && !visible,
    canStartAttendance: can.startAttendance,
    isClient, referredCount: childRows.length,
    mentoradoWithoutMeeting: a.role === "Administrador" && !!mentorship && (!mentorship.nextMeeting || mentorship.nextMeeting.slice(0, 10) < today),
    referredWithoutAttendance: childRows.filter((c) => !num(c.has_lead)).length,
    multiplierWithoutAmbassador: level === "Multiplicador" && !amb,
    canAddAmbassador: can.addAmbassador,
  });

  return {
    id, name: str(person.name), cityId: num(person.city_id), cityName: str(person.city_name), regionName: str(person.region_name),
    level, badges, onMap, place, placeReview,
    consent: lead && (visible || management) ? { at: str(lead.consent_at), source: str(lead.consent_source), purpose: str(lead.consent_purpose), revokedAt: lead.consent_revoked_at ? str(lead.consent_revoked_at) : null } : null,
    attendance,
    referrer,
    referred: { total: childRows.length, bought, withoutAttendance: childRows.filter((c) => !num(c.has_lead)).length, people: childRows.slice(0, 50).map((c) => ({ id: str(c.id), name: str(c.name), client: !!num(c.client) })) },
    mentorship, ambassador, tips, hook,
    timeline: buildPersonTimeline(events, opts.all ? 500 : 30),
    next, can, updatedAt: brazilTimestamp(),
  };
}

/** "Onde buscar": contagens e listas (até 50, só nome e motivo) no escopo de quem vê. */
export const WHERE_LISTS = {
  clientes: "Clientes que ainda não indicaram ninguém",
  indicacoes: "Indicações sem atendimento",
  mapeados: "Pessoas mapeadas sem atendimento há mais de 14 dias",
} as const;
export type WhereList = keyof typeof WHERE_LISTS;

export async function whereToLook(a: AccessView, list?: WhereList | null, cityId?: number | null) {
  const s = personScopeSql(a);
  const extra = cityId && a.role === "Administrador" ? { sql: " AND p.city_id=?", args: [cityId] as Value[] } : { sql: "", args: [] as Value[] };
  const hidden = "NOT EXISTS(SELECT 1 FROM leads lx WHERE lx.person_id=p.id AND lx.consent_revoked_at IS NOT NULL)";
  const cutoff = brazilTimestamp(new Date(Date.now() - 14 * 86_400_000)).slice(0, 10);
  const conditions: Record<WhereList, { sql: string; args: Value[] }> = {
    clientes: { sql: `EXISTS(SELECT 1 FROM leads l JOIN sales sa ON sa.lead_id=l.id WHERE l.person_id=p.id AND l.consent_revoked_at IS NULL AND sa.status='Pagamento confirmado' AND sa.paid_at IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM territory_people ch WHERE ch.referrer_id=p.id)`, args: [] },
    indicacoes: { sql: `p.referrer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM leads l WHERE l.person_id=p.id)`, args: [] },
    mapeados: { sql: `p.source='Mapeamento' AND substr(p.created_at,1,10) < ? AND NOT EXISTS(SELECT 1 FROM leads l WHERE l.person_id=p.id)`, args: [cutoff] },
  };
  const where = (k: WhereList) => ({ sql: `${s.sql}${extra.sql} AND ${hidden} AND ${conditions[k].sql}`, args: [...s.args, ...extra.args, ...conditions[k].args] });
  if (list) {
    const w = where(list);
    const rows = await all(`SELECT p.id,p.name FROM territory_people p WHERE ${w.sql} ORDER BY p.name LIMIT 50`, w.args);
    return { list, title: WHERE_LISTS[list], people: rows.map((r) => ({ id: str(r.id), name: str(r.name), reason: WHERE_LISTS[list] })) };
  }
  const counts = await Promise.all((Object.keys(WHERE_LISTS) as WhereList[]).map(async (k) => { const w = where(k); return [k, num((await all(`SELECT COUNT(*) AS n FROM territory_people p WHERE ${w.sql}`, w.args))[0]?.n)] as const; }));
  return { counts: Object.fromEntries(counts) as Record<WhereList, number> };
}
