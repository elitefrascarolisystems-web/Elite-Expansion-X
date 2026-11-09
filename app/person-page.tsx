"use client";
/*
 * Página da pessoa: abre por cima da tela atual (&ficha=pessoa:<id>). No computador, painel largo
 * à direita; no celular, tela cheia. Título, foco preso e Esc vêm do Sheet. Sem contato e sem
 * coordenada: o envio continua pela ficha do atendimento. Não pode ser impressa nem exportada.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ArrowLeft, CircleHelp, Copy, Link2, MapPin, MessageSquare, Pencil, Sparkles, WifiOff, X } from "lucide-react";
import { toast } from "sonner";

import { HookPicker } from "@/app/hooks-bank";
import { Segmented } from "@/components/elite/segmented";
import { TabGuideBody, TabGuideCard } from "@/components/elite/tab-guide";
import { Timeline } from "@/components/elite/timeline";
import { LinkPlaceDialog, PlanDialog, SituationBadge, VisitDialog, type PlantPlace, type PlantPerson } from "@/app/plant-dialogs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { PersonPage } from "@/db/person-page";
import { copyText } from "@/lib/copy-text";
import type { AccessView } from "@/lib/expansion-types";
import type { HookContext } from "@/lib/hooks";
import { shortDate } from "@/lib/goal-calculator";
import { timelineTone } from "@/lib/person-timeline";
import type { ResolvedGuide } from "@/lib/tab-guides";
import { tenantFetch } from "@/lib/tenant-request";

export type PersonPageAction =
  | { type: "map" | "edit" | "interaction"; personId: string }
  | { type: "followup" | "sale"; leadId: number }
  | { type: "start"; person: { id: string; name: string; cityId: number; cityName: string; placeName?: string } }
  | { type: "go"; target: string }
  /** Ver no mapa a ficha do local (não a da pessoa) e abrir o mapeamento guiado já no local. */
  | { type: "mapKey"; key: string } | { type: "mapear"; businessId?: string };

type Part = "resumo" | "lugares" | "historico";
const LEVEL_HELP: Record<string, string> = { Cliente: "Cliente: pagamento confirmado", Indicador: "Indicador: indicou alguém", Multiplicador: "Multiplicador: alguém que ela indicou comprou" };
const COMPACT = "(max-width: 760px)";
const subscribe = (fn: () => void) => { const q = window.matchMedia(COMPACT); q.addEventListener("change", fn); return () => q.removeEventListener("change", fn); };
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function readPart(key: string): Part { try { const v = localStorage.getItem(key); return v === "lugares" || v === "historico" ? v : "resumo"; } catch { return "resumo"; } }

export function PersonPageSheet({ personId, access, organizationName, guide, guideSeen, onGuideSeen, onClose, onAction }: {
  personId: string | null; access: AccessView; organizationName: string;
  guide: ResolvedGuide | null; guideSeen: boolean; onGuideSeen: () => void;
  onClose: () => void; onAction: (action: PersonPageAction) => void;
}) {
  const compact = useSyncExternalStore(subscribe, () => window.matchMedia(COMPACT).matches, () => false);
  return <Sheet open={personId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
    <SheetContent side="right" showCloseButton={false} className="w-full max-w-none gap-0 overflow-y-auto border-white/10 bg-zinc-950 p-0 text-white sm:max-w-[760px]" style={compact ? { width: "100vw" } : undefined}>
      {personId && <Body key={personId} personId={personId} access={access} organizationName={organizationName} guide={guide} guideSeen={guideSeen} onGuideSeen={onGuideSeen} onAction={onAction} />}
    </SheetContent>
  </Sheet>;
}

function Body({ personId, access, organizationName, guide, guideSeen, onGuideSeen, onAction }: {
  personId: string; access: AccessView; organizationName: string; guide: ResolvedGuide | null; guideSeen: boolean; onGuideSeen: () => void; onAction: (action: PersonPageAction) => void;
}) {
  const [state, setState] = useState<{ data?: PersonPage; error?: string; offline?: boolean }>({});
  const [full, setFull] = useState(false);
  const partKey = `elite-person-part:${access.id}`;
  const [part, setPartState] = useState<Part>(() => readPart(partKey));
  const [showGuide, setShowGuide] = useState(false);
  const [hook, setHook] = useState<HookContext | null>(null);
  const [plan, setPlan] = useState<PlantPlace | null>(null);
  const [visit, setVisit] = useState<PlantPlace | null>(null);
  const [linking, setLinking] = useState(false);
  const [busyPlace, setBusyPlace] = useState("");
  const setPart = (value: Part) => { setPartState(value); try { localStorage.setItem(partKey, value); } catch { /* aparelho sem armazenamento: só nesta visita */ } };

  const fetchPage = useCallback((all: boolean) => tenantFetch(`/api/territory/person?id=${encodeURIComponent(personId)}${all ? "&all=1" : ""}`, { cache: "no-store" })
    .then(async (r) => { const body = await r.json().catch(() => ({})); return r.ok ? { data: body.data as PersonPage } : { error: String(body.error || "Não foi possível abrir a página agora.") }; })
    .catch(() => ({ offline: true })), [personId]);
  useEffect(() => { let live = true; fetchPage(false).then((next) => { if (live) setState(next); }); return () => { live = false; }; }, [fetchPage]);
  const load = (all: boolean) => fetchPage(all).then(setState);

  const p = state.data;
  const title = p?.name ?? (state.error ? "Página da pessoa" : "Carregando…");
  const header = <div className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/95 px-5 pb-4 pt-5 backdrop-blur">
    <div className="flex items-start justify-between gap-3"><SheetTitle className="text-2xl font-semibold text-white">{title}</SheetTitle>
      <SheetClose asChild><Button size="icon" variant="ghost" aria-label="Fechar a página da pessoa" title="Fechar (Esc)"><X /></Button></SheetClose></div>
    <SheetDescription className="sr-only">Página da pessoa: resumo, lugares e histórico.</SheetDescription>
    {p && <>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {p.level && <span className="elite-guide-badge" title={LEVEL_HELP[p.level]}>{p.level}</span>}
        {p.level && <span className="text-zinc-400">{LEVEL_HELP[p.level]}</span>}
        {p.badges.map((b) => <span key={b} className="rounded-full border border-white/15 px-2 py-0.5 text-zinc-200">{b}</span>)}
      </div>
      <p className="mt-2 text-sm text-zinc-300">{p.cityName}{p.regionName ? ` · ${p.regionName}` : ""}</p>
      <p className="text-sm text-zinc-400">No mapa: {p.onMap.kind === "local" ? p.onMap.name : p.onMap.kind === "bairro" ? `centro do bairro ${p.onMap.name}` : "centro da cidade"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onAction({ type: "map", personId: p.id })}><MapPin /> Ver no mapa</Button>
        {p.can.edit && <Button size="sm" variant="outline" onClick={() => onAction({ type: "edit", personId: p.id })}><Pencil /> Editar</Button>}
        {/* Uma regra só (simplificação, parte 4): com atendimento, a conversa é registrada no acompanhamento; sem, vira interação no mapa. */}
        {p.can.edit && <Button size="sm" variant="outline" onClick={() => { const live = p.attendance && !p.attendance.hidden ? p.attendance : null; if (live) onAction({ type: "followup", leadId: live.leadId }); else onAction({ type: "interaction", personId: p.id }); }}><MessageSquare /> Registrar interação</Button>}
        <Button size="sm" variant="outline" onClick={async () => { if (await copyText(window.location.href)) toast.success("Link copiado."); else toast.error("Não foi possível copiar."); }}><Link2 /> Copiar link</Button>
        {guide && <Button size="sm" variant="ghost" aria-label="Como usar" onClick={() => setShowGuide(true)}><CircleHelp /><span className="hidden sm:inline">Como usar</span></Button>}
      </div>
    </>}
  </div>;

  if (state.offline) return <>{header}<p className="m-5 flex items-center gap-2 text-sm text-zinc-300"><WifiOff className="size-4 text-amber-200" aria-hidden />Sem conexão: a página da pessoa precisa da internet (não mostramos dados velhos).</p></>;
  if (state.error) return <>{header}<p role="alert" className="m-5 text-sm text-zinc-300">{state.error}</p></>;
  if (!p) return <>{header}<p role="status" className="m-5 text-sm text-subtle">Carregando a página…</p></>;

  // "Ver como usar": o guia aparece dentro da página, no lugar do conteúdo, com "Voltar".
  if (showGuide && guide) return <>{header}<div className="pt-4">
    <Button size="sm" variant="ghost" className="mx-4 mb-2" onClick={() => { setShowGuide(false); onGuideSeen(); }}><ArrowLeft /> Voltar</Button>
    <h3 className="px-4 pb-3 text-lg font-semibold">{guide.titulo}</h3>
    <TabGuideBody guide={guide} onClose={() => { setShowGuide(false); onGuideSeen(); }} />
  </div></>;

  const runNext = () => {
    const a = p.attendance && !p.attendance.hidden ? p.attendance : null;
    switch (p.next.action) {
      case "registrar-retorno": case "abrir-acompanhamento": case "continuar-fecha": if (a) onAction({ type: "followup", leadId: a.leadId }); break;
      case "iniciar-atendimento": onAction({ type: "start", person: { id: p.id, name: p.name, cityId: p.cityId, cityName: p.cityName, placeName: p.place?.name } }); break;
      case "pedir-indicacao": setHook({ name: p.name, city: p.cityName, owner: a?.ownerName ?? "", organization: organizationName, place: p.place?.name, sector: p.place?.sector }); break;
      case "marcar-encontro": onAction({ type: "go", target: "rede/mentorados" }); break;
      case "ver-indicacoes": onAction({ type: "go", target: "rede/indicacoes" }); break;
      case "cadastrar-embaixador": onAction({ type: "go", target: "rede/embaixadores" }); break;
      case "registrar-visita": { const target = p.places.find((x) => x.summary?.planned.length) ?? p.places[0]; if (target) setVisit(toPlant(target)); else onAction({ type: "interaction", personId: p.id }); break; }
      case "planejar-visita": { const target = p.places.find((x) => !x.review && x.summary?.situation === "Avançar" && !x.summary.planned.length); if (target) setPlan(toPlant(target)); break; }
      case "registrar-interacao": onAction({ type: "interaction", personId: p.id }); break;
      default: break;
    }
  };
  const a = p.attendance;
  const toPlant = (x: PersonPage["places"][number]): PlantPlace => ({ businessId: x.businessId, name: x.name, type: x.type, sector: x.sector });
  const plantPerson = (x: PersonPage["places"][number] | undefined): PlantPerson => ({ id: p.id, name: p.name, link: x?.link, level: p.level, review: x?.review });
  const placeOf = (target: PlantPlace | null) => target ? p.places.find((x) => x.businessId === target.businessId) : undefined;
  const reload = () => { void load(false); };
  async function placeAction(action: "primary_place" | "remove_person_place", businessId: string, name: string) {
    if (action === "remove_person_place" && !window.confirm(`Tirar ${name} dos lugares de ${p!.name}? As visitas com ela ali saem do histórico dela e as programadas são canceladas.`)) return;
    setBusyPlace(businessId);
    try {
      const r = await tenantFetch("/api/territory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data: { personId: p!.id, businessId } }) });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error || "Não foi possível salvar.");
      toast.success(action === "primary_place" ? "Local principal trocado." : "Lugar removido."); reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Sem conexão: tente quando o sinal voltar."); } finally { setBusyPlace(""); }
  }

  return <>
    {header}
    <div className="grid gap-4 p-5">
      {!guideSeen && guide && <TabGuideCard guide={guide} onOpen={() => setShowGuide(true)} onDone={onGuideSeen} />}
      {/* Próximo passo: 1 frase e 1 botão. */}
      <section aria-label="Próximo passo" className="rounded-xl border border-gold/40 bg-gold/[0.07] p-4">
        <p className="section-kicker">Próximo passo</p>
        <p className="mt-1 text-white">{p.next.text}</p>
        {p.next.button && <Button className="mt-3 bg-gold text-black" onClick={runNext}><Sparkles /> {p.next.button}</Button>}
      </section>

      <Segmented label="Parte da página" value={part} onChange={setPart} options={[{ value: "resumo", label: "Resumo" }, { value: "lugares", label: "Lugares" }, { value: "historico", label: "Histórico" }]} />

      {part === "resumo" && <div className="grid gap-4">
        <section className="elite-card p-4" aria-label="Atendimento"><p className="section-kicker">Atendimento</p>
          {a === null ? <p className="mt-1 text-sm text-zinc-300">Sem atendimento.</p>
            : a.hidden ? <p className="mt-1 text-sm text-zinc-300">Atendimento com outra pessoa da equipe.</p>
            : <>
              <p className="mt-1 text-sm text-white">{[a.stage, a.temperature, a.dueDate ? `retorno ${shortDate(a.dueDate)}` : "", a.ownerName ? `com ${a.ownerName}` : ""].filter(Boolean).join(" · ")}</p>
              {a.sale && <p className="text-xs text-subtle">{a.sale.paid ? "Pagamento confirmado" : a.sale.status}{a.sale.amountCents ? ` · ${money(a.sale.amountCents)}` : ""}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onAction({ type: "followup", leadId: a.leadId })}>Abrir acompanhamento</Button>
                {p.can.recordSale && <Button size="sm" variant={a.sale?.paid ? "outline" : "default"} className={a.sale?.paid ? "" : "bg-gold-soft text-black"} onClick={() => onAction({ type: "sale", leadId: a.leadId })}>{a.sale ? "Ver venda" : "Registrar venda"}</Button>}
              </div>
            </>}
          {p.consent && <p className="mt-2 text-xs text-subtle">{p.consent.revokedAt ? `Autorização revogada em ${shortDate(p.consent.revokedAt.slice(0, 10))}: não entrar em contato.` : `Autorizou contato em ${shortDate(p.consent.at.slice(0, 10))}${p.consent.source ? ` · ${p.consent.source}` : ""}${p.consent.purpose ? ` · para ${p.consent.purpose}` : ""}`}</p>}
          {!p.consent && a === null && p.can.startAttendance && <Button size="sm" className="mt-3 bg-gold-soft text-black" onClick={() => onAction({ type: "start", person: { id: p.id, name: p.name, cityId: p.cityId, cityName: p.cityName, placeName: p.place?.name } })}>Iniciar atendimento</Button>}
        </section>

        <section className="elite-card p-4" aria-label="Rede"><p className="section-kicker">Rede</p>
          <p className="mt-1 text-sm text-white">{p.referrer?.kind === "pessoa" ? <>Indicado por <strong>{p.referrer.name}</strong></> : p.referrer?.kind === "fora" ? "Indicado por alguém fora do seu acesso" : "Sem indicador"}</p>
          <p className="text-sm text-zinc-300">{p.referred.total ? `Indicou ${p.referred.total} (${p.referred.bought} ${p.referred.bought === 1 ? "comprou" : "compraram"})` : "Ainda não indicou ninguém."}</p>
          {p.referred.people.length > 0 && <ul className="mt-1 flex flex-wrap gap-1 text-xs text-zinc-300">{p.referred.people.slice(0, 8).map((c) => <li key={c.id} className="rounded-full border border-white/10 px-2 py-0.5">{c.name}{c.client ? " · comprou" : ""}</li>)}</ul>}
          <div className="mt-3 flex flex-wrap gap-2">
            {!p.referrer && p.can.edit && <Button size="sm" variant="outline" onClick={() => onAction({ type: "edit", personId: p.id })}>Quem indicou?</Button>}
            {p.referred.total > 0 && <Button size="sm" variant="ghost" onClick={() => onAction({ type: "go", target: "rede/indicacoes" })}>Explorar ramo</Button>}
          </div>
        </section>

        {p.mentorship && <section className="elite-card p-4" aria-label="Mentoria"><p className="section-kicker">Mentoria</p>
          <p className="mt-1 text-sm text-white">{p.mentorship.done} de {p.mentorship.total} etapas</p>
          <p className="text-xs text-subtle">{p.mentorship.nextMeeting ? `Próximo encontro: ${shortDate(p.mentorship.nextMeeting.slice(0, 10))}` : "Sem próximo encontro marcado"}{p.mentorship.owner ? ` · com ${p.mentorship.owner}` : ""}</p>
        </section>}

        {p.ambassador && <section className="elite-card p-4" aria-label="Acompanhamento do embaixador"><p className="section-kicker">Acompanhamento</p>
          <p className="mt-1 text-sm text-white">{p.ambassador.status} · {p.ambassador.level} · treinamento {p.ambassador.training}%</p>
          <p className="text-xs text-subtle">{p.ambassador.leads} atendimentos · {p.ambassador.sales} vendas pagas · {p.ambassador.openTasks} tarefas abertas{p.ambassador.lastUpdate ? ` · última atualização ${shortDate(p.ambassador.lastUpdate.slice(0, 10))}` : ""}</p>
        </section>}

        {p.placeReview && <section className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-4" aria-label="Local a revisar">
          <p className="text-sm text-amber-100">Local a revisar: {p.placeReview.name} ({p.placeReview.link || "sem vínculo"}). Até a revisão, a pessoa aparece no centro do bairro ou da cidade.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => onAction({ type: "edit", personId: p.id })}>Editar</Button>
        </section>}

        <section className="elite-card p-4" aria-label="Como abordar"><p className="section-kicker">Como abordar</p>
          <ul className="mt-1 grid gap-1 text-sm text-zinc-200">{p.tips.map((t) => <li key={t}>• {t}</li>)}</ul>
          {p.hook && <div className="mt-3 rounded-lg border border-white/10 p-3"><p className="text-xs text-subtle">Gancho aprovado · {p.hook.title}</p><p className="mt-1 text-sm text-white">{p.hook.text}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={async () => { if (await copyText(p.hook!.text)) toast.success("Gancho copiado. Envie pela ficha do atendimento."); else toast.error("Não foi possível copiar."); }}><Copy /> Copiar</Button></div>}
        </section>
      </div>}

      {part === "lugares" && <section className="grid gap-3" aria-label="Lugares">
        <p className="text-xs text-subtle">Lugares de relacionamento: onde a pessoa tem vínculo (trabalho, negócios e comunidades), contados e autorizados por ela. Nunca a casa dela, e sem horários. No mapa, ela aparece só no local principal.</p>
        {!p.places.length && <p className="text-sm text-zinc-300">Sem local ligado: no mapa, aparece {p.onMap.kind === "bairro" ? `no centro do bairro ${p.onMap.name}` : "no centro da cidade"} (nunca na residência).</p>}
        {p.places.map((x) => <article key={x.businessId} className="elite-card grid gap-2 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-white">{x.name}{x.main && <span className="elite-guide-badge ml-2">Principal</span>}{x.review && <span className="ml-2 rounded-full border border-amber-300/40 px-2 py-0.5 text-[11px] text-amber-100">a revisar</span>}</p>
            <p className="text-xs text-subtle">{[x.type, x.sector || "sem setor", x.link].filter(Boolean).join(" · ")}</p></div>
            {x.summary && <SituationBadge situation={x.summary.situation} text={x.summary.situationText} />}</div>
          {x.summary?.planned.length ? <ul className="text-xs text-zinc-300">{x.summary.planned.map((v) => <li key={v.id}>Plano: {v.step} até {shortDate(v.dueDate)} · {v.responsible}</li>)}</ul> : null}
          {x.summary?.lastVisit && <p className="text-xs text-subtle">Última visita: {shortDate(x.summary.lastVisit)}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onAction({ type: "mapKey", key: `business:${x.businessId}` })}><MapPin /> Ver no mapa</Button>
            {p.can.edit && !x.review && x.summary?.situation !== "Institucional" && <Button size="sm" variant="outline" onClick={() => setPlan(toPlant(x))}>Planejar visita</Button>}
            {p.can.edit && <Button size="sm" variant="outline" onClick={() => setVisit(toPlant(x))}>Registrar visita</Button>}
            {p.can.edit && !x.main && <Button size="sm" variant="ghost" disabled={busyPlace === x.businessId} onClick={() => placeAction("primary_place", x.businessId, x.name)}>Tornar principal</Button>}
            {p.can.edit && !x.main && <Button size="sm" variant="ghost" disabled={busyPlace === x.businessId} onClick={() => placeAction("remove_person_place", x.businessId, x.name)}>Remover</Button>}
          </div>
        </article>)}
        {p.can.edit && <div className="grid gap-1"><Button variant="outline" className="justify-self-start" disabled={!p.linkPlace.allowed} onClick={() => setLinking(true)}>Ligar a outro lugar</Button>
          {!p.linkPlace.allowed && <p className="text-xs text-subtle">{p.linkPlace.reason}{p.can.startAttendance && <> <button type="button" className="text-gold underline-offset-2 hover:underline" onClick={() => onAction({ type: "start", person: { id: p.id, name: p.name, cityId: p.cityId, cityName: p.cityName, placeName: p.place?.name } })}>Iniciar atendimento</button></>}</p>}</div>}
      </section>}

      {part === "historico" && <section aria-label="Histórico">
        {p.timeline.items.length ? <Timeline hideTime items={p.timeline.items.map((i) => ({ id: i.id, at: i.at, title: i.title, detail: i.detail, tone: timelineTone(i.kind) }))} /> : <p className="text-sm text-zinc-300">Nada registrado ainda.</p>}
        {p.timeline.more && !full && <Button size="sm" variant="outline" className="mt-3" onClick={() => { setFull(true); load(true); }}>Ver mais</Button>}
      </section>}
    </div>
    <HookPicker context={hook} initialSituation="Indicação" onClose={() => setHook(null)} />
    {plan && <PlanDialog place={plan} person={plantPerson(placeOf(plan))} team={p.team} me={access.email} situation={placeOf(plan)?.summary?.situation ?? null} company={organizationName} onClose={() => setPlan(null)} onSaved={reload} />}
    {visit && <VisitDialog place={visit} person={plantPerson(placeOf(visit))} onClose={() => setVisit(null)} onSaved={reload} onMapPeople={(businessId) => onAction({ type: "mapear", businessId })} />}
    {linking && <LinkPlaceDialog person={{ id: p.id, name: p.name, cityId: p.cityId }} onClose={() => setLinking(false)} onSaved={reload} onNewPlace={() => onAction({ type: "mapear" })} />}
  </>;
}
