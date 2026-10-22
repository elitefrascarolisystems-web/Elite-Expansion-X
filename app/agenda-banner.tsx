"use client";
import { useState } from "react";
import { AlarmClock, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgendaView } from "@/lib/expansion-types";

const when = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Na entrada: os retornos atrasados e os de hoje de quem está conectado, com atalho para cada um. */
export function AgendaBanner({ agenda, onOpen, onAll }: { agenda: AgendaView; onOpen: (leadId: number) => void; onAll: () => void }) {
  const [hidden, setHidden] = useState(false);
  if (hidden || (!agenda.late && !agenda.today)) return null;
  return <section aria-label="Sua agenda" className={`elite-card overflow-hidden ${agenda.late ? "border-red-400/25" : "border-gold/25"}`}>
    <div className="relative flex flex-wrap items-center gap-3 border-b border-white/8 py-4 pl-5 pr-12">
      <AlarmClock className={`size-5 ${agenda.late ? "text-red-300" : "text-gold-soft"}`} aria-hidden />
      <div className="mr-auto"><h2 className="font-semibold text-white">Sua agenda{agenda.late ? <span className="elite-live ml-2 align-middle text-red-300" aria-hidden /> : null}</h2><p className="text-sm text-zinc-400">{[agenda.late && `${agenda.late} ${agenda.late === 1 ? "retorno atrasado" : "retornos atrasados"}`, agenda.today && `${agenda.today} para hoje`, agenda.upcoming && `${agenda.upcoming} nos próximos dias`].filter(Boolean).join(" · ")}</p></div>
      <Button size="sm" onClick={onAll} className="bg-gold text-black">Abrir a agenda <ArrowRight /></Button>
      <Button size="icon" variant="ghost" aria-label="Esconder até a próxima entrada" onClick={() => setHidden(true)} className="absolute right-2 top-3 text-subtle"><X /></Button>
    </div>
    <ul className="grid gap-px bg-white/6 sm:grid-cols-2 xl:grid-cols-4">{agenda.items.slice(0, 4).map((item) => <li key={item.opportunityId} className="flex flex-col gap-1 bg-surface px-5 py-3">
      <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${item.late ? "text-red-300" : "text-gold-soft"}`}>{item.late ? `Atrasado · ${when(item.dueAt)}` : `Hoje · até ${when(item.dueAt).split(" ").pop()}`}</p>
      <p className="font-medium text-white">{item.leadName}</p>
      <p className="line-clamp-2 text-xs text-zinc-400">{item.nextAction || "Sem próximo passo definido"} · {item.cityName}</p>
      <Button size="sm" variant="ghost" onClick={() => onOpen(item.leadId)} className="mt-1 h-7 w-fit px-0 text-xs text-gold-soft hover:bg-transparent">Abrir atendimento <ArrowRight className="size-3" /></Button>
    </li>)}</ul>
  </section>;
}
