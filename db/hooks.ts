import { ZodError } from "zod";
import { brazilTimestamp, database } from "@/db/runtime";
import type { AccessView } from "@/lib/expansion-types";
import { hookSchema, MAX_HOOK_IMPORT, type HookRecord } from "@/lib/hooks";

export class HookError extends Error { constructor(message: string, public status = 400) { super(message); } }

/** A gestão (administrador, coordenação, liderança) monta o banco; o Comercial usa os aprovados. */
const canEdit = (a: AccessView) => a.active && a.canManageContent;

export async function listHooks(a: AccessView): Promise<{ hooks: HookRecord[]; canEdit: boolean }> {
  const editor = canEdit(a);
  const rows = (await database().prepare(`SELECT * FROM prospect_hooks WHERE organization_id=? ${editor ? "" : "AND status='Aprovado'"} ORDER BY situation, title LIMIT 500`).bind(a.organizationId).all()).results;
  return {
    canEdit: editor,
    hooks: rows.map((r) => ({ id: Number(r.id), title: String(r.title), situation: String(r.situation) as HookRecord["situation"], channel: String(r.channel) as HookRecord["channel"], sector: String(r.sector) as HookRecord["sector"], body: String(r.body), status: String(r.status) as HookRecord["status"], createdBy: String(r.created_by), updatedAt: String(r.updated_at) })),
  };
}

export async function saveHook(a: AccessView, input: unknown) {
  if (!canEdit(a)) throw new HookError("Somente a gestão cadastra e aprova ganchos.", 403);
  const v = hookSchema.parse(input), db = database(), now = brazilTimestamp();
  if (v.id) {
    const result = await db.prepare("UPDATE prospect_hooks SET title=?,situation=?,channel=?,sector=?,body=?,status=?,updated_at=? WHERE id=? AND organization_id=?")
      .bind(v.title, v.situation, v.channel, v.sector, v.body, v.status, now, v.id, a.organizationId).run();
    if (!result.meta.changes) throw new HookError("Gancho fora do seu acesso.", 403);
    return { id: v.id };
  }
  const result = await db.prepare("INSERT INTO prospect_hooks(organization_id,title,situation,channel,sector,body,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .bind(a.organizationId, v.title, v.situation, v.channel, v.sector, v.body, v.status, a.email, now, now).run();
  return { id: Number(result.meta.last_row_id) };
}

/** Importa até 50 ganchos de uma vez, como rascunho (a gestão aprova depois). */
export async function importHooks(a: AccessView, input: unknown) {
  if (!canEdit(a)) throw new HookError("Somente a gestão cadastra e aprova ganchos.", 403);
  const rows = Array.isArray((input as { rows?: unknown })?.rows) ? (input as { rows: unknown[] }).rows : null;
  if (!rows || rows.length < 1 || rows.length > MAX_HOOK_IMPORT) throw new HookError(`Importe de 1 a ${MAX_HOOK_IMPORT} ganchos por vez.`);
  const parsed = rows.map((row, index) => { try { return { line: index + 1, value: hookSchema.parse({ ...(row as object), status: "Rascunho" }) }; } catch (error) { return { line: index + 1, error: error instanceof ZodError ? error.issues[0]?.message ?? "Linha inválida." : "Linha inválida." }; } });
  const invalid = parsed.filter((p) => "error" in p);
  if (invalid.length) return { saved: 0, errors: invalid.map((p) => ({ line: p.line, error: (p as { error: string }).error })) };
  const db = database(), now = brazilTimestamp();
  await db.batch(parsed.map((p) => { const v = (p as { value: ReturnType<typeof hookSchema.parse> }).value; return db.prepare("INSERT INTO prospect_hooks(organization_id,title,situation,channel,sector,body,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,'Rascunho',?,?,?)").bind(a.organizationId, v.title, v.situation, v.channel, v.sector, v.body, a.email, now, now); }));
  return { saved: parsed.length, errors: [] };
}
