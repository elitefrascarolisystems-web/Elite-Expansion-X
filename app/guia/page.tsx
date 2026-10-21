import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MAPPER_GUIDE } from "@/lib/mapper-guide";

export const metadata: Metadata = { title: "Guia do mapeador — Elite Expansion X" };

/** Página pública e sem dados: pode ser enviada junto com o convite. */
export default function MapperGuidePage() {
  return (
    <main className="elite-grid min-h-screen bg-[#080807] px-4 py-8 text-zinc-100 sm:px-6 lg:py-12">
      <article className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center gap-4">
          <Image src="/elite-emblem.png" alt="Elite Frascaroli Academy — logo oficial" width={541} height={541} className="elite-brand-logo" />
          <div><p className="section-kicker">Elite Expansion X</p><h1 className="text-3xl font-semibold tracking-tight text-white">Guia do mapeador</h1><p className="mt-1 text-sm text-zinc-400">O que fazer, em que ordem e as regras do mapeamento.</p></div>
        </header>
        <div className="grid gap-4">
          {MAPPER_GUIDE.map((section) => {
            const List = section.ordered ? "ol" : "ul";
            return (
              <section key={section.title} className="elite-card p-5 sm:p-6">
                <h2 className="mb-3 text-lg font-semibold text-white">{section.title}</h2>
                <List className={`grid gap-2 pl-5 text-sm leading-6 text-zinc-300 ${section.ordered ? "list-decimal marker:font-semibold marker:text-[#d6b94f]" : "list-disc marker:text-[#c9a227]"}`}>
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </List>
              </section>
            );
          })}
        </div>
        <footer className="mt-8 flex flex-wrap gap-3 text-sm"><Link href="/entrar" className="rounded-lg bg-[#c9a227] px-4 py-2 font-medium text-black">Entrar na plataforma</Link><Link href="/" className="rounded-lg border border-white/10 px-4 py-2 text-zinc-200">Voltar ao painel</Link></footer>
      </article>
    </main>
  );
}
