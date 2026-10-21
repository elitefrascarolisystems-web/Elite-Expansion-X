import "@/lib/zod-pt";
import { z } from "zod";
import { brazilTimestamp, database } from "@/db/runtime";
import { TenantError, validateLogo } from "@/db/tenant-admin";
import type { AccessView } from "@/lib/expansion-types";

/**
 * Identidade da empresa: nome e logo. A logo aparece na barra lateral e no mapa impresso.
 * A Elite (organização 1) usa sempre o emblema oficial.
 */
export const identitySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa.").max(120),
  /** null retira a logo; ausente mantém a atual. */
  logo: z.union([z.string().max(210000), z.null()]).optional(),
  official: z.boolean().default(false),
});

const first = async (sql: string, ...args: (string | number)[]) => (await database().prepare(sql).bind(...args).all()).results[0];

/** Versão da logo (data da última troca) para o navegador saber quando buscar de novo; null sem logo. */
export async function logoVersion(organizationId: number): Promise<string | null> {
  if (organizationId === 1) return null;
  const row = await first("SELECT updated_at FROM organization_profiles WHERE organization_id=? AND logo IS NOT NULL AND logo<>''", organizationId);
  return row ? String(row.updated_at) : null;
}

export async function getLogo(organizationId: number): Promise<{ type: string; bytes: Uint8Array } | null> {
  const row = await first("SELECT logo FROM organization_profiles WHERE organization_id=?", organizationId);
  const match = row?.logo ? /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(row.logo)) : null;
  if (!match) return null;
  const binary = atob(match[2]);
  return { type: match[1], bytes: Uint8Array.from(binary, (char) => char.charCodeAt(0)) };
}

export async function saveIdentity(access: AccessView, input: unknown) {
  if (!access.active || access.role !== "Administrador") throw new TenantError("Somente o administrador altera a identidade da empresa.", 403);
  if (access.organizationId === 1) throw new TenantError("A Elite usa sempre o emblema oficial.", 400);
  const v = identitySchema.parse(input);
  const org = access.organizationId;
  if (v.logo) await validateLogo(org, v.logo, v.official);
  const db = database(), now = brazilTimestamp();
  const keepLogo = v.logo === undefined;
  await db.batch([
    db.prepare("UPDATE organizations SET name=? WHERE id=?").bind(v.name, org),
    keepLogo
      ? db.prepare("INSERT INTO organization_profiles(organization_id,updated_at) VALUES(?,?) ON CONFLICT(organization_id) DO NOTHING").bind(org, now)
      : db.prepare("INSERT INTO organization_profiles(organization_id,logo,updated_at) VALUES(?,?,?) ON CONFLICT(organization_id) DO UPDATE SET logo=excluded.logo,updated_at=excluded.updated_at").bind(org, v.logo ?? null, now),
    db.prepare("INSERT INTO audit_logs(organization_id,actor_email,action,entity_type,summary,created_at) VALUES(?,?,'organization_identity','organization',?,?)")
      .bind(org, access.email, keepLogo ? `Nome da empresa: ${v.name}.` : v.logo ? `Nome e logo da empresa atualizados (${v.name}).` : `Logo da empresa retirada.`, now),
  ]);
  return { name: v.name, logoVersion: await logoVersion(org) };
}
