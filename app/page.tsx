import {cookies} from 'next/headers';
import {organizationIdFromCookie} from '@/lib/organization-selection';
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { ExpansionDashboard } from "@/app/expansion-dashboard";
import { getUserAccess } from "@/db/access";
import { getDashboardData } from "@/db/queries";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  const access = await getUserAccess(user.email, user.displayName,organizationIdFromCookie((await cookies()).get('elite-org')?`elite-org=${(await cookies()).get('elite-org')!.value}`:null));

  if (!access) {
    return (
      <main className="elite-grid grid min-h-screen place-items-center bg-[#080807] px-5 text-zinc-100">
        <section className="elite-card max-w-xl p-8 text-center sm:p-10">
          <Image src="/elite-academy-official.png" alt="Elite Frascaroli Academy — logo oficial" width={1080} height={1080} className="elite-brand-logo elite-brand-logo-access mx-auto mb-5" />
          <p className="section-kicker">Acesso protegido</p>
          <h1 className="text-2xl font-semibold text-white">Seu perfil ainda não foi liberado</h1>
          <p className="mt-4 text-sm leading-6 text-zinc-400">Você entrou com {user.email}, mas este e-mail não possui uma função cadastrada na Elite Expansion X. Peça ao administrador para preparar seu perfil.</p>
          <a href={chatGPTSignOutPath("/")} className="mt-6 inline-flex rounded-xl bg-[#c9a227] px-5 py-3 text-sm font-semibold text-black">Sair e usar outro e-mail</a>
        </section>
      </main>
    );
  }

  const data = await getDashboardData(access);

  return (
    <ExpansionDashboard
      initialData={data}
      userName={access.name}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
