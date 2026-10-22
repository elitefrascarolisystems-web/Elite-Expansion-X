import type { AccessView } from "@/lib/expansion-types";
import type { ActionName } from "@/lib/expansion-permissions";
import { canAccessAmbassador, canAccessCity, canAccessLead, canPerform } from "@/lib/expansion-permissions";
import { audit, asNullableNumber, asNumber, brazilTimestamp, database } from "@/db/runtime";
import { citySlotBlocked, seatBlocked } from "@/db/plan";

export class ActionError extends Error {}

type Input = Record<string, unknown>;

function text(input: Input, key: string) {
  return String(input[key] ?? "").trim();
}

function number(input: Input, key: string) {
  return asNumber(input[key]);
}

function nullableId(input: Input, key: string) {
  return asNullableNumber(input[key]);
}

function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizeWhatsapp(value: string) {
  const normalized = value.replace(/\D/g, "");
  return normalized || null;
}

async function cityExists(cityId: number) {
  const result = await database().prepare("SELECT id FROM cities WHERE id = ? LIMIT 1").bind(cityId).all();
  if (!result.results[0]) throw new ActionError("Cidade não encontrada.");
}

async function ambassadorIdentity(ambassadorId: number) {
  const result = await database().prepare("SELECT id, city_id FROM ambassadors WHERE id = ? LIMIT 1")
    .bind(ambassadorId).all();
  const row = result.results[0];
  if (!row) throw new ActionError("Embaixador não encontrado.");
  return { id: asNumber(row.id), cityId: asNumber(row.city_id) };
}

async function refreshAmbassadorActivation(ambassadorId: number, timestamp: string) {
  const db = database();
  const profile = await db.prepare(`
    SELECT status, onboarding_status, training_progress, terms_accepted_at
    FROM ambassadors WHERE id = ? LIMIT 1
  `).bind(ambassadorId).all();
  const row = profile.results[0];
  if (!row || ["Inativo", "Pausado", "Desligado"].includes(String(row.status))) return;
  const activity = await db.prepare(`
    SELECT EXISTS(
      SELECT 1 FROM ambassador_updates WHERE ambassador_id = ?
      UNION ALL SELECT 1 FROM leads WHERE ambassador_id = ?
      UNION ALL SELECT 1 FROM tasks WHERE ambassador_id = ? AND status = 'Concluída'
    ) AS has_activity
  `).bind(ambassadorId, ambassadorId, ambassadorId).all();
  const ready = String(row.onboarding_status) === "Concluído" &&
    asNumber(row.training_progress) >= 100 &&
    Boolean(row.terms_accepted_at) &&
    Boolean(activity.results[0]?.has_activity);
  if (ready && String(row.status) !== "Ativo") {
    await db.prepare("UPDATE ambassadors SET status = 'Ativo', updated_at = ? WHERE id = ?")
      .bind(timestamp, ambassadorId).run();
  }
}

async function leadIdentity(leadId: number) {
  const result = await database().prepare(`
    SELECT id, city_id, ambassador_id, assigned_to_email, status, consent_revoked_at
    FROM leads WHERE id = ? LIMIT 1
  `).bind(leadId).all();
  const row = result.results[0];
  if (!row) throw new ActionError("Lead não encontrado.");
  return {
    id: asNumber(row.id),
    cityId: asNumber(row.city_id),
    ambassadorId: asNullableNumber(row.ambassador_id),
    assignedToEmail: String(row.assigned_to_email ?? ""),
    status: String(row.status ?? ""),
    consentRevokedAt: row.consent_revoked_at ? String(row.consent_revoked_at) : null,
  };
}

async function assertOptionalReferenceCity(table: "ambassadors" | "partners" | "events", id: number | null, cityId: number) {
  if (id === null) return;
  const result = await database().prepare(`SELECT city_id FROM ${table} WHERE id = ? LIMIT 1`).bind(id).all();
  const row = result.results[0];
  if (!row || asNumber(row.city_id) !== cityId) throw new ActionError("A origem selecionada não pertence a esta cidade.");
}

async function assertOptionalContentCity(id: number | null, cityId: number, organizationId:number) {
  if (id === null) return;
  const result = await database().prepare("SELECT city_id FROM contents WHERE id = ? AND organization_id=? LIMIT 1").bind(id,organizationId).all();
  const row = result.results[0];
  if (!row) throw new ActionError("Conteúdo não encontrado.");
  const contentCityId = asNullableNumber(row.city_id);
  if (contentCityId !== null && contentCityId !== cityId) {
    throw new ActionError("O conteúdo selecionado não pertence a esta cidade.");
  }
}

function ensurePermission(access: AccessView, action: ActionName) {
  if (!canPerform(access, action)) throw new ActionError("Seu perfil não possui permissão para esta ação.");
}

function ensureCityPermission(access: AccessView, cityId: number) {
  if (!canAccessCity(access, cityId)) throw new ActionError("Seu perfil não possui acesso a esta cidade.");
}

async function resolvePerson(input: Input, access: AccessView, cityId: number, table: "leads" | "ambassadors") {
  const id = typeof input.personId === "string" ? input.personId : crypto.randomUUID();
  const db = database();
  if (input.personId) {
    const p = (await db.prepare("SELECT name, city_id, created_by FROM territory_people WHERE id=?").bind(id).all()).results[0];
    // Comercial liga só as pessoas que ele mesmo mapeou.
    const ownMapped = access.role === "Comercial" && Boolean(p) && String(p.created_by).toLowerCase() === access.email.toLowerCase();
    if (!["Administrador", "Coordenação", "Líder"].includes(access.role) && !ownMapped) throw new ActionError("Seu perfil não possui permissão para vincular pessoas existentes.");
    if (!p || Number(p.city_id) !== cityId) throw new ActionError("Pessoa fora do seu acesso.");
    const duplicate = (await db.prepare(`SELECT id FROM ${table} WHERE person_id=?`).bind(id).all()).results[0];
    if (duplicate) throw new ActionError(table === "ambassadors" ? "Esta pessoa já é embaixadora. Abra a ficha dela em Rede → Embaixadores." : "Esta pessoa já tem atendimento. Abra a ficha dela em Vendas → Atendimentos.");
    input.name = String(p.name);
  }
  const now = brazilTimestamp();
  const statement = db.prepare("INSERT OR IGNORE INTO territory_people(id,city_id,name,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?)").bind(id,cityId,text(input,"name"),access.email,now,now);
  return {id,statement};
}

export async function executeAction(action: ActionName, input: Input, access: AccessView) {
  ensurePermission(access, action);
  const db = database();
  const timestamp = brazilTimestamp();
  if(!Number.isInteger(access.organizationId)||access.organizationId<1)throw new ActionError("Organização fora do seu acesso.");
  // Resolve all supplied record identifiers before any write. IDs are not authorization.
  const candidateCities:number[]=[];
  if(input.cityId!=null)candidateCities.push(Number(input.cityId));
  for(const [field,table] of [['ambassadorId','ambassadors'],['leadId','leads']] as const){if(input[field]!=null){const row=(await db.prepare(`SELECT city_id FROM ${table} WHERE id=?`).bind(Number(input[field])).all()).results[0];if(!row)throw new ActionError("Registro fora do seu acesso.");candidateCities.push(Number(row.city_id));}}
  if(access.role==='Embaixador'&&access.ambassadorId!=null){const row=(await db.prepare('SELECT city_id FROM ambassadors WHERE id=?').bind(access.ambassadorId).all()).results[0];if(!row)throw new ActionError("Registro fora do seu acesso.");candidateCities.push(Number(row.city_id));}
  for(const cityId of candidateCities){const row=(await db.prepare('SELECT id FROM cities WHERE id=? AND organization_id=?').bind(cityId,access.organizationId).all()).results[0];if(!row)throw new ActionError("Registro fora do seu acesso.");}

  if (action === "create_city") {
    if (text(input, "status") === "Ativa") { const blocked = await citySlotBlocked(access.organizationId); if (blocked) throw new ActionError(blocked); }
    const result = await db.prepare(`
      INSERT INTO cities
        (organization_id, name, state, phase, leader_name, target_cac_cents, ambassador_goal, sales_goal,
         status, budget_cents, tracking_mode, notes, updated_at, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      access.organizationId,text(input, "name"), text(input, "state"), text(input, "phase"), text(input, "leaderName"),
      number(input, "targetCacCents"), number(input, "ambassadorGoal"), number(input, "salesGoal"),
      text(input, "status"), number(input, "budgetCents"), text(input, "trackingMode"), text(input, "notes"),
      timestamp, access.email, timestamp,
    ).run();
    const entityId = asNumber(result.meta.last_row_id);
    await audit(db, access.organizationId, access.email, action, "city", entityId, `Cidade ${text(input, "name")} criada.`);
    return;
  }

  if (action === "update_city") {
    const cityId = number(input, "cityId");
    await cityExists(cityId);
    ensureCityPermission(access, cityId);
    if (text(input, "status") === "Ativa") {
      const current = (await db.prepare("SELECT status FROM cities WHERE id=?").bind(cityId).all()).results[0];
      const blocked = current?.status === "Ativa" ? null : await citySlotBlocked(access.organizationId, cityId);
      if (blocked) throw new ActionError(blocked);
    }
    await db.prepare(`
      UPDATE cities SET phase = ?, leader_name = ?, target_cac_cents = ?, ambassador_goal = ?,
        sales_goal = ?, status = ?, budget_cents = ?, tracking_mode = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      text(input, "phase"), text(input, "leaderName"), number(input, "targetCacCents"),
      number(input, "ambassadorGoal"), number(input, "salesGoal"), text(input, "status"),
      number(input, "budgetCents"), text(input, "trackingMode"), text(input, "notes"), timestamp, cityId,
    ).run();
    await audit(db, access.organizationId, access.email, action, "city", cityId, "Configuração da cidade atualizada.");
    return;
  }

  if (action === "create_ambassador") {
    const cityId = number(input, "cityId");
    await cityExists(cityId);
    ensureCityPermission(access, cityId);
    if (text(input, "status") === "Ativo") throw new ActionError("Cadastre o embaixador e conclua treinamento, aceite e atividade antes de ativar.");
    const person = await resolvePerson(input, access, cityId, "ambassadors");
    const insert = db.prepare(`
      INSERT INTO ambassadors
        (person_id, city_id, name, code, email, whatsapp, whatsapp_authorized_at, level, status, onboarding_status,
         training_progress, updated_at, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendente', 0, ?, ?, ?)
    `).bind(
      person.id, cityId, text(input, "name"), text(input, "code").toUpperCase(), normalizeEmail(text(input, "email")) ?? "",
      normalizeWhatsapp(text(input, "whatsapp")) ?? "", input.whatsappAuthorized ? timestamp : null,
      text(input, "level"), text(input, "status"), timestamp, access.email, timestamp,
    );
    const result = (await db.batch([person.statement, insert]))[1];
    const entityId = asNumber(result.meta.last_row_id);
    await audit(db, access.organizationId, access.email, action, "ambassador", entityId, `Embaixador ${text(input, "name")} cadastrado.`);
    return;
  }

  if (action === "update_ambassador") {
    const ambassadorId = number(input, "ambassadorId");
    const ambassador = await ambassadorIdentity(ambassadorId);
    if (!canAccessAmbassador(access, ambassadorId, ambassador.cityId)) throw new ActionError("Embaixador fora do seu acesso.");
    if (text(input, "status") === "Ativo") {
      const prior = (await db.prepare("SELECT terms_accepted_at FROM ambassadors WHERE id=?").bind(ambassadorId).all()).results[0];
      const activity = (await db.prepare("SELECT EXISTS(SELECT 1 FROM ambassador_updates WHERE ambassador_id=? UNION ALL SELECT 1 FROM tasks WHERE ambassador_id=? AND status='Concluída') AS present").bind(ambassadorId,ambassadorId).all()).results[0];
      if (!prior?.terms_accepted_at || text(input,"onboardingStatus") !== "Concluído" || number(input,"trainingProgress") < 100 || !activity?.present) throw new ActionError("Ativação exige treinamento concluído, aceite pessoal e atividade registrada.");
    }
    await db.prepare(`
      UPDATE ambassadors SET level = ?, status = ?, onboarding_status = ?, training_progress = ?,
        whatsapp_authorized_at = CASE WHEN ? THEN COALESCE(whatsapp_authorized_at, ?) ELSE NULL END,
        pause_reason = ?, updated_at = ? WHERE id = ?
    `).bind(
      text(input, "level"), text(input, "status"), text(input, "onboardingStatus"),
      number(input, "trainingProgress"), input.whatsappAuthorized, timestamp,
      text(input, "pauseReason"), timestamp, ambassadorId,
    ).run();
    await audit(db, access.organizationId, access.email, action, "ambassador", ambassadorId, "Situação do embaixador atualizada.");
    return;
  }

  if (action === "record_city") {
    const cityId = number(input, "cityId");
    await cityExists(cityId);
    ensureCityPermission(access, cityId);
    const city = await db.prepare("SELECT tracking_mode FROM cities WHERE id = ?").bind(cityId).all();
    if (String(city.results[0]?.tracking_mode) === "Detalhado") {
      throw new ActionError("Esta cidade usa acompanhamento detalhado: registre os atendimentos e pagamentos em Vendas e os custos em Resultados → Custos e canais.");
    }
    const insert = db.prepare(`
      INSERT INTO city_updates
        (city_id, period, reach, leads, organic_leads, sales, revenue_cents, cost_cents,
         media_cost_cents, refunds, satisfaction, partners, events, note, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      cityId, text(input, "period"), number(input, "reach"), number(input, "leads"),
      number(input, "organicLeads"), number(input, "sales"), number(input, "revenueCents"),
      number(input, "costCents"), number(input, "mediaCostCents"), number(input, "refunds"),
      number(input, "satisfaction"), number(input, "partners"), number(input, "events"),
      text(input, "note"), access.email, timestamp,
    );
    const update = db.prepare("UPDATE cities SET phase = ?, status = ?, updated_at = ? WHERE id = ?")
      .bind(text(input, "phase"), text(input, "status"), timestamp, cityId);
    const results = await db.batch([insert, update]);
    await audit(db, access.organizationId, access.email, action, "city_update", asNumber(results[0].meta.last_row_id), "Resultado consolidado registrado.");
    return;
  }

  if (action === "record_ambassador") {
    const ambassadorId = access.role === "Embaixador" && access.ambassadorId !== null
      ? access.ambassadorId
      : number(input, "ambassadorId");
    const ambassador = await ambassadorIdentity(ambassadorId);
    if (!canAccessAmbassador(access, ambassadorId, ambassador.cityId)) throw new ActionError("Embaixador fora do seu acesso.");
    const result = await db.prepare(`
      INSERT INTO ambassador_updates
        (ambassador_id, period, leads, sales, actions, contents, events, cost_cents, note, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      ambassadorId, text(input, "period"), number(input, "leads"), number(input, "sales"),
      number(input, "actions"), number(input, "contents"), number(input, "events"),
      number(input, "costCents"), text(input, "note"), access.email, timestamp,
    ).run();
    await db.prepare("UPDATE ambassadors SET updated_at = ? WHERE id = ?").bind(timestamp, ambassadorId).run();
    await refreshAmbassadorActivation(ambassadorId, timestamp);
    await audit(db, access.organizationId, access.email, action, "ambassador_update", asNumber(result.meta.last_row_id), "Atividade do embaixador registrada.");
    return;
  }

  if (action === "create_lead") {
    const cityId = access.role === "Embaixador" && access.cityId !== null ? access.cityId : number(input, "cityId");
    const ambassadorId = access.role === "Embaixador" ? access.ambassadorId : nullableId(input, "ambassadorId");
    await cityExists(cityId);
    ensureCityPermission(access, cityId);
    await assertOptionalReferenceCity("ambassadors", ambassadorId, cityId);
    await assertOptionalReferenceCity("partners", nullableId(input, "partnerId"), cityId);
    await assertOptionalReferenceCity("events", nullableId(input, "eventId"), cityId);
    await assertOptionalContentCity(nullableId(input, "contentId"), cityId,access.organizationId);
    const normalizedEmail = normalizeEmail(text(input, "email"));
    const normalizedWhatsapp = normalizeWhatsapp(text(input, "whatsapp"));
    const duplicateConditions: string[] = [];
    const duplicateValues: string[] = [];
    if (normalizedEmail) { duplicateConditions.push("normalized_email = ?"); duplicateValues.push(normalizedEmail); }
    if (normalizedWhatsapp) { duplicateConditions.push("normalized_whatsapp = ?"); duplicateValues.push(normalizedWhatsapp); }
    if (duplicateConditions.length) {
      const duplicate = await db.prepare(`
        SELECT id FROM leads WHERE city_id IN (SELECT id FROM cities WHERE organization_id=?) AND status <> 'Cancelado' AND (${duplicateConditions.join(" OR ")}) LIMIT 1
      `).bind(access.organizationId,...duplicateValues).all();
      if (duplicate.results[0]) throw new ActionError("Este contato já está cadastrado. Solicite ao responsável a revisão do atendimento.");
    }
    const channel = access.role === "Embaixador" ? "Embaixador" : text(input, "channel");
    const leadStatus = access.role === "Embaixador" ? "Lead informado" : text(input, "status");
    const assignedToEmail = access.role === "Comercial"
      ? access.email.toLowerCase()
      : access.role === "Embaixador"
        ? ""
      : text(input, "assignedToEmail").toLowerCase();
    const person = await resolvePerson(input, access, cityId, "leads");
    const insert = db.prepare(`
      INSERT INTO leads
        (person_id, city_id, ambassador_id, partner_id, event_id, content_id, name, email, whatsapp,
         normalized_email, normalized_whatsapp, status, channel, source_label, campaign,
         utm_source, utm_medium, utm_campaign, consent_at, consent_source, consent_purpose,
         assigned_to_email, updated_at, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      person.id, cityId, ambassadorId, nullableId(input, "partnerId"), nullableId(input, "eventId"), nullableId(input, "contentId"),
      text(input, "name"), text(input, "email"), text(input, "whatsapp"), normalizedEmail, normalizedWhatsapp,
      leadStatus, channel, text(input, "sourceLabel"), text(input, "campaign"), text(input, "utmSource"),
      text(input, "utmMedium"), text(input, "utmCampaign"), timestamp, text(input, "consentSource"),
      text(input, "consentPurpose"), assignedToEmail, timestamp, access.email, timestamp,
    );
    const result = (await db.batch([person.statement, insert]))[1];
    const entityId = asNumber(result.meta.last_row_id);
    if (ambassadorId !== null) await refreshAmbassadorActivation(ambassadorId, timestamp);
    await audit(db, access.organizationId, access.email, action, "lead", entityId, `Lead autorizado registrado pelo canal ${channel}.`);
    return;
  }

  if (action === "update_lead") {
    const leadId = number(input, "leadId");
    const lead = await leadIdentity(leadId);
    if (!canAccessLead(access, lead)) throw new ActionError("Lead fora do seu acesso.");
    const consentRevoked = Boolean(input.consentRevoked) || Boolean(lead.consentRevokedAt);
    const revocationNow = Boolean(input.consentRevoked) && !lead.consentRevokedAt;
    const status = consentRevoked ? "Cancelado" : text(input, "status");
    await db.prepare(`
      UPDATE leads SET status = ?, assigned_to_email = ?,
        consent_revoked_at = CASE WHEN ? THEN COALESCE(consent_revoked_at, ?) ELSE consent_revoked_at END,
        consent_revocation_reason = CASE WHEN ? THEN ? ELSE consent_revocation_reason END,
        updated_at = ? WHERE id = ?
    `).bind(
      status, text(input, "assignedToEmail").toLowerCase(), revocationNow, timestamp,
      revocationNow, text(input, "consentRevocationReason"), timestamp, leadId,
    ).run();
    await audit(db, access.organizationId, access.email, action, "lead", leadId, revocationNow ? "Autorização revogada e contato cancelado." : `Etapa alterada para ${status}.`);
    return;
  }

  if (action === "record_sale") {
    const leadId = number(input, "leadId");
    const lead = await leadIdentity(leadId);
    if (!canAccessLead(access, lead)) throw new ActionError("Lead fora do seu acesso.");
    if (lead.status === "Cancelado" || lead.consentRevokedAt) throw new ActionError("Não é permitido registrar venda para um contato cancelado ou com autorização revogada.");
    const existing = await db.prepare("SELECT id FROM sales WHERE lead_id = ? LIMIT 1").bind(leadId).all();
    const status = text(input, "status");
    const paidAt = status === "Pagamento confirmado" ? timestamp : null;
    let entityId: number;
    if (existing.results[0]) {
      entityId = asNumber(existing.results[0].id);
      await db.prepare(`
        UPDATE sales SET product = ?, amount_cents = ?, status = ?, paid_at = ?, updated_at = ? WHERE id = ?
      `).bind(text(input, "product"), number(input, "amountCents"), status, paidAt, timestamp, entityId).run();
    } else {
      const result = await db.prepare(`
        INSERT INTO sales
          (lead_id, city_id, ambassador_id, product, amount_cents, status, paid_at, updated_at, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        leadId, lead.cityId, lead.ambassadorId, text(input, "product"), number(input, "amountCents"),
        status, paidAt, timestamp, access.email, timestamp,
      ).run();
      entityId = asNumber(result.meta.last_row_id);
    }
    await db.prepare("UPDATE leads SET status = 'Oportunidade', updated_at = ? WHERE id = ?")
      .bind(timestamp, leadId).run();
    if (status === "Pagamento confirmado") {
      // Pagamento confirmado fecha a oportunidade: ninguém precisa voltar ao CRM para marcar "Ganho".
      await db.batch([
        db.prepare(`INSERT INTO commercial_activities(id,organization_id,city_id,opportunity_id,owner_email,kind,note,activity_date,created_at)
          SELECT lower(hex(randomblob(16))),organization_id,city_id,id,owner_email,'Etapa',stage||' → Ganho (pagamento confirmado)',?,?
          FROM opportunities WHERE lead_id=? AND stage NOT IN ('Ganho','Perdido')`).bind(timestamp.slice(0, 10), timestamp, leadId),
        db.prepare("UPDATE opportunities SET stage='Ganho', updated_at=?, version=version+1 WHERE lead_id=? AND stage NOT IN ('Ganho','Perdido')").bind(timestamp, leadId),
      ]);
    }
    await audit(db, access.organizationId, access.email, action, "sale", entityId, `Venda atualizada para ${status}.`);
    return;
  }

  if (action === "create_cost") {
    const cityId = number(input, "cityId");
    await cityExists(cityId);
    ensureCityPermission(access, cityId);
    await assertOptionalReferenceCity("ambassadors", nullableId(input, "ambassadorId"), cityId);
    await assertOptionalReferenceCity("partners", nullableId(input, "partnerId"), cityId);
    await assertOptionalReferenceCity("events", nullableId(input, "eventId"), cityId);
    const result = await db.prepare(`
      INSERT INTO costs
        (city_id, ambassador_id, partner_id, event_id, category, channel, period, amount_cents, note, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      cityId, nullableId(input, "ambassadorId"), nullableId(input, "partnerId"), nullableId(input, "eventId"),
      text(input, "category"), text(input, "channel"), text(input, "period"), number(input, "amountCents"),
      text(input, "note"), access.email, timestamp,
    ).run();
    await audit(db, access.organizationId, access.email, action, "cost", asNumber(result.meta.last_row_id), `Custo de ${text(input, "category")} registrado.`);
    return;
  }

  if (action === "create_partner") {
    const cityId = number(input, "cityId");
    await cityExists(cityId);
    ensureCityPermission(access, cityId);
    const result = await db.prepare(`
      INSERT INTO partners
        (city_id, name, type, contact_name, whatsapp, status, next_action, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      cityId, text(input, "name"), text(input, "type"), text(input, "contactName"), text(input, "whatsapp"),
      text(input, "status"), text(input, "nextAction"), access.email, timestamp,
    ).run();
    await audit(db, access.organizationId, access.email, action, "partner", asNumber(result.meta.last_row_id), `Parceiro ${text(input, "name")} cadastrado.`);
    return;
  }

  if (action === "create_event") {
    const cityId = number(input, "cityId");
    await cityExists(cityId);
    ensureCityPermission(access, cityId);
    await assertOptionalReferenceCity("partners", nullableId(input, "partnerId"), cityId);
    const result = await db.prepare(`
      INSERT INTO events
        (city_id, partner_id, name, event_date, status, owner_name, cost_cents, reach, leads, sales, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      cityId, nullableId(input, "partnerId"), text(input, "name"), text(input, "eventDate"), text(input, "status"),
      text(input, "ownerName"), number(input, "costCents"), number(input, "reach"), number(input, "leads"),
      number(input, "sales"), access.email, timestamp,
    ).run();
    const entityId = asNumber(result.meta.last_row_id);
    if (number(input, "costCents") > 0) {
      await db.prepare(`
        INSERT INTO costs
          (city_id, partner_id, event_id, category, channel, period, amount_cents, note, created_by, created_at)
        VALUES (?, ?, ?, 'Evento', 'Evento', ?, ?, ?, ?, ?)
      `).bind(
        cityId, nullableId(input, "partnerId"), entityId, text(input, "eventDate").slice(0, 7),
        number(input, "costCents"), `Custo do evento ${text(input, "name")}.`, access.email, timestamp,
      ).run();
    }
    await audit(db, access.organizationId, access.email, action, "event", entityId, `Evento ${text(input, "name")} cadastrado.`);
    return;
  }

  if (action === "create_content") {
    const cityId = ["Líder", "Coordenação"].includes(access.role) ? access.cityId : nullableId(input, "cityId");
    if (["Líder", "Coordenação"].includes(access.role) && cityId === null) throw new ActionError("O perfil de líder precisa estar vinculado a uma cidade.");
    if (cityId !== null) {
      await cityExists(cityId);
      ensureCityPermission(access, cityId);
    }
    const status = access.role === "Líder" ? "Em revisão" : text(input, "status");
    const result = await db.prepare(`
      INSERT INTO contents
        (organization_id, city_id, title, type, channel, version, status, url, instructions, expires_at, audience, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      access.organizationId,cityId, text(input, "title"), text(input, "type"), text(input, "channel"), text(input, "version"), status,
      text(input, "url"), text(input, "instructions"), text(input, "expiresAt") || null, text(input, "audience") || "Embaixadores", access.email, timestamp,
    ).run();
    await audit(db, access.organizationId, access.email, action, "content", asNumber(result.meta.last_row_id), `Conteúdo ${text(input, "title")} criado como ${status}.`);
    return;
  }

  if (action === "create_task") {
    let cityId = ["Líder", "Coordenação"].includes(access.role) ? access.cityId : nullableId(input, "cityId");
    const ambassadorId = nullableId(input, "ambassadorId");
    if (["Líder", "Coordenação"].includes(access.role) && cityId === null) throw new ActionError("O perfil de líder precisa estar vinculado a uma cidade.");
    if (ambassadorId !== null) {
      const ambassador = await ambassadorIdentity(ambassadorId);
      cityId ??= ambassador.cityId;
      if (cityId !== null && ambassador.cityId !== cityId) throw new ActionError("O embaixador não pertence à cidade selecionada.");
      if (!canAccessAmbassador(access, ambassadorId, ambassador.cityId)) throw new ActionError("Embaixador fora do seu acesso.");
    }
    if (cityId !== null) {
      await cityExists(cityId);
      ensureCityPermission(access, cityId);
    }
    const result = await db.prepare(`
      INSERT INTO tasks
        (organization_id,city_id, ambassador_id, title, category, due_date, status, updated_by, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Pendente', ?, ?, ?)
    `).bind(
      access.organizationId,cityId, ambassadorId, text(input, "title"), text(input, "category"), text(input, "dueDate") || null,
      access.email, access.email, timestamp,
    ).run();
    await audit(db, access.organizationId, access.email, action, "task", asNumber(result.meta.last_row_id), `Tarefa ${text(input, "title")} criada.`);
    return;
  }

  if (action === "complete_task") {
    const taskId = number(input, "taskId");
    const task = await db.prepare("SELECT id, city_id, ambassador_id FROM tasks WHERE id = ? AND organization_id=? LIMIT 1").bind(taskId,access.organizationId).all();
    const row = task.results[0];
    if (!row) throw new ActionError("Tarefa não encontrada.");
    const cityId = asNullableNumber(row.city_id);
    const ambassadorId = asNullableNumber(row.ambassador_id);
    if (access.role === "Embaixador" && ambassadorId !== access.ambassadorId) throw new ActionError("Tarefa fora do seu acesso.");
    if (access.role !== "Administrador" && cityId === null) throw new ActionError("Tarefa global fora do seu acesso.");
    if (access.role !== "Embaixador" && cityId !== null) ensureCityPermission(access, cityId);
    await db.prepare("UPDATE tasks SET status = 'Concluída', completed_at = ?, updated_by = ? WHERE id = ?")
      .bind(timestamp, access.email, taskId).run();
    if (ambassadorId !== null) await refreshAmbassadorActivation(ambassadorId, timestamp);
    await audit(db, access.organizationId, access.email, action, "task", taskId, "Tarefa concluída.");
    return;
  }

  if (action === "complete_training") {
    const ambassadorId = number(input, "ambassadorId");
    if (access.role === "Embaixador" && ambassadorId !== access.ambassadorId) throw new ActionError("Embaixador fora do seu acesso.");
    const ambassador = await ambassadorIdentity(ambassadorId);
    if (!canAccessAmbassador(access, ambassadorId, ambassador.cityId)) throw new ActionError("Embaixador fora do seu acesso.");
    await db.prepare(`
      UPDATE ambassadors SET training_progress = 100, onboarding_status = 'Concluído',
        status = CASE WHEN status IN ('Convidado', 'Em análise', 'Em treinamento', 'Candidato') THEN 'Aprovado' ELSE status END,
        updated_at = ? WHERE id = ?
    `).bind(timestamp, ambassadorId).run();
    await refreshAmbassadorActivation(ambassadorId, timestamp);
    await audit(db, access.organizationId, access.email, action, "ambassador", ambassadorId, "Treinamento concluído.");
    return;
  }

  if (action === "accept_terms") {
    const ambassadorId = number(input, "ambassadorId");
    if (access.role !== "Embaixador" || ambassadorId !== access.ambassadorId) {
      throw new ActionError("O aceite das regras deve ser feito pelo próprio embaixador.");
    }
    await db.prepare("UPDATE ambassadors SET terms_accepted_at = ?, updated_at = ? WHERE id = ?")
      .bind(timestamp, timestamp, ambassadorId).run();
    await refreshAmbassadorActivation(ambassadorId, timestamp);
    await audit(db, access.organizationId, access.email, action, "ambassador", ambassadorId, "Regras aceitas pelo embaixador.");
    return;
  }

  if (action === "update_settings") {
    await db.prepare(`
      UPDATE settings SET referral_base_url = ?, attribution_model = ?, min_active_ambassadors = ?,
        min_confirmed_payments = ?, min_active_partners = ?, min_data_periods = ?, inactivity_days = ?,
        organic_goal_percent = ?, updated_by = ?, updated_at = ? WHERE organization_id = ?
    `).bind(
      text(input, "referralBaseUrl"), text(input, "attributionModel"), number(input, "minActiveAmbassadors"),
      number(input, "minConfirmedPayments"), number(input, "minActivePartners"), number(input, "minDataPeriods"),
      number(input, "inactivityDays"), number(input, "organicGoalPercent"), access.email, timestamp,access.organizationId,
    ).run();
    await audit(db, access.organizationId, access.email, action, "settings", 1, "Critérios de decisão atualizados.");
    return;
  }

  if (action === "create_user") {
    const cityId = nullableId(input, "cityId");
    const ambassadorId = nullableId(input, "ambassadorId");
    if (cityId !== null) await cityExists(cityId);
    if (ambassadorId !== null) {
      const ambassador = await ambassadorIdentity(ambassadorId);
      if (cityId !== ambassador.cityId) throw new ActionError("O embaixador não pertence à cidade selecionada.");
    }
    const email = text(input, "email").toLowerCase();
    const existing = await db.prepare("SELECT id FROM app_users WHERE lower(email) = lower(?) AND organization_id=? LIMIT 1").bind(email,access.organizationId).all();
    const blocked = await seatBlocked(access.organizationId, text(input, "role"), existing.results[0] ? asNumber(existing.results[0].id) : null);
    if (blocked) throw new ActionError(blocked);
    let entityId: number;
    if (existing.results[0]) {
      entityId = asNumber(existing.results[0].id);
      await db.prepare(`
        UPDATE app_users SET name = ?, role = ?, city_id = ?, ambassador_id = ?, title = ?, mentorship_cycle = ?, active = 1 WHERE id = ?
      `).bind(text(input, "name"), text(input, "role"), cityId, ambassadorId, text(input, "title"), asNumber(input.mentorshipCycle), entityId).run();
    } else {
      const result = await db.prepare(`
        INSERT INTO app_users (organization_id,email, name, role, city_id, ambassador_id, title, mentorship_cycle, active, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).bind(access.organizationId,email, text(input, "name"), text(input, "role"), cityId, ambassadorId, text(input, "title"), asNumber(input.mentorshipCycle), access.email, timestamp).run();
      entityId = asNumber(result.meta.last_row_id);
    }
    await audit(db, access.organizationId, access.email, action, "app_user", entityId, `Perfil interno preparado para ${email}; nenhum convite foi enviado.`);
    return;
  }

  throw new ActionError("Ação não implementada.");
}
