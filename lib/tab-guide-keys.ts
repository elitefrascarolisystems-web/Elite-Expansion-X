import type { NavLocation } from "@/lib/navigation";

/**
 * Chaves dos guias "Como usar": uma por tela (`${area}/${view}`, a mesma chave
 * `here` de app/expansion-dashboard.tsx), "hoje/" para Hoje e uma por portal.
 * Fica separada do conteúdo (lib/tab-guides.ts) para o servidor validar a chave
 * sem carregar os textos.
 */
export const GUIDE_KEYS = [
  "hoje/",
  "territorio/mapa", "territorio/cidades", "territorio/locais",
  "vendas/agenda", "vendas/atendimentos", "vendas/ganchos", "vendas/fecha", "vendas/pagamentos", "vendas/posvenda",
  "rede/embaixadores", "rede/indicacoes", "rede/mentorados", "rede/parceiros", "rede/materiais",
  "resultados/visao", "resultados/metas", "resultados/mapeamento", "resultados/custos",
  "gestao/time", "gestao/regras", "gestao/identidade", "gestao/plano", "gestao/historico", "gestao/privacidade", "gestao/avisos", "gestao/assessoria",
  "plataforma/assinaturas", "plataforma/pedidos", "plataforma/assessores",
  "portal:embaixador", "portal:mentorado",
] as const;

export type GuideKey = (typeof GUIDE_KEYS)[number];

const KNOWN = new Set<string>(GUIDE_KEYS);

export const isGuideKey = (value: unknown): value is GuideKey => typeof value === "string" && KNOWN.has(value);

/** A chave do guia da tela atual (Hoje não tem sub-aba). */
export function guideKeyFor(location: NavLocation): GuideKey | null {
  const key = location.area === "hoje" ? "hoje/" : `${location.area}/${location.view}`;
  return isGuideKey(key) ? key : null;
}

/** "a,b,c" (coluna app_users.guides_seen) → só as chaves conhecidas, sem repetir. */
export function parseGuidesSeen(raw: unknown): GuideKey[] {
  if (typeof raw !== "string" || !raw) return [];
  return [...new Set(raw.split(",").map((item) => item.trim()).filter(isGuideKey))];
}

/** Chave da cópia do "já vi" no aparelho: por empresa e por login (o assessor tem a dele). */
export const guidesStorageKey = (organizationId: number, accessId: number) => `elite-guides-seen:${organizationId}:${accessId}`;
