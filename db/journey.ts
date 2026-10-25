import { database } from "@/db/runtime";
import { ActionError, executeAction } from "@/db/mutations";
import { CommercialError, saveCommercial } from "@/db/commercial";
import { canAccessCity, canPerform } from "@/lib/expansion-permissions";
import { parseActionPayload } from "@/lib/expansion-validation";
import { opportunitySchema } from "@/lib/commercial";
import { startAttendanceSchema } from "@/lib/journey";
import type { AccessView } from "@/lib/expansion-types";

const first = async (sql: string, args: (string | number | null)[]) => (await database().prepare(sql).bind(...args).all()).results[0];

export class JourneyError extends Error {
  constructor(message: string, public status = 400, public leadId: number | null = null) { super(message); }
}

/**
 * Pessoa do mapa → lead → oportunidade, numa ação só. O lead nasce ligado à
 * pessoa (mesmo nome e cidade) e a oportunidade ao local dela, quando existe.
 * Se o lead já existe e falta só a oportunidade (ex.: queda no meio do caminho),
 * completa o que falta em vez de duplicar.
 */
export async function startAttendance(access: AccessView, input: unknown) {
  if (!canPerform(access, "create_lead") || access.role === "Embaixador") throw new JourneyError("Seu perfil não inicia atendimentos.", 403);
  const v = startAttendanceSchema.parse(input);
  const person = await first(
    `SELECT p.id, p.name, p.city_id, p.place_id, p.created_by FROM territory_people p JOIN cities c ON c.id=p.city_id
     WHERE p.id=? AND c.organization_id=?`, [v.personId, access.organizationId]);
  if (!person || !canAccessCity(access, Number(person.city_id))) throw new JourneyError("Pessoa fora do seu acesso.", 403);
  const cityId = Number(person.city_id);
  if (access.role === "Comercial" && String(person.created_by).toLowerCase() !== access.email.toLowerCase()) {
    // Quem só vende inicia atendimento das pessoas que mapeou; as demais passam pela gestão.
    const own = await first("SELECT id FROM leads WHERE person_id=? AND lower(assigned_to_email)=lower(?)", [v.personId, access.email]);
    if (!own) throw new JourneyError("Você inicia atendimento das pessoas que mapeou. Peça à gestão para atribuir esta pessoa a você.", 403);
  }
  // Confere a oportunidade antes de gravar qualquer coisa, para não deixar lead pela metade.
  opportunitySchema.parse({ id: crypto.randomUUID(), leadId: 1, businessId: null, ownerEmail: v.ownerEmail, temperature: v.temperature, stage: "Novo", nextAction: v.nextAction, dueDate: v.dueDate, lostReason: "" });

  let lead = await first("SELECT id FROM leads WHERE person_id=? AND status<>'Cancelado' AND consent_revoked_at IS NULL", [v.personId]);
  if (lead) {
    const opportunity = await first("SELECT id FROM opportunities WHERE lead_id=? AND organization_id=?", [Number(lead.id), access.organizationId]);
    if (opportunity) throw new JourneyError("Esta pessoa já está em atendimento. Abra o acompanhamento.", 409, Number(lead.id));
  } else {
    const place = person.place_id ? await first("SELECT name FROM businesses WHERE id=?", [String(person.place_id)]) : null;
    const data = parseActionPayload("create_lead", {
      personId: v.personId, referrerId: v.referrerId, cityId, name: String(person.name), email: v.email, whatsapp: v.whatsapp,
      status: "Lead válido", channel: v.channel, sourceLabel: place ? `Mapeamento · ${String(place.name)}` : "Mapeamento",
      campaign: "", utmSource: "", utmMedium: "", utmCampaign: "",
      consentAccepted: true, consentSource: v.consentSource, consentPurpose: v.consentPurpose, assignedToEmail: v.ownerEmail,
    });
    await executeAction("create_lead", data, access);
    lead = await first("SELECT id FROM leads WHERE person_id=? ORDER BY id DESC LIMIT 1", [v.personId]);
    if (!lead) throw new JourneyError("Não foi possível começar o atendimento. Tente de novo.", 503);
  }
  const leadId = Number(lead.id);
  // No CRM o vendedor só enxerga os locais pelos quais responde; se o local da pessoa é de outro
  // responsável, a oportunidade nasce sem esse vínculo (a ligação pessoa → local continua no mapa).
  const business = person.place_id ? await first(`SELECT id FROM businesses WHERE id=? AND organization_id=? AND city_id=?${access.role === "Comercial" ? " AND lower(owner_email)=lower(?)" : ""}`, [String(person.place_id), access.organizationId, cityId, ...(access.role === "Comercial" ? [access.email] : [])]) : null;
  const opportunityId = crypto.randomUUID();
  try {
    await saveCommercial(access, "opportunity", { id: opportunityId, leadId, businessId: business ? String(business.id) : null, ownerEmail: v.ownerEmail, temperature: v.temperature, stage: "Novo", nextAction: v.nextAction, dueDate: v.dueDate, lostReason: "" });
  } catch (error) {
    // O lead fica salvo; repetir a ação completa só a oportunidade.
    const message = error instanceof CommercialError || error instanceof ActionError ? error.message : "Não foi possível criar a oportunidade.";
    throw new JourneyError(`O atendimento foi salvo, mas a oportunidade não: ${message} Corrija e tente de novo; o atendimento não será duplicado.`, 409);
  }
  return { leadId, opportunityId };
}
