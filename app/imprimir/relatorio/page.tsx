import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser, SIGN_IN_PATH } from "@/app/auth";
import { getTeamAccess } from "@/db/access";
import { logoVersion } from "@/db/identity";
import { REPORT_ROLES } from "@/db/report";
import { ORGANIZATION_HEADER, parseOrganizationId } from "@/lib/tenant-request";
import { PrintReport } from "@/app/imprimir/relatorio/print-report";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Relatório do mês — Elite Expansion X" };

/** Relatório executivo do mês em A4, para imprimir ou salvar em PDF. Só para a gestão. */
export default async function PrintReportPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect(SIGN_IN_PATH);
  const organizationId = parseOrganizationId((await headers()).get(ORGANIZATION_HEADER));
  const access = organizationId === undefined ? null : await getTeamAccess(user.email, user.displayName, organizationId);
  if (!access || !REPORT_ROLES.includes(access.role)) redirect("/");
  const query = (await searchParams) ?? {};
  const raw = Array.isArray(query.mes) ? query.mes[0] : query.mes;
  const month = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : null;
  const version = await logoVersion(access.organizationId);
  return <PrintReport logo={version ? `/api/organization-logo?org=${access.organizationId}&v=${encodeURIComponent(version)}` : null} organization={access.organizationName} author={access.name} initialMonth={month} />;
}
