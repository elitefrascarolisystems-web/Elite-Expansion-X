import { ZodError } from "zod";
import { nameKey, PERSON_ROLES, PLACE_LINKS, personRoleFromText, placeLinkFromText } from "@/lib/places";
import { canPerform } from "@/lib/expansion-permissions";
import { importNetworkRowSchema } from "@/lib/territory-validation";
import type { NetworkOutcome } from "@/lib/network-import";
import type { AccessView } from "@/lib/expansion-types";
import { brazilTimestamp, database } from "@/db/runtime";
import { featureBlocked } from "@/db/plan";
import { mutateTerritory, TerritoryError } from "@/db/territory";
import { executeAction, ActionError } from "@/db/mutations";
import { parseActionPayload } from "@/lib/expansion-validation";

type Body = { rows?: unknown[]; commit?: boolean; consent?: boolean; fileKeys?: unknown[] };
type Person = { id: string; name: string; referrerId: string | null };

const rows = async (sql: string, args: (string | number | null)[] = []) => (await database().prepare(sql).bind(...args).all()).results;
const str = (v: unknown) => String(v ?? "");

/** Pessoas da cidade com o mesmo nome (sem acento, caixa ou espaços extras). */
async function sameName(cityId: number, name: string): Promise<Person[]> {
  const key = nameKey(name);
  if (!key) return [];
  const list = await rows("SELECT id,name,referrer_id FROM territory_people WHERE city_id=? AND length(name) BETWEEN ? AND ? LIMIT 5000", [cityId, Math.max(1, name.length - 6), name.length + 6]);
  return list.filter((r) => nameKey(str(r.name)) === key).map((r) => ({ id: str(r.id), name: str(r.name), referrerId: r.referrer_id ? str(r.referrer_id) : null }));
}

/**
 * Importa a rede por planilha: pessoa no mapa, papel, quem indicou, atendimento (contato autorizado) e venda,
 * uma linha por pessoa. Na prévia (`commit:false`) só confere; na gravação faz tudo linha a linha, na ordem recebida
 * (quem indica vem antes de quem foi indicado). `fileKeys` lista "cidade|nome" de todas as linhas do arquivo para a
 * prévia aceitar um indicador que ainda vai ser criado por outra linha.
 */
export async function importNetwork(a: AccessView, input: unknown) {
  const body = (input ?? {}) as Body;
  if (!a.active || !["Administrador", "Coordenação", "Líder", "Comercial"].includes(a.role)) throw new TerritoryError("Seu perfil não pode importar a rede.", 403);
  const blocked = await featureBlocked(a.organizationId, "imports");
  if (blocked) throw new TerritoryError(blocked, 403);
  if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 50) throw new TerritoryError("Importe de 1 a 50 pessoas por lote.");
  const commit = body.commit === true;
  if (body.consent !== true) throw new TerritoryError("Confirme que as pessoas autorizaram o contato antes de importar.");
  const fileKeys = new Set((Array.isArray(body.fileKeys) ? body.fileKeys : []).map(String));
  const db = database();
  const seen = new Set<string>();
  const places = new Map<number, { id: string; key: string }[]>();
  const output: NetworkOutcome[] = [];

  for (const item of body.rows) {
    const line = (item as { line?: number })?.line ?? output.length + 2;
    const outcome: NetworkOutcome = { line, ok: true, status: "" };
    try {
      const r = importNetworkRowSchema.parse(item);
      outcome.line = r.line;
      if (!canPerform(a, "create_lead") && (r.whatsapp || r.email)) throw new TerritoryError("Seu perfil não registra atendimentos. Deixe WhatsApp e e-mail em branco.");
      if (!canPerform(a, "record_sale") && r.saleStatus) throw new TerritoryError("Seu perfil não registra vendas.");
      const cityRow = (await rows("SELECT id FROM cities WHERE id=? AND organization_id=?", [r.cityId, a.organizationId]))[0];
      if (!cityRow) throw new TerritoryError("Cidade não encontrada.", 404);
      const key = r.cityId + "|" + nameKey(r.name);
      if (seen.has(key)) throw new TerritoryError("Pessoa repetida no arquivo.");
      seen.add(key);

      // Pessoa: reaproveita a de mesmo nome na cidade (uma só); com mais de uma, pede para ligar pelo mapa.
      const same = await sameName(r.cityId, r.name);
      if (same.length > 1) throw new TerritoryError(`Há ${same.length} pessoas chamadas "${r.name}" nesta cidade. Ligue a venda e a indicação pela ficha no mapa.`);
      let person: Person | null = same[0] ?? null;
      outcome.person = person ? "existente" : "nova";

      // Local (opcional): precisa existir na cidade.
      let placeId: string | null = null, placeLink = "";
      if (r.place && !person) {
        if (!places.has(r.cityId)) places.set(r.cityId, (await rows("SELECT id,name FROM businesses WHERE organization_id=? AND city_id=? LIMIT 5000", [a.organizationId, r.cityId])).map((p) => ({ id: str(p.id), key: nameKey(str(p.name)) })));
        const found = places.get(r.cityId)!.filter((p) => p.key === nameKey(r.place));
        if (!found.length) throw new TerritoryError(`Local "${r.place}" não encontrado nesta cidade. Cadastre o local antes ou deixe em branco.`);
        if (found.length > 1) throw new TerritoryError(`Há mais de um local chamado "${r.place}" nesta cidade. Ligue esta pessoa pelo mapa.`);
        const link = placeLinkFromText(r.link || "Frequenta");
        if (!link) throw new TerritoryError(`Vínculo "${r.link}" não reconhecido. Use: ${PLACE_LINKS.join(", ")}.`);
        placeId = found[0].id; placeLink = link;
      }
      // Bairro: usa o já cadastrado na cidade ou cadastra sem ponto (a gestão localiza depois em Território → Cidades).
      let regionId: string | null = null;
      if (r.region) {
        const found = (await rows("SELECT id FROM territory_regions WHERE city_id=? AND name_key=?", [r.cityId, nameKey(r.region)]))[0];
        if (found) regionId = str(found.id);
        else if (commit) { regionId = crypto.randomUUID(); await db.prepare("INSERT INTO territory_regions(id,city_id,name,name_key,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(regionId, r.cityId, r.region, nameKey(r.region), a.email, brazilTimestamp(), brazilTimestamp()).run(); }
      }
      const role = r.role ? personRoleFromText(r.role) : null;
      if (r.role && !role) throw new TerritoryError(`Papel "${r.role}" não reconhecido. Use: ${PERSON_ROLES.join(", ")}.`);

      // Quem indicou: pessoa do mapa na mesma cidade, ou outra linha da planilha (gravada antes desta).
      let referrerId: string | null = null;
      if (r.referrer) {
        const refs = await sameName(r.cityId, r.referrer);
        if (refs.length > 1) throw new TerritoryError(`Há ${refs.length} pessoas chamadas "${r.referrer}" nesta cidade. Registre quem indicou pela ficha no mapa.`);
        if (refs[0]) { referrerId = refs[0].id; outcome.referrer = "ok"; }
        else if (!commit && fileKeys.has(r.cityId + "|" + nameKey(r.referrer))) outcome.referrer = "planilha";
        else throw new TerritoryError(`Quem indicou ("${r.referrer}") não está no mapa nesta cidade nem na planilha. Cadastre primeiro ou corrija o nome.`);
        if (person && referrerId && person.referrerId && person.referrerId !== referrerId) outcome.referrer = "mantido";
        if (person && referrerId === person.id) throw new TerritoryError("A pessoa não pode indicar a si mesma.");
      }

      // Contato autorizado: reaproveita o atendimento da pessoa ou confere se o contato já é de outra pessoa.
      const hasContact = Boolean(r.whatsapp || r.email);
      let leadId: number | null = null;
      if (person) {
        const lead = (await rows("SELECT id,consent_revoked_at,status FROM leads WHERE person_id=? LIMIT 1", [person.id]))[0];
        if (lead) {
          if (lead.consent_revoked_at) { if (hasContact || r.saleStatus) throw new TerritoryError("Esta pessoa revogou a autorização de contato. Nada de atendimento ou venda pode ser registrado."); }
          else leadId = Number(lead.id);
        }
      }
      if (hasContact && !leadId) {
        const email = r.email.trim().toLowerCase() || null, whatsapp = r.whatsapp.replace(/\D/g, "") || null;
        const conditions: string[] = [], values: string[] = [];
        if (email) { conditions.push("normalized_email=?"); values.push(email); }
        if (whatsapp) { conditions.push("normalized_whatsapp=?"); values.push(whatsapp); }
        const duplicate = (await rows(`SELECT name FROM leads WHERE city_id IN (SELECT id FROM cities WHERE organization_id=?) AND status<>'Cancelado' AND (${conditions.join(" OR ")}) LIMIT 1`, [a.organizationId, ...values]))[0];
        if (duplicate) throw new TerritoryError(`Este WhatsApp ou e-mail já está no atendimento de "${str(duplicate.name)}". Corrija o contato ou use o mesmo nome.`);
        outcome.lead = true;
      }
      if (r.saleStatus && !hasContact && !leadId) throw new TerritoryError("Para registrar a venda, informe o WhatsApp ou o e-mail (o atendimento precisa de um contato autorizado).");
      if (r.saleStatus) outcome.sale = true;

      if (commit) {
        if (!person) {
          const saved = await mutateTerritory(a, "person", { requestId: crypto.randomUUID(), cityId: r.cityId, name: r.name, placeId, placeLink, referrerId, regionId, authorized: true, confirmDuplicate: true }) as { id: string };
          person = { id: saved.id, name: r.name, referrerId };
        } else if (referrerId && !person.referrerId) {
          const result = await db.prepare(`WITH RECURSIVE ancestors(id,referrer_id) AS (SELECT id,referrer_id FROM territory_people WHERE id=? UNION SELECT p.id,p.referrer_id FROM territory_people p JOIN ancestors x ON p.id=x.referrer_id) UPDATE territory_people SET referrer_id=?,updated_at=? WHERE id=? AND referrer_id IS NULL AND NOT EXISTS(SELECT 1 FROM ancestors WHERE id=?)`).bind(referrerId, referrerId, brazilTimestamp(), person.id, person.id).run();
          if (!result.meta.changes) throw new TerritoryError("A indicação criaria um ciclo (a pessoa já está acima de quem a indicou). Confira a planilha.");
        }
        if (regionId && same[0]) await db.prepare("UPDATE territory_people SET region_id=?,updated_at=? WHERE id=? AND region_id IS NULL").bind(regionId, brazilTimestamp(), person.id).run();
        if (role) await mutateTerritory(a, "role", { personId: person.id, role, status: "Ativo", responsible: a.name || a.email, source: "Importação da rede por planilha", authorized: true });
        if (hasContact && !leadId) {
          await executeAction("create_lead", parseActionPayload("create_lead", { personId: person.id, cityId: r.cityId, name: r.name, email: r.email, whatsapp: r.whatsapp, status: "Lead válido", channel: r.referrer ? "Indicação" : "Outro", sourceLabel: "Importação da rede por planilha", consentAccepted: true, consentSource: `Planilha importada por ${a.name || a.email}`, consentPurpose: "Atendimento e mentoria" }), a);
          leadId = Number((await rows("SELECT id FROM leads WHERE person_id=? LIMIT 1", [person.id]))[0]?.id);
        }
        if (r.saleStatus && leadId) {
          await executeAction("record_sale", parseActionPayload("record_sale", { leadId, product: r.product || "Mentoria", amountCents: r.amountCents, status: r.saleStatus }), a);
          // A data da planilha é a data real do pagamento: vale para a linha do tempo e os gráficos por mês.
          if (r.paidAt) await db.prepare("UPDATE sales SET created_at=?,paid_at=CASE WHEN status='Pagamento confirmado' THEN ? ELSE paid_at END WHERE lead_id=?").bind(`${r.paidAt} 12:00:00`, `${r.paidAt} 12:00:00`, leadId).run();
        }
      }
      outcome.status = commit ? "Salvo" : "Válido";
    } catch (e) {
      outcome.ok = false;
      outcome.status = e instanceof TerritoryError || e instanceof ActionError ? e.message : e instanceof ZodError ? (e.issues[0]?.message ?? "Linha inválida.") : "Não foi possível salvar esta linha.";
    }
    output.push(outcome);
  }
  return { rows: output };
}
