/**
 * Acesso da Assessoria Elite: a empresa cliente libera, dá prazo ou desliga, e vê os acessos no Histórico.
 * A organização principal (Elite) não tem assessoria (a equipe dela entra por vínculo próprio).
 */
import { audit, brazilTimestamp, database } from "@/db/runtime";
import { ADVISORY_MODES, advisoryAllowed, advisoryLabel, type AdvisoryMode, type AdvisoryPolicy } from "@/lib/advisory";
import type { AccessView } from "@/lib/expansion-types";
import { z } from "zod";

export class AdvisoryError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function getAdvisoryPolicy(access: AccessView): Promise<AdvisoryPolicy> {
  if (access.organizationId === 1) throw new AdvisoryError("A organização principal não tem assessoria.", 404);
  if (access.role !== "Administrador") throw new AdvisoryError("Só o administrador da empresa vê esta regra.", 403);
  const db = database();
  const org = (await db.prepare("SELECT advisory_mode,advisory_until,advisory_changed_by,advisory_changed_at FROM organizations WHERE id=?").bind(access.organizationId).all()).results[0] ?? {};
  const mode = (ADVISORY_MODES as readonly string[]).includes(String(org.advisory_mode)) ? String(org.advisory_mode) as AdvisoryMode : "liberado";
  const until = org.advisory_until ? String(org.advisory_until) : null, today = brazilTimestamp().slice(0, 10);
  const events = (await db.prepare(`SELECT created_at,actor_email,action,summary FROM audit_logs WHERE organization_id=? AND action IN ('advisory_access','advisory_policy') ORDER BY created_at DESC, id DESC LIMIT 20`).bind(access.organizationId).all()).results
    .map((r) => ({ at: String(r.created_at), actor: String(r.actor_email), action: String(r.action), summary: String(r.summary) }));
  return { mode, until, allowed: advisoryAllowed(mode, until, today), label: advisoryLabel(mode, until, today), changedBy: String(org.advisory_changed_by ?? ""), changedAt: org.advisory_changed_at ? String(org.advisory_changed_at) : null, events };
}

const input = z.object({
  mode: z.enum(ADVISORY_MODES),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).superRefine((v, ctx) => { if (v.mode === "prazo" && !v.until) ctx.addIssue({ code: "custom", path: ["until"], message: "Escolha até quando o acesso fica liberado." }); });

/** Só o administrador da própria empresa (nunca a assessoria) muda a regra. Fica no Histórico. */
export async function setAdvisoryPolicy(access: AccessView, raw: unknown): Promise<void> {
  if (access.organizationId === 1) throw new AdvisoryError("A organização principal não tem assessoria.", 404);
  if (access.role !== "Administrador" || access.isAdvisory) throw new AdvisoryError("Só o administrador da empresa decide o acesso da assessoria.", 403);
  const v = input.parse(raw), today = brazilTimestamp().slice(0, 10);
  if (v.mode === "prazo" && String(v.until) < today) throw new AdvisoryError("Escolha uma data de hoje em diante.");
  const until = v.mode === "prazo" ? String(v.until) : null;
  const db = database();
  await db.prepare("UPDATE organizations SET advisory_mode=?,advisory_until=?,advisory_changed_by=?,advisory_changed_at=? WHERE id=?")
    .bind(v.mode, until, access.email.toLowerCase(), brazilTimestamp(), access.organizationId).run();
  await audit(db, access.organizationId, access.email, "advisory_policy", "organization", access.organizationId, `Acesso da Assessoria Elite: ${advisoryLabel(v.mode, until, today).toLowerCase()}.`);
}
