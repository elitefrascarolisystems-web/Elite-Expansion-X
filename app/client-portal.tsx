"use client";
import Image from "next/image";
import { useState } from "react";
import { BookOpen, CalendarClock, Check, ExternalLink, GraduationCap, HeartHandshake, LoaderCircle, LogOut, Mail, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { PortalData } from "@/lib/portal";
import { tenantFetch } from "@/lib/tenant-request";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const when = (value: string) => capitalize(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value.length === 16 ? `${value}:00-03:00` : value)));
const shortDate = (value: string) => { const [d] = value.split(/[ T]/); const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const statusTone: Record<string, string> = { "Recebida": "text-zinc-300 border-white/12", "Em conversa": "text-sky-200 border-sky-400/30", "Virou cliente": "text-emerald-300 border-emerald-400/30" };

async function post(action: string, data: unknown) {
  const response = await tenantFetch("/api/portal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível concluir.");
  return result;
}

/** Área do mentorado ou da empresa assinante: jornada, próximo encontro, materiais e indicações. */
export function ClientPortal({ initialData, signOutPath }: { initialData: PortalData; signOutPath: string }) {
  const [data, setData] = useState(initialData);
  const [busyStep, setBusyStep] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [showWelcome, setShowWelcome] = useState(!initialData.member.welcomed);
  const m = data.member, firstName = m.name.split(" ")[0];
  const done = data.steps.filter((s) => s.doneAt).length;

  async function reload() {
    const response = await tenantFetch("/api/portal");
    const result = await response.json().catch(() => ({}));
    if (response.ok) setData(result.data);
  }
  async function toggle(stepId: number, value: boolean) {
    setBusyStep(stepId);
    try { await post("step", { stepId, done: value }); await reload(); if (value) toast.success("Etapa concluída. Continue assim!"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar. Confira a conexão e tente de novo."); }
    finally { setBusyStep(null); }
  }
  async function refer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, f = new FormData(form);
    setSending(true);
    try {
      await post("refer", { name: f.get("name"), whatsapp: f.get("whatsapp"), email: f.get("email"), cityId: Number(f.get("cityId")), note: f.get("note"), consent: f.get("consent") === "on" });
      form.reset(); await reload();
      toast.success(`Indicação enviada. A equipe ${m.organizationName} vai entrar em contato. Obrigado!`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível enviar."); }
    finally { setSending(false); }
  }
  function closeWelcome() { setShowWelcome(false); post("welcome", {}).catch(() => undefined); }

  return <main className="elite-auth min-h-screen text-zinc-100">
    <header className="sticky top-0 z-30 border-b border-white/8 bg-[#050504]/85 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3"><Image src="/elite-emblem.png" alt="Elite Expansion X" width={541} height={541} className="elite-brand-logo" /><div><p className="font-semibold tracking-tight text-white">Elite Expansion X</p><p className="text-xs text-subtle">Portal do Mentorado · {m.organizationName}</p></div></div>
      <Button asChild variant="ghost" size="icon" className="text-zinc-400 hover:bg-white/5 hover:text-white"><a href={signOutPath} aria-label="Sair"><LogOut /></a></Button>
    </div></header>

    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <section className="mb-8">
        <p className="section-kicker">Mentoria · {m.organizationName}</p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Olá, {firstName}. <span className="elite-gold-text">Vamos crescer juntos.</span></h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {m.mentorshipCycle > 0 && <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-violet-200"><GraduationCap className="mr-1 inline size-3.5" />Mentoria · {m.mentorshipCycle}º ciclo</span>}
                    {data.place && <span className="rounded-full border border-white/12 px-3 py-1 text-zinc-300">{data.place.name} · {data.place.link}</span>}
          {m.cityName && <span className="rounded-full border border-white/12 px-3 py-1 text-zinc-400">{m.cityName}</span>}
        </div>
      </section>

      {showWelcome && <section className="elite-card mb-6 flex items-start gap-4 border-gold/25 p-5" aria-label="Boas-vindas">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-gold-soft" aria-hidden />
        <div className="flex-1 text-sm leading-6 text-zinc-300"><p className="font-semibold text-white">Bem-vindo(a) ao seu portal de mentoria.</p><p>Aqui você acompanha sua jornada, vê o próximo encontro, acessa os materiais e indica pessoas que podem crescer com a {m.organizationName}. Marque cada etapa quando concluir.</p></div>
        <Button size="icon" variant="ghost" aria-label="Fechar boas-vindas" onClick={closeWelcome} className="text-subtle"><X /></Button>
      </section>}

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          <article className="elite-card p-6" aria-label="Sua jornada">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="section-kicker">Sua jornada</p><h2 className="text-xl font-semibold text-white">{data.steps.length ? `${done} de ${data.steps.length} etapas concluídas` : "Jornada em preparação"}</h2></div>{data.steps.length > 0 && <span className="text-2xl font-semibold text-gold-soft">{Math.round((done / data.steps.length) * 100)}%</span>}</div>
            {data.steps.length > 0 && <Progress aria-label="Jornada concluída" value={(done / data.steps.length) * 100} className="mt-4 h-1.5 bg-white/8" />}
            {data.steps.length ? <ol className="mt-5 grid gap-2">{data.steps.map((step, index) => <li key={step.id} className={`flex items-start gap-3 rounded-xl border p-3.5 ${step.doneAt ? "border-emerald-400/20 bg-emerald-400/[0.04]" : "border-white/8 bg-white/[0.02]"}`}>
              <button type="button" disabled={busyStep === step.id} onClick={() => toggle(step.id, !step.doneAt)} aria-pressed={Boolean(step.doneAt)} aria-label={step.doneAt ? `Desmarcar ${step.title}` : `Concluir ${step.title}`} className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition ${step.doneAt ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-200" : "border-gold/40 text-gold-soft hover:bg-gold/10"}`}>{busyStep === step.id ? <LoaderCircle className="size-3.5 animate-spin" /> : step.doneAt ? <Check className="size-3.5" /> : index + 1}</button>
              <div className="min-w-0"><p className={`font-medium ${step.doneAt ? "text-zinc-400 line-through decoration-emerald-400/40" : "text-white"}`}>{step.title}</p>{step.description && <p className="mt-0.5 text-sm leading-6 text-zinc-400">{step.description}</p>}{step.doneAt && <p className="mt-1 text-xs text-emerald-300/80">Concluída em {shortDate(step.doneAt)}</p>}</div>
            </li>)}</ol> : <p className="mt-3 text-sm leading-6 text-zinc-400">A equipe está preparando as etapas da sua jornada. Elas aparecem aqui assim que estiverem prontas.</p>}
          </article>

          <article className="elite-card p-6" aria-label="Materiais">
            <p className="section-kicker">Materiais</p><h2 className="text-xl font-semibold text-white">Para você usar agora</h2>
            {data.materials.length ? <ul className="mt-4 grid gap-2 sm:grid-cols-2">{data.materials.map((item) => <li key={item.id} className="flex flex-col gap-1 rounded-xl border border-white/8 bg-white/[0.02] p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">{item.type}</span><span className="font-medium text-white">{item.title}</span>{item.instructions && <span className="line-clamp-3 text-xs leading-5 text-zinc-400">{item.instructions}</span>}{item.url && <a href={item.url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex w-fit items-center gap-1 text-xs font-medium text-gold-soft hover:underline">Abrir material <ExternalLink className="size-3" /></a>}</li>)}</ul>
              : <p className="mt-3 flex items-center gap-2 text-sm text-zinc-400"><BookOpen className="size-4 text-subtle" />Nenhum material liberado ainda.</p>}
          </article>
        </div>

        <div className="space-y-5">
          <article className="elite-card p-6" aria-label="Próximo encontro">
            <p className="section-kicker">Próximo encontro</p>
            {data.nextMeeting ? <><p className="flex items-start gap-2 text-lg font-semibold text-white"><CalendarClock className="mt-1 size-5 shrink-0 text-gold-soft" />{when(data.nextMeeting.at)}</p>{data.nextMeeting.note && <p className="mt-2 text-sm leading-6 text-zinc-400">{data.nextMeeting.note}</p>}</>
              : <p className="text-sm leading-6 text-zinc-400">Ainda sem data marcada. Seu contato vai combinar com você.</p>}
            {data.owner && <div className="mt-5 border-t border-white/8 pt-4"><p className="text-xs uppercase tracking-[0.14em] text-subtle">Seu contato na {m.organizationName}</p><p className="mt-1 font-medium text-white">{data.owner.name}</p>{data.owner.title && <p className="text-xs text-subtle">{data.owner.title}</p>}<a href={`mailto:${data.owner.email}`} className="mt-2 inline-flex items-center gap-1.5 text-sm text-gold-soft hover:underline"><Mail className="size-4" />{data.owner.email}</a></div>}
          </article>

          <article className="elite-card p-6" aria-label="Indicar alguém">
            <p className="section-kicker">Indique e fortaleça a rede</p><h2 className="flex items-center gap-2 text-xl font-semibold text-white"><HeartHandshake className="size-5 text-gold-soft" />Indicar alguém</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">Conhece alguém que pode crescer com a {m.organizationName}? Indique aqui; a equipe entra em contato.</p>
            <form onSubmit={refer} className="mt-4 grid gap-3 text-sm">
              <label className="grid gap-1">Nome<input name="name" required minLength={2} maxLength={120} className="commercial-input" /></label>
              <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1">WhatsApp<input name="whatsapp" inputMode="tel" maxLength={30} placeholder="(31) 9 9999-9999" className="commercial-input" /></label><label className="grid gap-1">E-mail<input name="email" type="email" maxLength={254} className="commercial-input" /></label></div>
              <label className="grid gap-1">Cidade<select name="cityId" required defaultValue={data.cities.find((c) => c.name === m.cityName)?.id ?? data.cities[0]?.id} className="commercial-input">{data.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="grid gap-1">Algo que ajude o primeiro contato (opcional)<input name="note" maxLength={500} placeholder="Ex.: tem uma loja e quer expandir" className="commercial-input" /></label>
              <label className="flex items-start gap-2 text-zinc-300"><input name="consent" type="checkbox" required className="mt-1" />Essa pessoa sabe da indicação e autorizou o contato da {m.organizationName}.</label>
              <Button type="submit" disabled={sending} className="bg-gold text-black">{sending ? <LoaderCircle className="animate-spin" /> : <Send />} Enviar indicação</Button>
            </form>
            {data.referrals.length > 0 && <div className="mt-5 border-t border-white/8 pt-4"><p className="mb-2 text-xs uppercase tracking-[0.14em] text-subtle">Suas indicações ({data.referrals.length})</p><ul className="grid gap-1.5">{data.referrals.slice(0, 8).map((r, i) => <li key={i} className="flex items-center justify-between gap-2 text-sm"><span className="truncate text-zinc-200">{r.name}</span><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${statusTone[r.status]}`}>{r.status}</span></li>)}</ul></div>}
          </article>
        </div>
      </div>
    </div>
  </main>;
}
