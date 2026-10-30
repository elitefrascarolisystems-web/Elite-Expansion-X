import { brazilTimestamp, database } from "@/db/runtime";
import type { AccessView } from "@/lib/expansion-types";
import {
  ANONYMOUS_LABEL, anonymizeSchema, correctionSchema, daysBetween, deadlineOf, PRIVACY_KIND_LABEL, privacyRequestSchema, REMOVED_NOTE,
  type PrivacyDetails, type PrivacyKind, type PrivacyRequestRow, type PrivacySubject,
} from "@/lib/privacy";

export class PrivacyError extends Error { constructor(message: string, public status = 400) { super(message); } }

type Row = Record<string, unknown>;
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
async function rows(sql: string, values: unknown[] = []) { return (await database().prepare(sql).bind(...values).all()).results as Row[]; }

/** Pedidos de titulares são atendidos pelo administrador da empresa (ou pela Assessoria Elite, que entra como administrador). */
function allowed(a: AccessView) {
  if (!a.active || a.role !== "Administrador") throw new PrivacyError("Somente o administrador atende pedidos de titulares (LGPD).", 403);
}

/** Busca por nome, e-mail ou WhatsApp em quem está no mapa, nos contatos e entre os embaixadores. */
export async function searchSubjects(a: AccessView, query: string): Promise<PrivacySubject[]> {
  allowed(a);
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  // Sem 4 dígitos na busca, o telefone não entra (LIKE NULL nunca casa).
  const like = `%${q}%`, digits = q.replace(/\D/g, ""), phone = digits.length >= 4 ? `%${digits}%` : null;
  const contact = (alias: string) => `(${alias}.name LIKE ? OR ${alias}.email LIKE ? OR ${alias}.normalized_whatsapp LIKE ?)`;
  const people = await rows(`SELECT p.id,p.name,c.name AS city,b.name AS place,
      (SELECT id FROM leads WHERE person_id=p.id) AS lead_id,(SELECT id FROM ambassadors WHERE person_id=p.id) AS ambassador_id
    FROM territory_people p JOIN cities c ON c.id=p.city_id LEFT JOIN businesses b ON b.id=p.place_id
    WHERE c.organization_id=? AND (p.name LIKE ? OR EXISTS(SELECT 1 FROM leads l WHERE l.person_id=p.id AND ${contact("l")})
      OR EXISTS(SELECT 1 FROM ambassadors m WHERE m.person_id=p.id AND (m.name LIKE ? OR m.email LIKE ? OR replace(replace(replace(replace(m.whatsapp,' ',''),'-',''),'(',''),')','') LIKE ?)))
    ORDER BY p.name LIMIT 20`, [a.organizationId, like, like, like, phone, like, like, phone]);
  const leads = await rows(`SELECT l.id,l.name,c.name AS city FROM leads l JOIN cities c ON c.id=l.city_id
    WHERE c.organization_id=? AND l.person_id IS NULL AND ${contact("l")} ORDER BY l.name LIMIT 20`, [a.organizationId, like, like, phone]);
  const ambassadors = await rows(`SELECT m.id,m.name,c.name AS city FROM ambassadors m JOIN cities c ON c.id=m.city_id
    WHERE c.organization_id=? AND m.person_id IS NULL AND (m.name LIKE ? OR m.email LIKE ? OR replace(replace(replace(replace(m.whatsapp,' ',''),'-',''),'(',''),')','') LIKE ?)
    ORDER BY m.name LIMIT 20`, [a.organizationId, like, like, phone]);
  const anonymized = (name: unknown) => str(name).startsWith(ANONYMOUS_LABEL);
  return [
    ...people.map((r) => ({ ref: `person:${r.id}`, name: str(r.name), city: str(r.city), place: str(r.place), anonymized: anonymized(r.name),
      sources: ["Mapa", ...(r.lead_id ? ["Contato"] : []), ...(r.ambassador_id ? ["Embaixador"] : [])] })),
    ...leads.map((r) => ({ ref: `lead:${r.id}`, name: str(r.name), city: str(r.city), place: "", anonymized: anonymized(r.name), sources: ["Contato"] })),
    ...ambassadors.map((r) => ({ ref: `ambassador:${r.id}`, name: str(r.name), city: str(r.city), place: "", anonymized: anonymized(r.name), sources: ["Embaixador"] })),
  ].slice(0, 30);
}

type Subject = { ref: string; refs: string[]; person: Row | null; lead: Row | null; ambassador: Row | null; city: string };

/**
 * Junta tudo o que é do mesmo titular nesta empresa: a pessoa do mapa, o contato
 * (lead) e o cadastro de embaixador ligados a ela. A referência principal é a do
 * mapa quando existe; os pedidos ficam registrados nela.
 */
async function resolve(a: AccessView, ref: string): Promise<Subject> {
  const [kind, id] = ref.split(":");
  const org = a.organizationId;
  const personById = async (personId: unknown) => personId ? (await rows("SELECT p.*,c.name AS city_name,b.name AS place_name,rg.name AS region_name,(SELECT COUNT(*) FROM territory_people ch WHERE ch.referrer_id=p.id) AS referred_count FROM territory_people p JOIN cities c ON c.id=p.city_id LEFT JOIN businesses b ON b.id=p.place_id LEFT JOIN territory_regions rg ON rg.id=p.region_id WHERE p.id=? AND c.organization_id=?", [personId, org]))[0] ?? null : null;
  let person: Row | null = null, lead: Row | null = null, ambassador: Row | null = null;
  if (kind === "person") person = await personById(id);
  if (kind === "lead") lead = (await rows("SELECT l.*,c.name AS city_name FROM leads l JOIN cities c ON c.id=l.city_id WHERE l.id=? AND c.organization_id=?", [Number(id), org]))[0] ?? null;
  if (kind === "ambassador") ambassador = (await rows("SELECT m.*,c.name AS city_name FROM ambassadors m JOIN cities c ON c.id=m.city_id WHERE m.id=? AND c.organization_id=?", [Number(id), org]))[0] ?? null;
  if (!person && !lead && !ambassador) throw new PrivacyError("Titular não encontrado nesta empresa. Busque de novo.", 404);
  if (!person) person = await personById(lead?.person_id ?? ambassador?.person_id);
  if (person) {
    lead ??= (await rows("SELECT l.*,c.name AS city_name FROM leads l JOIN cities c ON c.id=l.city_id WHERE l.person_id=? AND c.organization_id=?", [person.id, org]))[0] ?? null;
    ambassador ??= (await rows("SELECT m.*,c.name AS city_name FROM ambassadors m JOIN cities c ON c.id=m.city_id WHERE m.person_id=? AND c.organization_id=?", [person.id, org]))[0] ?? null;
  }
  const refs = [person && `person:${person.id}`, lead && `lead:${lead.id}`, ambassador && `ambassador:${ambassador.id}`].filter(Boolean) as string[];
  return { ref: refs[0], refs, person, lead, ambassador, city: str(person?.city_name ?? lead?.city_name ?? ambassador?.city_name) };
}

const nameOf = (s: Subject) => str(s.person?.name ?? s.lead?.name ?? s.ambassador?.name);
const inList = (values: unknown[]) => values.map(() => "?").join(",") || "NULL";

async function related(a: AccessView, s: Subject) {
  const opportunities = s.lead ? await rows("SELECT * FROM opportunities WHERE lead_id=? AND organization_id=?", [s.lead.id, a.organizationId]) : [];
  const oppIds = opportunities.map((o) => o.id);
  return {
    opportunities,
    roles: s.person ? await rows("SELECT role,status,responsible,source,created_at FROM territory_roles WHERE person_id=? ORDER BY created_at", [s.person.id]) : [],
    actions: s.person ? await rows("SELECT name,category,status,responsible,due_date FROM territory_actions WHERE person_id=? ORDER BY due_date", [s.person.id]) : [],
    activities: oppIds.length ? await rows(`SELECT kind,note,activity_date,owner_email FROM commercial_activities WHERE organization_id=? AND opportunity_id IN (${inList(oppIds)}) ORDER BY activity_date`, [a.organizationId, ...oppIds]) : [],
    history: oppIds.length ? await rows(`SELECT action,note,created_at,actor_email FROM followup_events WHERE organization_id=? AND opportunity_id IN (${inList(oppIds)}) ORDER BY created_at`, [a.organizationId, ...oppIds]) : [],
    sale: s.lead ? (await rows("SELECT product,amount_cents,status,paid_at FROM sales WHERE lead_id=?", [s.lead.id]))[0] ?? null : null,
    updates: s.ambassador ? await rows("SELECT period,leads,sales,note,created_at FROM ambassador_updates WHERE ambassador_id=? ORDER BY period", [s.ambassador.id]) : [],
    access: await rows(`SELECT email,role,active FROM app_users WHERE organization_id=? AND (${[s.person ? "person_id=?" : "", s.ambassador ? "ambassador_id=?" : "", s.lead && str(s.lead.email) ? "lower(email)=lower(?)" : ""].filter(Boolean).join(" OR ") || "0"})`,
      [a.organizationId, ...(s.person ? [s.person.id] : []), ...(s.ambassador ? [s.ambassador.id] : []), ...(s.lead && str(s.lead.email) ? [s.lead.email] : [])]),
  };
}

export async function subjectDetails(a: AccessView, ref: string): Promise<PrivacyDetails> {
  allowed(a);
  const s = await resolve(a, ref), r = await related(a, s);
  const name = nameOf(s);
  return {
    ref: s.ref, name, city: s.city, place: str(s.person?.place_name), anonymized: name.startsWith(ANONYMOUS_LABEL),
    sources: [...(s.person ? ["Mapa"] : []), ...(s.lead ? ["Contato"] : []), ...(s.ambassador ? ["Embaixador"] : [])],
    email: str(s.lead?.email || s.ambassador?.email), whatsapp: str(s.lead?.whatsapp || s.ambassador?.whatsapp),
    consent: !s.lead ? "sem contato" : s.lead.consent_revoked_at ? "revogada" : "vigente",
    counts: { roles: r.roles.length, actions: r.actions.length, activities: r.activities.length, history: r.history.length, sale: Boolean(r.sale), updates: r.updates.length },
    platformAccess: r.access.map((u) => `${str(u.email)} (${str(u.role)}${Number(u.active) ? "" : ", inativo"})`),
  };
}

function record(a: AccessView, kind: PrivacyKind, s: Subject, label: string, v: { channel: string; receivedAt: string; note: string }, now: string) {
  if (v.receivedAt > now.slice(0, 10)) throw new PrivacyError("A data do pedido não pode ser no futuro.");
  return [
    database().prepare("INSERT INTO privacy_requests(id,organization_id,kind,subject_ref,subject_label,channel,received_at,completed_at,note,actor_email) VALUES(?,?,?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), a.organizationId, kind, s.ref, label, v.channel, v.receivedAt, now, v.note, a.email),
    database().prepare("INSERT INTO audit_logs(organization_id,actor_email,action,entity_type,summary,created_at) VALUES(?,?,?,?,?,?)")
      .bind(a.organizationId, a.email, `privacy_${kind}`, "privacy", `Pedido do titular atendido: ${PRIVACY_KIND_LABEL[kind]}.`, now),
  ];
}

/** Cópia completa dos dados do titular, em formato estruturado (art. 18, II e V). */
export async function exportSubject(a: AccessView, input: unknown) {
  allowed(a);
  const v = privacyRequestSchema.parse(input), s = await resolve(a, v.subject), r = await related(a, s), now = brazilTimestamp();
  const p = s.person, l = s.lead, m = s.ambassador;
  const data = {
    geradoEm: now, empresa: a.organizationName,
    observacao: "Dados pessoais tratados por esta empresa na plataforma Elite Expansion X. Endereço residencial nunca é registrado: a pessoa aparece no local ligado a ela, no centro do bairro ou no centro da cidade.",
    titular: { nome: nameOf(s), cidade: s.city },
    mapa: p ? {
      nome: str(p.name), cidade: str(p.city_name), bairro: str(p.region_name) || null, local: str(p.place_name) || null, vinculo: str(p.place_link) || null,
      exibidoNoMapa: p.place_id ? "No local ligado à pessoa" : p.region_id ? "No centro do bairro" : "No centro da cidade", lider: Boolean(Number(p.leader)),
      // Rede: só se a pessoa foi indicada e quantas indicou; nomes de outras pessoas não entram na cópia.
      rede: { foiIndicada: Boolean(p.referrer_id), pessoasIndicadas: Number(p.referred_count ?? 0) },
      cadastradoPor: str(p.created_by), cadastradoEm: str(p.created_at), atualizadoEm: str(p.updated_at),
      papeis: r.roles.map((x) => ({ papel: str(x.role), status: str(x.status), responsavel: str(x.responsible), origem: str(x.source), desde: str(x.created_at) })),
      acoes: r.actions.map((x) => ({ acao: str(x.name), categoria: str(x.category), status: str(x.status), responsavel: str(x.responsible), prazo: str(x.due_date) })),
    } : null,
    contato: l ? {
      nome: str(l.name), email: str(l.email) || null, whatsapp: str(l.whatsapp) || null, canal: str(l.channel), origem: str(l.source_label) || null,
      campanha: str(l.campaign) || null, status: str(l.status), responsavel: str(l.assigned_to_email) || null, cadastradoEm: str(l.created_at),
      autorizacao: { em: str(l.consent_at), fonte: str(l.consent_source), finalidade: str(l.consent_purpose), revogadaEm: str(l.consent_revoked_at) || null, motivoDaRevogacao: str(l.consent_revocation_reason) || null },
    } : null,
    atendimento: r.opportunities.map((o) => ({
      etapa: str(o.stage), temperatura: str(o.temperature), proximoPasso: str(o.next_action) || null, data: str(o.due_date) || null, motivoDaPerda: str(o.lost_reason) || null, responsavel: str(o.owner_email),
      atividades: r.activities.map((x) => ({ tipo: str(x.kind), nota: str(x.note), data: str(x.activity_date), por: str(x.owner_email) })),
      historico: r.history.map((x) => ({ acao: str(x.action), nota: str(x.note), em: str(x.created_at), por: str(x.actor_email) })),
    }))[0] ?? null,
    venda: r.sale ? { produto: str(r.sale.product), valor: Number(r.sale.amount_cents) / 100, status: str(r.sale.status), pagoEm: str(r.sale.paid_at) || null } : null,
    embaixador: m ? {
      nome: str(m.name), codigo: str(m.code), email: str(m.email) || null, whatsapp: str(m.whatsapp) || null, whatsappAutorizadoEm: str(m.whatsapp_authorized_at) || null,
      nivel: str(m.level), status: str(m.status), termosAceitosEm: str(m.terms_accepted_at) || null, cadastradoEm: str(m.created_at),
      atualizacoes: r.updates.map((x) => ({ periodo: str(x.period), leads: Number(x.leads), vendas: Number(x.sales), nota: str(x.note) || null })),
    } : null,
    acessoAPlataforma: r.access.map((u) => ({ email: str(u.email), funcao: str(u.role), ativo: Boolean(Number(u.active)) })),
    pedidosAnteriores: (await rows(`SELECT kind,received_at,completed_at FROM privacy_requests WHERE organization_id=? AND subject_ref IN (${inList(s.refs)}) ORDER BY completed_at`, [a.organizationId, ...s.refs]))
      .map((x) => ({ pedido: PRIVACY_KIND_LABEL[str(x.kind) as PrivacyKind] ?? str(x.kind), recebidoEm: str(x.received_at), atendidoEm: str(x.completed_at) })),
  };
  await database().batch(record(a, "acesso", s, nameOf(s), v, now));
  return { data, fileName: `dados-titular-${now.slice(0, 10)}.json` };
}

/** Correção de nome, e-mail e WhatsApp em todos os cadastros do titular (art. 18, III). */
export async function correctSubject(a: AccessView, input: unknown) {
  allowed(a);
  const v = correctionSchema.parse(input), s = await resolve(a, v.subject), now = brazilTimestamp(), db = database();
  if (nameOf(s).startsWith(ANONYMOUS_LABEL)) throw new PrivacyError("Este titular já foi anonimizado; não há dados pessoais para corrigir.");
  const email = v.email?.trim() ?? null, whatsapp = v.whatsapp?.trim() ?? null;
  const statements = [];
  if (s.person) statements.push(db.prepare("UPDATE territory_people SET name=?,updated_at=? WHERE id=?").bind(v.name, now, s.person.id));
  if (s.lead) statements.push(db.prepare("UPDATE leads SET name=?,email=COALESCE(?,email),normalized_email=CASE WHEN ? IS NULL THEN normalized_email ELSE NULLIF(lower(?),'') END,whatsapp=COALESCE(?,whatsapp),normalized_whatsapp=CASE WHEN ? IS NULL THEN normalized_whatsapp ELSE NULLIF(?,'') END,updated_at=? WHERE id=?")
    .bind(v.name, email, email, email ?? "", whatsapp, whatsapp, (whatsapp ?? "").replace(/\D/g, ""), now, s.lead.id));
  if (s.ambassador) statements.push(db.prepare("UPDATE ambassadors SET name=?,email=COALESCE(?,email),whatsapp=COALESCE(?,whatsapp),updated_at=? WHERE id=?").bind(v.name, email, whatsapp, now, s.ambassador.id));
  await db.batch([...statements, ...record(a, "correcao", s, v.name, v, now)]);
  return { ok: true };
}

/** O titular retira a autorização de contato (art. 18, IX): o atendimento é encerrado e sai da agenda. */
export async function revokeSubject(a: AccessView, input: unknown) {
  allowed(a);
  const v = privacyRequestSchema.parse(input), s = await resolve(a, v.subject), now = brazilTimestamp(), db = database();
  if (!s.lead && !s.ambassador?.whatsapp_authorized_at) throw new PrivacyError("Este titular não tem autorização de contato registrada.");
  const statements = [];
  if (s.lead) statements.push(db.prepare("UPDATE leads SET status='Cancelado',consent_revoked_at=COALESCE(consent_revoked_at,?),consent_revocation_reason=CASE WHEN consent_revoked_at IS NULL THEN 'Pedido do titular (LGPD)' ELSE consent_revocation_reason END,updated_at=? WHERE id=?").bind(now, now, s.lead.id));
  if (s.ambassador) statements.push(db.prepare("UPDATE ambassadors SET whatsapp_authorized_at=NULL,updated_at=? WHERE id=?").bind(now, s.ambassador.id));
  await db.batch([...statements, ...record(a, "revogacao", s, nameOf(s), v, now)]);
  return { ok: true };
}

/**
 * Exclusão por anonimização (art. 16 e 18, IV e VI): some tudo o que identifica a
 * pessoa — nome, contatos, vínculo com o local, papéis, ponto no mapa e anotações —
 * e ficam só números sem identificação (venda e valores, exigidos para a contabilidade).
 * Não pode ser desfeita.
 */
export async function anonymizeSubject(a: AccessView, input: unknown) {
  allowed(a);
  const v = anonymizeSchema.parse(input), s = await resolve(a, v.subject), now = brazilTimestamp(), db = database();
  if (nameOf(s).startsWith(ANONYMOUS_LABEL)) throw new PrivacyError("Este titular já foi anonimizado.");
  const label = `${ANONYMOUS_LABEL} ${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const r = await related(a, s), oppIds = r.opportunities.map((o) => o.id);
  const statements = [];
  if (s.person) {
    const id = s.person.id;
    statements.push(
      db.prepare("UPDATE territory_people SET name=?,place_id=NULL,place_link='',region_id=NULL,referrer_id=NULL,leader=0,updated_at=? WHERE id=?").bind(label, now, id),
      db.prepare("DELETE FROM territory_roles WHERE person_id=?").bind(id),
      db.prepare("DELETE FROM territory_locations WHERE entity_key=?").bind(`person:${id}`),
      db.prepare("UPDATE territory_actions SET name=?,updated_at=? WHERE person_id=?").bind(REMOVED_NOTE, now, id),
    );
  }
  if (s.lead) {
    statements.push(
      db.prepare("UPDATE leads SET name=?,email='',whatsapp='',normalized_email=NULL,normalized_whatsapp=NULL,source_label='',status='Cancelado',consent_revoked_at=COALESCE(consent_revoked_at,?),consent_revocation_reason='Pedido do titular (LGPD): dados anonimizados',updated_at=? WHERE id=?").bind(label, now, now, s.lead.id),
      db.prepare("UPDATE opportunities SET next_action='',followup_json='{}',lost_reason=CASE WHEN lost_reason<>'' THEN 'Motivo removido (LGPD)' ELSE '' END,updated_at=? WHERE lead_id=? AND organization_id=?").bind(now, s.lead.id, a.organizationId),
      db.prepare("UPDATE audit_logs SET summary='Dados do titular anonimizados.' WHERE organization_id=? AND entity_type='lead' AND entity_id=?").bind(a.organizationId, s.lead.id),
    );
    if (oppIds.length) statements.push(
      db.prepare(`UPDATE commercial_activities SET note=? WHERE organization_id=? AND opportunity_id IN (${inList(oppIds)})`).bind(REMOVED_NOTE, a.organizationId, ...oppIds),
      db.prepare(`UPDATE followup_events SET note=?,request_json='{}',before_json='{}',after_json='{}' WHERE organization_id=? AND opportunity_id IN (${inList(oppIds)})`).bind(REMOVED_NOTE, a.organizationId, ...oppIds),
    );
  }
  if (s.ambassador) statements.push(
    db.prepare("UPDATE ambassadors SET name=?,email='',whatsapp='',whatsapp_authorized_at=NULL,pause_reason='',status='Desligado',updated_at=? WHERE id=?").bind(label, now, s.ambassador.id),
    db.prepare("UPDATE ambassador_updates SET note='' WHERE ambassador_id=?").bind(s.ambassador.id),
    db.prepare("UPDATE audit_logs SET summary='Dados do titular anonimizados.' WHERE organization_id=? AND entity_type='ambassador' AND entity_id=?").bind(a.organizationId, s.ambassador.id),
  );
  // Pedidos anteriores do mesmo titular passam a mostrar só o rótulo anônimo (e perdem as observações).
  statements.push(db.prepare(`UPDATE privacy_requests SET subject_label=?,note='' WHERE organization_id=? AND subject_ref IN (${inList(s.refs)})`).bind(label, a.organizationId, ...s.refs));
  await db.batch([...statements, ...record(a, "anonimizacao", s, label, v, now)]);
  return { label, platformAccess: r.access.map((u) => str(u.email)) };
}

export async function listRequests(a: AccessView): Promise<PrivacyRequestRow[]> {
  allowed(a);
  return (await rows("SELECT * FROM privacy_requests WHERE organization_id=? ORDER BY completed_at DESC LIMIT 200", [a.organizationId])).map((r) => {
    const receivedAt = str(r.received_at), completedAt = str(r.completed_at), deadline = deadlineOf(receivedAt);
    return {
      id: str(r.id), kind: str(r.kind) as PrivacyKind, subjectLabel: str(r.subject_label), channel: str(r.channel), receivedAt, completedAt,
      note: str(r.note), actorEmail: str(r.actor_email), deadline, days: daysBetween(receivedAt, completedAt), onTime: completedAt.slice(0, 10) <= deadline,
    };
  });
}
