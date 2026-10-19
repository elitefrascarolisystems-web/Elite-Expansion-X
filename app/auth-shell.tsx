import type { ReactNode } from "react";
import Image from "next/image";

/** Moldura das telas de entrada: marca à esquerda (no celular, em cima) e o formulário ao lado. */
export function AuthShell({ kicker, title, description, children }: { kicker: string; title: string; description: ReactNode; children: ReactNode }) {
  return (
    <main className="elite-grid min-h-screen bg-[#080807] text-zinc-100 lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-white/8 lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#c9a227]/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <Image src="/elite-academy-official.png" alt="Elite Frascaroli Academy — logo oficial" width={1080} height={1080} className="elite-brand-logo" />
          <div><p className="text-lg font-semibold tracking-tight text-white">Elite Expansion X</p><p className="text-sm text-zinc-500">Elite Frascaroli Academy</p></div>
        </div>
        <div className="relative max-w-lg">
          <p className="section-kicker">Operação privada</p>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">Expansão cidade por cidade.</h2>
          <p className="mt-5 text-base leading-7 text-zinc-400">Pessoas, embaixadores, leads, vendas e custos de cada cidade num só lugar, com cada organização vendo apenas os próprios dados.</p>
        </div>
        <p className="relative text-xs text-zinc-600">Acesso restrito a pessoas autorizadas. Cada entrada e alteração fica registrada.</p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/elite-academy-official.png" alt="Elite Frascaroli Academy — logo oficial" width={1080} height={1080} className="h-14 w-14 rounded-xl bg-black object-contain" />
            <div><p className="font-semibold tracking-tight text-white">Elite Expansion X</p><p className="text-xs text-zinc-500">Elite Frascaroli Academy</p></div>
          </div>
          <div className="elite-card p-7 sm:p-9">
            <p className="section-kicker">{kicker}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
            <div className="mt-2 text-sm leading-6 text-zinc-400">{description}</div>
            <div className="mt-7">{children}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
