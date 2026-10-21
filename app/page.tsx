import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {ORGANIZATION_HEADER, parseOrganizationId} from '@/lib/tenant-request';
import { getCurrentUser, SIGN_IN_PATH, signOutPath } from "@/app/auth";
import { ExpansionDashboard } from "@/app/expansion-dashboard";
import { getUserAccess, suspendedOrganizationOf } from "@/db/access";
import { getDashboardData } from "@/db/queries";
import { getPortalData } from "@/db/portal";
import { ClientPortal } from "@/app/client-portal";
import { isPortalRole } from "@/lib/expansion-types";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect(SIGN_IN_PATH);
  // Cada aba fica fixa na organização da sua URL (?org=). Sem ela, abrimos a
  // organização padrão do usuário e gravamos isso na URL, nunca em cookie.
  // O worker/index.ts copia o ?org= da URL para este header (ver lá o motivo).
  const organizationId = parseOrganizationId((await headers()).get(ORGANIZATION_HEADER));
  const access = organizationId === undefined ? null : await getUserAccess(user.email, user.displayName, organizationId);
  if (!access) {
    // Sem ?org= válido, ou link de uma organização fora do acesso desta pessoa:
    // leva para a organização padrão dela, se tiver alguma.
    const fallback = await getUserAccess(user.email, user.displayName, undefined);
    if (fallback && fallback.organizationId !== organizationId) redirect(`/?org=${fallback.organizationId}`);
  }

  if (!access) {
    const suspended = await suspendedOrganizationOf(user.email);
    return (
      <main className="elite-grid grid min-h-screen place-items-center bg-[#080807] px-5 text-zinc-100">
        <section className="elite-card max-w-xl p-8 text-center sm:p-10">
          <Image src="/elite-emblem.png" alt="Elite Frascaroli Academy — logo oficial" width={541} height={541} className="elite-brand-logo elite-brand-logo-access mx-auto mb-5" />
          {suspended ? <>
            <p className="section-kicker">Assinatura suspensa</p>
            <h1 className="text-2xl font-semibold text-white">O acesso da {suspended} está pausado</h1>
            <p className="mt-4 text-sm leading-6 text-zinc-400">A assinatura da plataforma de expansão da {suspended} está suspensa no momento. Todos os dados continuam guardados e voltam assim que a assinatura for reativada. Fale com o responsável pela sua empresa ou com a Elite.</p>
          </> : <>
            <p className="section-kicker">Acesso protegido</p>
            <h1 className="text-2xl font-semibold text-white">Seu perfil ainda não foi liberado</h1>
            <p className="mt-4 text-sm leading-6 text-zinc-400">Você entrou com {user.email}, mas este e-mail não possui uma função cadastrada na Elite Expansion X. Peça ao administrador para preparar seu perfil.</p>
          </>}
          <a href={signOutPath()} className="mt-6 inline-flex rounded-xl bg-[#c9a227] px-5 py-3 text-sm font-semibold text-black">{suspended ? "Sair" : "Sair e entrar com outro e-mail"}</a>
        </section>
      </main>
    );
  }

  // Mentorados e assinantes só têm o portal deles; nunca carregam os dados da equipe.
  if (isPortalRole(access.role)) return <ClientPortal initialData={await getPortalData(access)} signOutPath={signOutPath()} />;

  const data = await getDashboardData(access);

  return (
    <ExpansionDashboard
      initialData={data}
      userName={access.name}
      signOutPath={signOutPath()}
    />
  );
}
