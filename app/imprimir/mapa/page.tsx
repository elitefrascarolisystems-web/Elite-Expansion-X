import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser, SIGN_IN_PATH } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { ORGANIZATION_HEADER, parseOrganizationId } from "@/lib/tenant-request";
import { PrintMap } from "@/app/imprimir/mapa/print-map";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mapa para imprimir — Elite Expansion X" };

/** Mapa territorial de uma cidade em A3, para imprimir ou salvar em PDF. Só para a equipe. */
export default async function PrintMapPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect(SIGN_IN_PATH);
  const organizationId = parseOrganizationId((await headers()).get(ORGANIZATION_HEADER));
  const access = organizationId === undefined ? null : await getTeamAccess(user.email, user.displayName, organizationId);
  if (!access) redirect("/");
  const query = (await searchParams) ?? {};
  const city = Number(Array.isArray(query.city) ? query.city[0] : query.city);
  return <PrintMap organization={access.organizationName} author={access.name} initialCity={Number.isSafeInteger(city) && city > 0 ? city : null} />;
}
