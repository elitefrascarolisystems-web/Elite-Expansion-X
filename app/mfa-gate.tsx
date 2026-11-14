"use client";
/** A empresa exige verificação em duas etapas e esta pessoa ainda não ativou: só esta tela, até ativar. */
import { AccountSecurityPanel } from "@/app/account-security";

export function MfaGate({ organizationName, email, signOutPath }: { organizationName: string; email: string; signOutPath: string }) {
  return <main className="elite-grid grid min-h-screen place-items-center bg-background px-5 py-10 text-zinc-100">
    <section className="elite-card w-full max-w-lg p-6 sm:p-8">
      <p className="section-kicker">Segurança da conta</p>
      <h1 className="text-2xl font-semibold text-white">Ative a verificação em duas etapas</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-400">A {organizationName} exige a verificação em duas etapas de toda a equipe. Leva um minuto: você vai precisar do celular. Conta: {email}.</p>
      <div className="mt-6"><AccountSecurityPanel onEnabled={() => window.location.reload()} /></div>
      <a href={signOutPath} className="mt-6 inline-block text-sm text-subtle hover:underline">Sair</a>
    </section>
  </main>;
}
