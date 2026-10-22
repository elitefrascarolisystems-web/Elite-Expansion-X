import type { Metadata } from "next";
import Link from "next/link";
import { unsubscribe } from "@/db/notifications";
import { NOTIFICATION_LABEL } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Avisos por e-mail — Elite Expansion X", robots: { index: false } };

/** Link "parar de receber" dos e-mails: desliga só aquele aviso, sem precisar entrar. */
export default async function LeaveNoticesPage({ searchParams }: { searchParams: Promise<{ t?: string; tipo?: string }> }) {
  const { t = "", tipo = "" } = await searchParams;
  const done = await unsubscribe(t, tipo).catch(() => null);
  return (
    <main className="elite-grid grid min-h-screen place-items-center bg-background px-4 text-zinc-100">
      <section className="elite-card w-full max-w-md p-7 text-center">
        <p className="section-kicker">Avisos por e-mail</p>
        <h1 className="text-2xl font-semibold text-white">{done ? "Pronto, aviso desligado" : "Link inválido"}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{done
          ? <>Você não vai mais receber o <strong className="text-zinc-200">{NOTIFICATION_LABEL[done.kind].toLowerCase()}</strong> de {done.organization}. Para ligar de novo, entre na plataforma e use o cartão “Avisos por e-mail” em Hoje.</>
          : "Este link não vale mais. Para mudar seus avisos, entre na plataforma e use o cartão “Avisos por e-mail” em Hoje."}</p>
        <Link href="/entrar" className="mt-6 inline-flex rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-black">Entrar na plataforma</Link>
      </section>
    </main>
  );
}
