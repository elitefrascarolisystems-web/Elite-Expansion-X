import type { ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { BrandHero, OrbitalEmblem, Wordmark } from "@/app/brand-hero";

/** Moldura das telas de entrada: a marca em órbita à esquerda (no celular, em cima) e o formulário ao lado. */
export function AuthShell({ kicker, title, description, children }: { kicker: string; title: string; description: ReactNode; children: ReactNode }) {
  return (
    <main className="elite-auth min-h-screen text-zinc-100 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)]">
      <BrandHero />
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute -right-32 top-1/4 h-[30rem] w-[30rem] rounded-full bg-gold/[0.07] blur-3xl" />
        <div className="relative w-full max-w-md">
          {/* No celular a marca vem em cima, compacta. */}
          <div className="mb-8 flex flex-col items-center gap-4 lg:hidden">
            <OrbitalEmblem size="sm" />
            <Wordmark compact />
            <p className="max-w-xs text-center text-sm leading-6 text-zinc-400">Expansão com estratégia. <span className="elite-gold-text font-medium">Cidade por cidade.</span></p>
          </div>
          <div className="elite-auth-card">
            <div className="p-7 sm:p-9">
              <p className="section-kicker">{kicker}</p>
              <h1 className="text-[1.65rem] font-semibold tracking-tight text-white">{title}</h1>
              <div className="mt-2 text-sm leading-6 text-zinc-400">{description}</div>
              <div className="mt-7">{children}</div>
            </div>
            <p className="flex items-center justify-center gap-2 border-t border-white/6 px-6 py-3.5 text-[11px] tracking-wide text-subtle"><LockKeyhole className="size-3.5 text-gold/70" aria-hidden />Acesso restrito e registrado · sessão protegida de 24 horas</p>
          </div>
          <p className="mt-6 text-center text-[11px] uppercase tracking-[0.3em] text-subtle lg:hidden">Mais visão · Mais estratégia · Mais impacto</p>
        </div>
      </section>
    </main>
  );
}
