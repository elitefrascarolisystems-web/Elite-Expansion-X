import { database } from "@/db/runtime";
import { isGuideKey, type GuideKey } from "@/lib/tab-guide-keys";

/**
 * "Já vi" dos guias "Como usar", na própria linha de app_users da pessoa
 * (id e organização juntos: nunca grava em outra pessoa nem em outra empresa).
 * A chave só entra uma vez; `instr` compara o texto exato, sem curinga.
 */
const MARK_SQL = `UPDATE app_users SET guides_seen = CASE
  WHEN guides_seen = '' THEN ?
  WHEN instr(',' || guides_seen || ',', ',' || ? || ',') > 0 THEN guides_seen
  ELSE guides_seen || ',' || ? END
  WHERE id = ? AND organization_id = ?`;

export class GuideError extends Error {}

export async function markGuideSeen(userId: number, organizationId: number, key: unknown): Promise<GuideKey> {
  if (!isGuideKey(key)) throw new GuideError("Guia desconhecido.");
  await database().prepare(MARK_SQL).bind(key, key, key, userId, organizationId).run();
  return key;
}

/** "Mostrar os guias de novo": todos os cartões voltam a aparecer. */
export async function resetGuides(userId: number, organizationId: number) {
  await database().prepare("UPDATE app_users SET guides_seen = '' WHERE id = ? AND organization_id = ?").bind(userId, organizationId).run();
}
