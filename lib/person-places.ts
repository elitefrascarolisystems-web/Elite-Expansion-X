/*
 * Vínculo da pessoa com lugares: regras de LGPD que valem em todas as telas.
 * Vínculo sensível (igreja, ou clínica como paciente, membro ou mentorado) não aponta a pessoa no local:
 * até a gestão revisar, ela aparece no centro do bairro ou da cidade, e o nome do local só a gestão vê, marcado "a revisar".
 * A Etapa 5 amplia estas regras (lugares extras e confirmações).
 */
export const SENSITIVE_HEALTH_LINKS = ["Frequenta", "Membro do network", "Mentorado"] as const;

/** Verdadeiro quando o vínculo pessoa ↔ local é sensível. */
export function sensitiveLink(place: { sector?: string | null } | null | undefined, link: string | null | undefined): boolean {
  if (!place) return false;
  if (place.sector === "Religioso") return true;
  return place.sector === "Saúde" && (SENSITIVE_HEALTH_LINKS as readonly string[]).includes(String(link ?? ""));
}

/** A mesma regra em SQL: `b` é o local (businesses) e `tp` a pessoa (territory_people). */
export const sensitiveLinkSql = (b: string, tp: string) =>
  `(${b}.sector='Religioso' OR (${b}.sector='Saúde' AND ${tp}.place_link IN (${SENSITIVE_HEALTH_LINKS.map((v) => `'${v}'`).join(",")})))`;

/** Local "seguro" da pessoa: o local principal, ou NULL quando o vínculo é sensível. */
export const safePlaceSql = (tp: string) =>
  `(CASE WHEN EXISTS(SELECT 1 FROM businesses sbx WHERE sbx.id=${tp}.place_id AND ${sensitiveLinkSql("sbx", tp)}) THEN NULL ELSE ${tp}.place_id END)`;
