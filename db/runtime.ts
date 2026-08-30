import { env } from "cloudflare:workers";

export function database() {
  if (!env.DB) throw new Error("Banco de dados indisponível.");
  return env.DB;
}

export function asNumber(value: unknown) {
  return Number(value ?? 0);
}

export function asNullableNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

export function brazilTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date).replace(" ", "T");
  return `${parts}-03:00`;
}

export async function audit(
  db: ReturnType<typeof database>,
  actorEmail: string,
  action: string,
  entityType: string,
  entityId: number | null,
  summary: string,
) {
  await db.prepare(`
    INSERT INTO audit_logs (actor_email, action, entity_type, entity_id, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(actorEmail, action, entityType, entityId, summary, brazilTimestamp()).run();
}
