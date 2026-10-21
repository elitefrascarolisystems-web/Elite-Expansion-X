import { audit, brazilTimestamp, database } from "@/db/runtime";
import { canPerform } from "@/lib/expansion-permissions";
import { isPortalRole, type AccessView } from "@/lib/expansion-types";
import { PORTAL_AUDIENCE, MAX_REFERRALS_PER_DAY, memberSchema, referSchema, stepSchema, stepToggleSchema, type PortalAdminData, type PortalData } from "@/lib/portal";

type Value = string | number | null;
const rows = async (sql: string, args: Value[] = []) => (await database().prepare(sql).bind(...args).all()).results;
const first = async (sql: string, args: Value[] = []) => (await rows(sql, args))[0];
const str = (v: unknown) => String(v ?? "");

export class PortalError extends Error { constructor(message: string, public status = 400) { super(message); } }

function member(access: AccessView) {
  if (!access.active || !isPortalRole(access.role) || access.isAdvisory) throw new PortalError("Área exclusiva de mentorados.", 403);
  return access;
}
function admin(access: AccessView) {
  if (!canPerform(access, "create_user")) throw new PortalError("Somente administradores gerenciam o portal.", 403);
  return access;
}
const spDay = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());

/* ---------- Portal do membro ---------- */

/** Tudo o que o mentorado vê: só os próprios dados, nada da operação da equipe. */
export async function getPortalData(access: AccessView): Promise<PortalData> {
  const a = member(access);
  const audience = PORTAL_AUDIENCE;
  const user = await first(`SELECT u.name,u.email,u.role,u.title,u.mentorship_cycle,u.welcomed_at,u.person_id,u.business_id,u.portal_owner_email,u.next_meeting_at,u.next_meeting_note,u.city_id,COALESCE(c.name,'') AS city_name,o.name AS organization_name
    FROM app_users u JOIN organizations o ON o.id=u.organization_id LEFT JOIN cities c ON c.id=u.city_id WHERE u.id=? AND u.organization_id=?`, [a.id, a.organizationId]);
  if (!user) throw new PortalError("Perfil não encontrado.", 404);
  const ownerEmail = str(user.portal_owner_email);
  const [owner, place, steps, materials, referrals, cities] = await Promise.all([
    ownerEmail ? first("SELECT name,email,title FROM app_users WHERE organization_id=? AND lower(email)=lower(?) AND active=1", [a.organizationId, ownerEmail]) : Promise.resolve(undefined),
    user.person_id ? first("SELECT b.name,p.place_link FROM territory_people p JOIN businesses b ON b.id=p.place_id WHERE p.id=? AND b.organization_id=?", [str(user.person_id), a.organizationId]) : Promise.resolve(undefined),
    rows(`SELECT s.id,s.title,s.description,pp.done_at FROM portal_steps s LEFT JOIN portal_progress pp ON pp.step_id=s.id AND pp.user_id=?
      WHERE s.organization_id=? AND s.audience=? ORDER BY s.position,s.id`, [a.id, a.organizationId, audience]),
    rows(`SELECT id,title,type,url,instructions FROM contents WHERE organization_id=? AND status='Aprovado' AND audience IN (?,'Todos')
      AND (city_id IS NULL OR city_id=?) AND (expires_at IS NULL OR expires_at='' OR expires_at>=?) ORDER BY created_at DESC LIMIT 50`, [a.organizationId, audience, user.city_id === null || user.city_id === undefined ? null : Number(user.city_id), spDay()]),
    // Só quem esta pessoa indicou, com uma situação simples: sem dados de atendimento.
    rows(`SELECT l.name,l.created_at,EXISTS(SELECT 1 FROM sales s WHERE s.lead_id=l.id AND s.status='Pagamento confirmado') AS paid,
      EXISTS(SELECT 1 FROM opportunities o WHERE o.lead_id=l.id AND o.stage NOT IN ('Novo')) AS talking
      FROM leads l JOIN cities c ON c.id=l.city_id WHERE c.organization_id=? AND lower(l.created_by)=lower(?) AND l.channel='Indicação' ORDER BY l.created_at DESC LIMIT 100`, [a.organizationId, a.email]),
    rows("SELECT id,name FROM cities WHERE organization_id=? ORDER BY name", [a.organizationId]),
  ]);
  const meetingAt = user.next_meeting_at ? str(user.next_meeting_at) : "";
  return {
    member: { name: str(user.name) || a.email, email: str(user.email), role: "Mentorado", title: str(user.title), mentorshipCycle: Number(user.mentorship_cycle ?? 0), cityName: str(user.city_name), welcomed: Boolean(user.welcomed_at), organizationName: str(user.organization_name) },
    owner: owner ? { name: str(owner.name) || str(owner.email), email: str(owner.email), title: str(owner.title) } : null,
    nextMeeting: meetingAt ? { at: meetingAt, note: str(user.next_meeting_note) } : null,
    place: place ? { name: str(place.name), link: str(place.place_link) } : null,
    steps: steps.map((s) => ({ id: Number(s.id), title: str(s.title), description: str(s.description), doneAt: s.done_at ? str(s.done_at) : null })),
    materials: materials.map((m) => ({ id: Number(m.id), title: str(m.title), type: str(m.type), url: str(m.url), instructions: str(m.instructions) })),
    referrals: referrals.map((r) => ({ name: str(r.name), createdAt: str(r.created_at), status: Number(r.paid) ? "Virou cliente" : Number(r.talking) ? "Em conversa" : "Recebida" })),
    cities: cities.map((c) => ({ id: Number(c.id), name: str(c.name) })),
  };
}

/** Ações do próprio membro: marcar etapa, indicar alguém, fechar as boas-vindas. */
export async function portalAction(access: AccessView, action: string, input: unknown) {
  const a = member(access);
  const db = database(), now = brazilTimestamp();
  if (action === "welcome") {
    await db.prepare("UPDATE app_users SET welcomed_at=? WHERE id=? AND welcomed_at IS NULL").bind(now, a.id).run();
    return {};
  }
  if (action === "step") {
    const v = stepToggleSchema.parse(input);
    const step = await first("SELECT id FROM portal_steps WHERE id=? AND organization_id=? AND audience=?", [v.stepId, a.organizationId, PORTAL_AUDIENCE]);
    if (!step) throw new PortalError("Etapa não encontrada.", 404);
    await (v.done
      ? db.prepare("INSERT OR IGNORE INTO portal_progress(user_id,step_id,done_at) VALUES(?,?,?)").bind(a.id, v.stepId, now)
      : db.prepare("DELETE FROM portal_progress WHERE user_id=? AND step_id=?").bind(a.id, v.stepId)).run();
    return {};
  }
  if (action === "refer") {
    const v = referSchema.parse(input);
    const city = await first("SELECT id FROM cities WHERE id=? AND organization_id=?", [v.cityId, a.organizationId]);
    if (!city) throw new PortalError("Cidade não encontrada.", 404);
    const today = await first("SELECT COUNT(*) AS n FROM leads WHERE lower(created_by)=lower(?) AND channel='Indicação' AND substr(created_at,1,10)=?", [a.email, now.slice(0, 10)]);
    if (Number(today?.n ?? 0) >= MAX_REFERRALS_PER_DAY) throw new PortalError(`Limite de ${MAX_REFERRALS_PER_DAY} indicações por dia. Continue amanhã.`, 429);
    const normalizedEmail = v.email || null, normalizedWhatsapp = v.whatsapp.replace(/\D/g, "") || null;
    const conditions = [normalizedEmail && "normalized_email=?", normalizedWhatsapp && "normalized_whatsapp=?"].filter(Boolean).join(" OR ");
    const duplicate = await first(`SELECT id FROM leads WHERE city_id IN (SELECT id FROM cities WHERE organization_id=?) AND status<>'Cancelado' AND (${conditions}) LIMIT 1`, [a.organizationId, ...[normalizedEmail, normalizedWhatsapp].filter((x): x is string => Boolean(x))]);
    if (duplicate) throw new PortalError(`Essa pessoa já está em contato com a ${a.organizationName}. Obrigado pela indicação!`, 409);
    const user = await first("SELECT name,person_id,portal_owner_email FROM app_users WHERE id=?", [a.id]);
    // Quem indicou fica registrado na rede de indicações quando a pessoa dele está na mesma cidade.
    const referrer = user?.person_id ? await first("SELECT id FROM territory_people WHERE id=? AND city_id=?", [str(user.person_id), v.cityId]) : null;
    const ownerEmail = str(user?.portal_owner_email).toLowerCase();
    const owner = ownerEmail ? await first(`SELECT email FROM app_users WHERE organization_id=? AND lower(email)=? AND active=1 AND role IN ('Administrador','Coordenação','Líder','Comercial')
      AND (city_id=? OR (city_id IS NULL AND role IN ('Administrador','Comercial')))`, [a.organizationId, ownerEmail, v.cityId]) : null;
    const personId = crypto.randomUUID(), firstName = str(user?.name).split(" ")[0] || "membro";
    const statements = [
      db.prepare("INSERT INTO territory_people(id,city_id,name,referrer_id,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(personId, v.cityId, v.name, referrer ? str(referrer.id) : null, a.email, now, now),
      db.prepare(`INSERT INTO leads(person_id,city_id,name,email,whatsapp,normalized_email,normalized_whatsapp,status,channel,source_label,campaign,utm_source,utm_medium,utm_campaign,consent_at,consent_source,consent_purpose,assigned_to_email,updated_at,created_by,created_at)
        VALUES(?,?,?,?,?,?,?,'Lead informado','Indicação',?,'','','','',?,?,?,?,?,?,?)`).bind(personId, v.cityId, v.name, v.email, v.whatsapp, normalizedEmail, normalizedWhatsapp,
        `Indicação de ${str(user?.name) || a.email} (mentorado)`, now,
        `Indicação pelo portal; ${firstName} confirmou a autorização de contato`, `Contato da ${a.organizationName}`, owner ? str(owner.email).toLowerCase() : "", now, a.email, now),
    ];
    await db.batch(statements);
    const lead = await first("SELECT id FROM leads WHERE person_id=?", [personId]);
    if (owner && lead) {
      // Cai direto na agenda de quem acompanha o membro: primeiro contato para hoje.
      const opportunityId = crypto.randomUUID();
      await db.batch([
        db.prepare("INSERT INTO opportunities(id,organization_id,city_id,lead_id,owner_email,temperature,stage,next_action,due_date,created_by,created_at,updated_at) VALUES(?,?,?,?,?,'Morno','Novo',?,?,?,?,?)")
          .bind(opportunityId, a.organizationId, v.cityId, Number(lead.id), str(owner.email).toLowerCase(), `Contatar indicação de ${firstName}${v.note ? `: ${v.note}` : ""}`.slice(0, 500), spDay(), a.email, now, now),
        db.prepare("INSERT INTO commercial_activities(id,organization_id,city_id,opportunity_id,owner_email,kind,note,activity_date,created_at) VALUES(?,?,?,?,?,'Etapa',?,?,?)")
          .bind(crypto.randomUUID(), a.organizationId, v.cityId, opportunityId, str(owner.email).toLowerCase(), `Indicação recebida pelo portal (${firstName})`, now.slice(0, 10), now),
      ]);
    }
    await audit(db, a.organizationId, a.email, "portal_referral", "lead", Number(lead?.id ?? 0), `Indicação recebida pelo portal: ${v.name}.`);
    return { ok: true };
  }
  throw new PortalError("Esta ação não está disponível. Atualize a página e tente de novo.");
}

/* ---------- Gestão do portal (administrador) ---------- */

export async function getPortalAdmin(access: AccessView): Promise<PortalAdminData> {
  const a = admin(access);
  const [steps, members] = await Promise.all([
    rows("SELECT id,audience,title,description,position FROM portal_steps WHERE organization_id=? ORDER BY audience,position,id", [a.organizationId]),
    rows(`SELECT u.id,u.name,u.email,u.role,u.city_id,COALESCE(c.name,'') AS city_name,u.person_id,COALESCE(p.name,'') AS person_name,
        u.portal_owner_email,u.next_meeting_at,u.next_meeting_note,
        (SELECT COUNT(*) FROM portal_progress pp JOIN portal_steps s ON s.id=pp.step_id WHERE pp.user_id=u.id) AS done,
        (SELECT COUNT(*) FROM portal_steps s WHERE s.organization_id=u.organization_id AND s.audience='Mentorados') AS total,
        (SELECT COUNT(*) FROM leads l WHERE lower(l.created_by)=lower(u.email) AND l.channel='Indicação') AS referrals,
        EXISTS(SELECT 1 FROM user_credentials cr WHERE cr.email=lower(u.email)) AS has_password
      FROM app_users u LEFT JOIN cities c ON c.id=u.city_id LEFT JOIN territory_people p ON p.id=u.person_id
      WHERE u.organization_id=? AND u.role='Mentorado' AND u.active=1 ORDER BY u.name`, [a.organizationId]),
  ]);
  return {
    steps: steps.map((s) => ({ id: Number(s.id), audience: str(s.audience), title: str(s.title), description: str(s.description), position: Number(s.position) })),
    members: members.map((m) => ({ userId: Number(m.id), name: str(m.name), email: str(m.email), role: str(m.role), cityId: m.city_id === null ? null : Number(m.city_id), cityName: str(m.city_name), personId: m.person_id ? str(m.person_id) : null, personName: str(m.person_name), ownerEmail: str(m.portal_owner_email), nextMeetingAt: m.next_meeting_at ? str(m.next_meeting_at) : null, nextMeetingNote: str(m.next_meeting_note), done: Number(m.done), total: Number(m.total), referrals: Number(m.referrals), hasPassword: Number(m.has_password) === 1 })),
  };
}

export async function portalAdminAction(access: AccessView, action: string, input: unknown) {
  const a = admin(access);
  const db = database(), now = brazilTimestamp();
  if (action === "save_step") {
    const v = stepSchema.parse(input);
    if (v.id) {
      const result = await db.prepare("UPDATE portal_steps SET title=?,description=? WHERE id=? AND organization_id=?").bind(v.title, v.description, v.id, a.organizationId).run();
      if (!result.meta.changes) throw new PortalError("Etapa não encontrada.", 404);
    } else {
      const last = await first("SELECT COALESCE(MAX(position),0) AS p FROM portal_steps WHERE organization_id=? AND audience=?", [a.organizationId, v.audience]);
      await db.prepare("INSERT INTO portal_steps(organization_id,audience,title,description,position,created_by,created_at) VALUES(?,?,?,?,?,?,?)").bind(a.organizationId, v.audience, v.title, v.description, Number(last?.p ?? 0) + 1, a.email, now).run();
    }
    return {};
  }
  if (action === "delete_step" || action === "move_step") {
    const v = input as { id?: unknown; direction?: unknown };
    const step = await first("SELECT id,audience,position FROM portal_steps WHERE id=? AND organization_id=?", [Number(v.id), a.organizationId]);
    if (!step) throw new PortalError("Etapa não encontrada.", 404);
    if (action === "delete_step") { await db.prepare("DELETE FROM portal_steps WHERE id=?").bind(Number(step.id)).run(); return {}; }
    const up = v.direction === "up";
    const neighbor = await first(`SELECT id,position FROM portal_steps WHERE organization_id=? AND audience=? AND position ${up ? "<" : ">"} ? ORDER BY position ${up ? "DESC" : "ASC"} LIMIT 1`, [a.organizationId, str(step.audience), Number(step.position)]);
    if (neighbor) await db.batch([
      db.prepare("UPDATE portal_steps SET position=? WHERE id=?").bind(Number(neighbor.position), Number(step.id)),
      db.prepare("UPDATE portal_steps SET position=? WHERE id=?").bind(Number(step.position), Number(neighbor.id)),
    ]);
    return {};
  }
  if (action === "set_member") {
    const v = memberSchema.parse(input);
    const user = await first("SELECT id,role,city_id FROM app_users WHERE id=? AND organization_id=? AND role='Mentorado'", [v.userId, a.organizationId]);
    if (!user) throw new PortalError("Membro do portal não encontrado.", 404);
    if (v.personId && !(await first("SELECT p.id FROM territory_people p JOIN cities c ON c.id=p.city_id WHERE p.id=? AND c.organization_id=?", [v.personId, a.organizationId]))) throw new PortalError("Pessoa do mapa não encontrada.", 404);
    if (v.ownerEmail && !(await first("SELECT id FROM app_users WHERE organization_id=? AND lower(email)=? AND active=1 AND role IN ('Administrador','Coordenação','Líder','Comercial')", [a.organizationId, v.ownerEmail]))) throw new PortalError("O responsável precisa ser da equipe Elite.", 400);
    await db.prepare("UPDATE app_users SET person_id=?,portal_owner_email=?,next_meeting_at=?,next_meeting_note=? WHERE id=?")
      .bind(v.personId, v.ownerEmail, v.nextMeetingAt || null, v.nextMeetingNote, v.userId).run();
    await audit(db, a.organizationId, a.email, "portal_member", "app_user", v.userId, "Vínculos e próximo encontro do portal atualizados.");
    return {};
  }
  throw new PortalError("Esta ação não está disponível. Atualize a página e tente de novo.");
}
