"use client";
/*
 * Plantio: situação do lugar, "Planejar visita", "Registrar visita" e "Ligar a outro lugar".
 * Só listas fixas (sem texto livre), só o dia (sem hora), sem GPS e sem foto. Usado na página da pessoa
 * e na ficha do local do mapa. Sem internet: "Sem conexão: registre quando o sinal voltar."
 */
import { useEffect, useState } from "react";
import { CircleDot, Flag, Leaf, Lock, Sprout, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PLACE_LINKS } from "@/lib/places";
import { isSchool, PLACE_PURPOSE, PLANT_STEPS, stepLabel, VISIT_RESULTS, WORK_LINKS } from "@/lib/person-places";
import type { PlaceSituation } from "@/lib/place-situation";
import { fillTip, tipsFor, type Level } from "@/lib/planting-tips";
import type { TerritoryRecord } from "@/lib/territory-types";
import { tenantFetch } from "@/lib/tenant-request";

export type PlantPlace = { businessId: string; name: string; type: string; sector: string };
export type PlantPerson = { id: string; name: string; link?: string; level?: Level; review?: boolean };
export type TeamMember = { email: string; name: string };

const ICON: Record<PlaceSituation, typeof Leaf> = { Abrir: CircleDot, Plantar: Sprout, "Avançar": Flag, Dominado: Trophy, Institucional: Lock };
const TONE: Record<PlaceSituation, string> = { Abrir: "text-zinc-300", Plantar: "text-emerald-200", "Avançar": "text-gold", Dominado: "text-amber-200", Institucional: "text-zinc-400" };

/** Situação sempre com ícone e texto (nunca só cor). */
export function SituationBadge({ situation, text }: { situation: PlaceSituation; text: string }) {
  const Icon = ICON[situation];
  return <span className={`inline-flex items-center gap-1 text-xs ${TONE[situation]}`}><Icon className="size-3.5" aria-hidden />{text}</span>;
}

async function send(action: string, data: unknown) {
  let r: Response;
  try { r = await tenantFetch("/api/territory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data }) }); }
  catch { throw new Error("Sem conexão: registre quando o sinal voltar."); }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || "Não foi possível salvar agora.");
  return body;
}
const todayBr = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
const minus = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export function PlanDialog({ place, person, team, me, situation, company, onClose, onSaved }: {
  place: PlantPlace | null; person?: PlantPerson | null; team: TeamMember[]; me: string; situation?: PlaceSituation | null; company: string; onClose: () => void; onSaved: () => void;
}) {
  const [step, setStep] = useState<string>(PLANT_STEPS[0]);
  const [due, setDue] = useState(todayBr());
  const [who, setWho] = useState(team.find((t) => t.email === me.toLowerCase())?.email ?? team[0]?.email ?? me);
  const [bridge, setBridge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!place) return null;
  const canBridge = !!person && !person.review && place.sector !== "Religioso";
  const steps = PLANT_STEPS.filter((s) => person || !s.includes("{primeiro_nome}"));
  const tip = tipsFor({ nivel: person?.level ?? null, tipo: place.type, setor: place.sector, vinculo: person?.link ?? null, situacao: situation ?? null })[0];
  async function save() {
    setBusy(true); setError("");
    try {
      await send("plant_plan", { businessId: place!.businessId, personId: person?.id ?? null, step, dueDate: due, responsible: who, bridge: canBridge && (bridge || step.includes("{primeiro_nome}")), requestId: crypto.randomUUID() });
      toast.success("Visita planejada."); onSaved(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="bg-zinc-950 text-white">
      <DialogHeader><DialogTitle>Plano de plantio em {place.name}</DialogTitle><DialogDescription>Uma visita da equipe ao local, com data. Sem horários e sem registrar onde a pessoa está.</DialogDescription></DialogHeader>
      <label className="grid gap-1 text-sm">O que fazer<select className="commercial-input" value={step} onChange={(e) => setStep(e.target.value)}>{steps.map((s) => <option key={s} value={s}>{stepLabel(s, firstName(person?.name ?? ""))}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Até quando<input type="date" className="commercial-input" min={todayBr()} value={due} onChange={(e) => setDue(e.target.value)} /></label>
      <label className="grid gap-1 text-sm">Quem faz<select className="commercial-input" value={who} onChange={(e) => setWho(e.target.value)}>{team.map((t) => <option key={t.email} value={t.email}>{t.name}</option>)}</select></label>
      {person && (canBridge ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={bridge || step.includes("{primeiro_nome}")} disabled={step.includes("{primeiro_nome}")} onChange={(e) => setBridge(e.target.checked)} />Com {firstName(person.name)} como ponte</label>
        : <p className="text-xs text-subtle">{firstName(person.name)} não pode ser ponte neste local (vínculo sensível ou a revisar).</p>)}
      {tip && <p className="rounded-lg border border-white/10 p-3 text-xs leading-5 text-zinc-300"><strong className="text-white">Dica:</strong> {fillTip(tip, { firstName: firstName(person?.name ?? ""), place: place.name, company })}</p>}
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={busy || !due || !who} onClick={save}>{busy ? "Salvando…" : "Planejar visita"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function VisitDialog({ place, person, onClose, onSaved, onMapPeople }: {
  place: PlantPlace | null; person?: PlantPerson | null; onClose: () => void; onSaved: () => void; onMapPeople?: (businessId: string) => void;
}) {
  const t = todayBr();
  const [day, setDay] = useState(t);
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  if (!place) return null;
  async function save() {
    setBusy(true); setError("");
    try { await send("plant_visit", { businessId: place!.businessId, personId: person?.id ?? null, result, day, requestId: crypto.randomUUID() }); toast.success("Visita registrada."); onSaved(); setDone(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="bg-zinc-950 text-white">
      <DialogHeader><DialogTitle>Registrar visita em {place.name}</DialogTitle><DialogDescription>Registre a visita da equipe ao local. Não registre onde a pessoa estava nem horários.</DialogDescription></DialogHeader>
      {done ? <div className="grid gap-3"><p className="text-sm text-emerald-200">Visita registrada.</p>
        <div className="flex flex-wrap gap-2">{onMapPeople && <Button onClick={() => { onMapPeople(place.businessId); onClose(); }}>Mapear pessoas deste local</Button>}<Button variant="outline" onClick={onClose}>Fechar</Button></div></div>
        : <>
          <label className="grid gap-1 text-sm">Dia<input type="date" className="commercial-input" min={minus(t, 7)} max={t} value={day} onChange={(e) => setDay(e.target.value)} /></label>
          <fieldset className="grid gap-2 text-sm"><legend className="mb-1">Resultado</legend>{VISIT_RESULTS.map((r) => <label key={r} className="flex items-center gap-2"><input type="radio" name="visit-result" value={r} checked={result === r} onChange={() => setResult(r)} />{r}</label>)}</fieldset>
          {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
          <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={busy || !result} onClick={save}>{busy ? "Salvando…" : "Registrar visita"}</Button></DialogFooter>
        </>}
    </DialogContent>
  </Dialog>;
}

/** "Ligar a outro lugar": local já cadastrado na cidade da pessoa (busca pelo nome), vínculo e a caixa da autorização. */
export function LinkPlaceDialog({ person, onClose, onSaved, onNewPlace }: {
  person: { id: string; name: string; cityId: number } | null; onClose: () => void; onSaved: () => void; onNewPlace?: () => void;
}) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<TerritoryRecord[]>([]);
  const [chosen, setChosen] = useState<TerritoryRecord | null>(null);
  const [link, setLink] = useState("");
  const [ok, setOk] = useState({ authorized: false, association: false, school: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!person || q.trim().length < 2) return;
    const c = new AbortController();
    const timer = setTimeout(() => { tenantFetch(`/api/territory?${new URLSearchParams({ category: "business", city: String(person.cityId), q: q.trim() })}`, { signal: c.signal }).then(async (r) => (r.ok ? (await r.json()).records as TerritoryRecord[] : [])).then(setFound).catch(() => undefined); }, 250);
    return () => { clearTimeout(timer); c.abort(); };
  }, [q, person]);
  if (!person) return null;
  const type = chosen?.roles[0] ?? "", sector = chosen?.roles.find((r, i) => i > 0 && r !== "Parceiro") ?? "";
  const school = chosen ? isSchool({ type, sector }) : false;
  const links = sector === "Saúde" ? [...WORK_LINKS] : [...PLACE_LINKS];
  const blocked = !chosen ? "" : !sector ? "Escolha o setor deste local antes de ligar pessoas a ele." : sector === "Religioso" ? "Igreja revela religião (dado sensível). Mapeie o lugar, mas não ligue pessoas a ele." : "";
  const ready = chosen && link && !blocked && ok.authorized && (sector !== "Associação / entidade" || ok.association) && (!(school && link === "Frequenta") || ok.school);
  async function save() {
    setBusy(true); setError("");
    try { await send("person_place", { personId: person!.id, businessId: chosen!.id, link, authorized: ok.authorized, confirmAssociation: ok.association, confirmSchool: ok.school }); toast.success("Lugar ligado."); onSaved(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ligar."); } finally { setBusy(false); }
  }
  const fn = firstName(person.name);
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto bg-zinc-950 text-white">
      <DialogHeader><DialogTitle>Ligar {fn} a outro lugar</DialogTitle><DialogDescription>{PLACE_PURPOSE}</DialogDescription></DialogHeader>
      <label className="grid gap-1 text-sm">Local já cadastrado<input className="commercial-input" placeholder="Procure pelo nome" value={q} onChange={(e) => { setQ(e.target.value); setChosen(null); }} /></label>
      {q.trim().length >= 2 && !chosen && <ul className="grid max-h-48 gap-1 overflow-y-auto">{found.map((r) => { const s = r.roles.find((x, i) => i > 0 && x !== "Parceiro"); return <li key={r.key}><button type="button" className="w-full rounded-lg border border-white/8 px-3 py-2 text-left text-sm hover:bg-white/5" onClick={() => { setChosen(r); setLink(""); }}>{r.name} <span className="text-xs text-subtle">· {r.roles[0]} · {s ?? "sem setor"}</span></button></li>; })}
        {!found.length && <li className="text-sm text-zinc-400">Nenhum local com esse nome nesta cidade.</li>}</ul>}
      {onNewPlace && !chosen && <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => { onClose(); onNewPlace(); }}>Cadastrar novo local</Button>}
      {chosen && <div className="grid gap-3">
        <p className="text-sm text-white">{chosen.name} <span className="text-xs text-subtle">· {type} · {sector || "sem setor"}</span></p>
        {blocked ? <p role="alert" className="text-sm text-amber-200">{blocked}</p> : <>
          <label className="grid gap-1 text-sm">Vínculo<select className="commercial-input" value={link} onChange={(e) => setLink(e.target.value)}><option value="">Selecione</option>{links.map((l) => <option key={l}>{l}</option>)}</select></label>
          {sector === "Saúde" && <p className="text-xs text-subtle">Em local de saúde, só vínculo de trabalho: ser paciente revela dado de saúde.</p>}
          {sector === "Associação / entidade" && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={ok.association} onChange={(e) => setOk({ ...ok, association: e.target.checked })} />Não é sindicato, partido nem entidade religiosa.</label>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={ok.authorized} onChange={(e) => setOk({ ...ok, authorized: e.target.checked })} />{fn} contou que tem esse vínculo e concordou em ajudar a criar relacionamentos aqui.</label>
          {school && link === "Frequenta" && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={ok.school} onChange={(e) => setOk({ ...ok, school: e.target.checked })} />A própria pessoa estuda ou trabalha aqui (não use para a escola dos filhos).</label>}
        </>}
        <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setChosen(null)}>Escolher outro local</Button>
      </div>}
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={busy || !ready} onClick={save}>{busy ? "Salvando…" : "Ligar lugar"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

type PlaceDetail = {
  businessId: string; name: string; type: string; sector: string; situation: PlaceSituation; situationText: string; people: number; lastVisit: string;
  planned: { id: string; step: string; dueDate: string; responsible: string }[]; names: { id: string; name: string }[]; review: { id: string; name: string; link: string }[];
  team: TeamMember[];
};
const short = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Ficha do local no mapa: "Pessoas da rede ligadas aqui" (só quem está no escopo de quem vê), situação, plano e visitas. */
export function PlacePanel({ businessId, me, company, canPlant, onPersonPage, onMapPeople }: {
  businessId: string; me: string; company: string; canPlant: boolean; onPersonPage?: (id: string) => void; onMapPeople?: (businessId: string) => void;
}) {
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [plan, setPlan] = useState(false);
  const [visit, setVisit] = useState(false);
  useEffect(() => {
    let live = true;
    tenantFetch(`/api/territory/place?id=${businessId}`, { cache: "no-store" })
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (!live) return; if (r.ok) { setDetail(b.data); setError(""); } else setError(b.error || "Não foi possível abrir a ficha do local."); })
      .catch(() => { if (live) setError("Sem conexão: a situação do lugar aparece quando o sinal voltar."); });
    return () => { live = false; };
  }, [businessId, revision]);
  if (error) return <p className="border-t border-white/10 p-5 text-sm text-zinc-400">{error}</p>;
  if (!detail) return <p role="status" className="border-t border-white/10 p-5 text-sm text-subtle">Carregando a situação do lugar…</p>;
  const place: PlantPlace = { businessId: detail.businessId, name: detail.name, type: detail.type, sector: detail.sector };
  return <section className="grid gap-2 border-t border-white/10 p-5 text-sm" aria-label="Plano de plantio aqui">
    <SituationBadge situation={detail.situation} text={detail.situationText} />
    {detail.situation !== "Institucional" && <p className="text-white">Pessoas da rede ligadas aqui: {detail.people}</p>}
    {detail.names.length > 0 && <ul className="flex flex-wrap gap-1 text-xs">{detail.names.slice(0, 12).map((n) => <li key={n.id}>{onPersonPage ? <button type="button" className="rounded-full border border-white/10 px-2 py-0.5 hover:bg-white/5" onClick={() => onPersonPage(n.id)}>{n.name}</button> : <span className="rounded-full border border-white/10 px-2 py-0.5">{n.name}</span>}</li>)}</ul>}
    {detail.review.length > 0 && <p className="text-xs text-amber-100">{detail.review.length} {detail.review.length === 1 ? "vínculo a revisar" : "vínculos a revisar"}: {detail.review.map((r) => `${r.name} (${r.link || "sem vínculo"})`).join(", ")}. Corrija o setor, o local ou o vínculo.</p>}
    <p className="text-xs text-subtle">Plano de plantio aqui: {detail.planned.length ? detail.planned.map((v) => `${v.step} até ${short(v.dueDate)} · ${v.responsible}`).join(" · ") : "nenhuma visita planejada"}{detail.lastVisit ? ` · Última visita: ${short(detail.lastVisit)}` : ""}</p>
    {canPlant && <div className="flex flex-wrap gap-2">{detail.situation !== "Institucional" && <Button size="sm" variant="outline" onClick={() => setPlan(true)}>Planejar visita</Button>}<Button size="sm" variant="outline" onClick={() => setVisit(true)}>Registrar visita</Button></div>}
    {detail.situation === "Institucional" && <p className="text-xs text-subtle">Plano institucional (evento aberto, parceria, material aprovado) em Rede → Parceiros e eventos, sem nomes de quem frequenta.</p>}
    {plan && <PlanDialog place={place} team={detail.team} me={me} situation={detail.situation} company={company} onClose={() => setPlan(false)} onSaved={() => setRevision((v) => v + 1)} />}
    {visit && <VisitDialog place={place} onClose={() => setVisit(false)} onSaved={() => setRevision((v) => v + 1)} onMapPeople={onMapPeople} />}
  </section>;
}

/** Hoje: "Plantio: N visitas para hoje · Ver" (do responsável; a gestão vê as do escopo). Some quando não há visita. */
export function PlantingToday() {
  const [items, setItems] = useState<{ id: string; step: string; businessId: string; place: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [visit, setVisit] = useState<PlantPlace | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    tenantFetch("/api/territory/place?view=today", { cache: "no-store" }).then(async (r) => { const b = await r.json().catch(() => ({})); if (live && r.ok) setItems(b.data); }).catch(() => undefined);
    return () => { live = false; };
  }, [revision]);
  if (!items.length) return null;
  return <article className="elite-card grid gap-2 p-4 text-sm" aria-label="Plantio">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-white"><Sprout className="mr-1 inline size-4 text-emerald-200" aria-hidden />Plantio: {items.length} {items.length === 1 ? "visita" : "visitas"} para hoje</p>
      <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Fechar" : "Ver"}</Button></div>
    {open && <ul className="grid gap-1">{items.map((v) => <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-1"><span>{v.place} · {v.step}</span><Button size="sm" variant="ghost" onClick={() => setVisit({ businessId: v.businessId, name: v.place, type: "", sector: "" })}>Registrar visita</Button></li>)}</ul>}
    {visit && <VisitDialog place={visit} onClose={() => setVisit(null)} onSaved={() => setRevision((n) => n + 1)} />}
  </article>;
}
