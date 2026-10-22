import { brazilTimestamp, database } from "@/db/runtime";
import type { AccessView } from "@/lib/expansion-types";
import { sha256Hex } from "@/lib/password";
import { publicRequestSchema, requestUpdateSchema, REQUESTS_PER_HOUR, type RequestStatus, type SubscriptionRequestRow } from "@/lib/subscription-requests";

export class RequestError extends Error { constructor(message: string, public status = 400) { super(message); } }

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
function owner(a: AccessView) {
  if (!a.active || !a.isPlatformOwner) throw new RequestError("Somente os donos da plataforma veem os pedidos de assinatura.", 403);
}

/**
 * Recebe o pedido da página pública. Não guarda o IP: só um hash do IP com o
 * dia, que serve para limitar envios repetidos e muda a cada dia.
 */
export async function submitRequest(input: unknown, ip: string) {
  const v = publicRequestSchema.parse(input);
  // Robô preencheu o campo invisível: responde como se tivesse dado certo, sem guardar.
  if (v.website) return { ok: true };
  const now = brazilTimestamp(), db = database();
  const ipHash = await sha256Hex(`${ip || "sem-ip"}|${now.slice(0, 10)}|pedido-assinatura`);
  const hourAgo = brazilTimestamp(new Date(Date.now() - 3_600_000));
  const recent = (await db.prepare("SELECT COUNT(*) AS n FROM subscription_requests WHERE ip_hash=? AND created_at>?").bind(ipHash, hourAgo).all()).results[0];
  if (Number(recent?.n ?? 0) >= REQUESTS_PER_HOUR) throw new RequestError("Recebemos vários pedidos deste endereço agora há pouco. Tente de novo mais tarde ou fale com a Elite pelo WhatsApp.", 429);
  await db.prepare("INSERT INTO subscription_requests(id,company,contact_name,email,whatsapp,city,team_size,message,consent_at,ip_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), v.company, v.contactName, v.email, v.whatsapp, v.city, v.teamSize, v.message, now, ipHash, now, now).run();
  return { ok: true };
}

export async function listRequests(a: AccessView): Promise<SubscriptionRequestRow[]> {
  owner(a);
  const rows = (await database().prepare("SELECT * FROM subscription_requests ORDER BY CASE status WHEN 'Novo' THEN 0 WHEN 'Em conversa' THEN 1 ELSE 2 END, created_at DESC LIMIT 300").all()).results;
  return rows.map((r) => ({
    id: str(r.id), company: str(r.company), contactName: str(r.contact_name), email: str(r.email), whatsapp: str(r.whatsapp), city: str(r.city),
    teamSize: str(r.team_size), message: str(r.message), status: str(r.status) as RequestStatus, note: str(r.note),
    organizationId: r.organization_id === null || r.organization_id === undefined ? null : Number(r.organization_id), handledBy: str(r.handled_by), createdAt: str(r.created_at), updatedAt: str(r.updated_at),
  }));
}

/** Contagem para o aviso na área Plataforma. */
export async function newRequestCount(a: AccessView) {
  if (!a.active || !a.isPlatformOwner) return 0;
  return Number((await database().prepare("SELECT COUNT(*) AS n FROM subscription_requests WHERE status='Novo'").all()).results[0]?.n ?? 0);
}

export async function updateRequest(a: AccessView, input: unknown) {
  owner(a);
  const v = requestUpdateSchema.parse(input), now = brazilTimestamp();
  const result = await database().prepare("UPDATE subscription_requests SET status=?,note=?,organization_id=COALESCE(?,organization_id),handled_by=?,updated_at=? WHERE id=?")
    .bind(v.status, v.note, v.organizationId, a.email.toLowerCase(), now, v.id).run();
  if (!result.meta.changes) throw new RequestError("Pedido não encontrado. Atualize a página.", 404);
  return { ok: true };
}

/** Pedido descartado não precisa ficar guardado (LGPD: só o necessário). */
export async function deleteRequest(a: AccessView, id: unknown) {
  owner(a);
  if (typeof id !== "string") throw new RequestError("Pedido não encontrado.", 404);
  const result = await database().prepare("DELETE FROM subscription_requests WHERE id=?").bind(id).run();
  if (!result.meta.changes) throw new RequestError("Pedido não encontrado. Atualize a página.", 404);
  return { ok: true };
}
