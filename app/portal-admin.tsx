"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CalendarClock, LoaderCircle, Pencil, Plus, RefreshCcw, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { TerritoryPersonPicker } from "@/app/territory-person-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { DashboardData } from "@/lib/expansion-types";
import { PORTAL_AUDIENCES, type PortalAdminData } from "@/lib/portal";
import { tenantFetch } from "@/lib/tenant-request";

type Member = PortalAdminData["members"][number];
type Step = PortalAdminData["steps"][number];

/** Sugestão editável para começar a jornada (cada organização ajusta ao próprio método). */
const SUGGESTED: Record<(typeof PORTAL_AUDIENCES)[number], [string, string][]> = {
  Mentorados: [["Encontro de boas-vindas", "Conhecer o mentor, alinhar objetivos e a agenda da mentoria."], ["Diagnóstico inicial", "Mapear o ponto de partida: negócio, metas e principais travas."], ["Plano de ação", "Definir as prioridades e as entregas do ciclo."], ["Execução acompanhada", "Colocar o plano em prática com os encontros de acompanhamento."], ["Revisão de resultados", "Medir o que mudou e definir o próximo ciclo."]],
};

const meetingLabel = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value.length === 16 ? `${value}:00-03:00` : value)) : "—";

async function post(action: string, data: unknown) {
  const response = await tenantFetch("/api/portal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
  return result;
}

function MemberDialog({ member, data, onClose, onSaved }: { member: Member | null; data: DashboardData; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [cityId, setCityId] = useState(member?.cityId ?? data.cities[0]?.id ?? 0);
  const team = data.users.filter((u) => u.active && ["Administrador", "Coordenação", "Líder", "Comercial"].includes(u.role));
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member) return;
    const f = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await post("set_member", { userId: member.userId, ownerEmail: f.get("ownerEmail") || "", nextMeetingAt: f.get("nextMeetingAt") || null, nextMeetingNote: f.get("nextMeetingNote") || "", personId: f.get("personId") || null });
      toast.success("Portal atualizado."); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  return <Dialog open={member !== null} onOpenChange={(v) => { if (!v && !busy) onClose(); }}><DialogContent className="max-h-[92dvh] overflow-y-auto border-white/10 bg-surface-raised text-white sm:max-w-xl">
    <DialogHeader><DialogTitle>{member?.name}</DialogTitle><DialogDescription className="text-zinc-400">Mentorado(a) · o que aparece no portal desta pessoa.</DialogDescription></DialogHeader>
    {member && <form onSubmit={submit} className="grid gap-3 text-sm">
      <label className="grid gap-1">Contato da equipe (responsável)<select name="ownerEmail" defaultValue={member.ownerEmail} className="commercial-input"><option value="">Ninguém definido</option>{team.map((u) => <option key={u.email} value={u.email.toLowerCase()}>{u.name}{u.title ? ` · ${u.title}` : ""}</option>)}</select><span className="text-xs text-subtle">As indicações desta pessoa caem direto na agenda do responsável.</span></label>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]"><label className="grid gap-1">Próximo encontro<input name="nextMeetingAt" type="datetime-local" defaultValue={member.nextMeetingAt?.slice(0, 16) ?? ""} className="commercial-input" /></label><label className="grid gap-1">Sobre o encontro<input name="nextMeetingNote" maxLength={300} defaultValue={member.nextMeetingNote} placeholder="Ex.: revisão do plano de 90 dias, online" className="commercial-input" /></label></div>
      <fieldset className="grid gap-2 rounded-lg border border-white/8 p-3"><legend className="px-1 text-xs text-zinc-400">Pessoa no mapa (opcional): liga as indicações à rede de indicações</legend>
        <select aria-label="Cidade da pessoa" value={cityId} onChange={(e) => setCityId(Number(e.target.value))} className="commercial-input">{data.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        {cityId > 0 && <TerritoryPersonPicker key={cityId} cityId={cityId} name="personId" initialValue={member.personId ?? ""} />}
        {member.personName && <p className="text-xs text-subtle">Ligada hoje a: {member.personName}</p>}
      </fieldset>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy} className="bg-gold text-black">{busy && <LoaderCircle className="animate-spin" />}Salvar</Button></div>
    </form>}
  </DialogContent></Dialog>;
}

function JourneyEditor({ audience, steps, onChange }: { audience: (typeof PORTAL_AUDIENCES)[number]; steps: Step[]; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Step | null>(null);
  async function run(action: string, payload: unknown, message?: string) {
    setBusy(true);
    try { await post(action, payload); await onChange(); if (message) toast.success(message); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  async function useSuggestion() {
    setBusy(true);
    try { for (const [title, description] of SUGGESTED[audience]) await post("save_step", { audience, title, description }); await onChange(); toast.success("Jornada sugerida criada. Ajuste ao seu método."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível criar."); }
    finally { setBusy(false); }
  }
  return <article className="elite-card p-5">
    <div className="mb-3 flex items-center justify-between gap-2"><div><p className="section-kicker">Jornada</p><h3 className="text-lg font-semibold text-white">{audience}</h3></div><span className="text-xs text-subtle">{steps.length} etapa(s)</span></div>
    {steps.length ? <ol className="grid gap-1.5">{steps.map((step, index) => <li key={step.id} className="flex items-start gap-2 rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-gold/15 text-xs font-semibold text-gold-soft">{index + 1}</span>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-white">{step.title}</p>{step.description && <p className="text-xs leading-5 text-zinc-400">{step.description}</p>}</div>
      <div className="flex shrink-0">{[["up", ArrowUp, "Subir"], ["down", ArrowDown, "Descer"]].map(([dir, Icon, label]) => { const I = Icon as typeof ArrowUp; return <Button key={dir as string} size="icon" variant="ghost" disabled={busy} aria-label={`${label} ${step.title}`} className="size-7 text-zinc-400" onClick={() => run("move_step", { id: step.id, direction: dir })}><I className="size-3.5" /></Button>; })}<Button size="icon" variant="ghost" disabled={busy} aria-label={`Editar ${step.title}`} className="size-7 text-zinc-400" onClick={() => setEditing(step)}><Pencil className="size-3.5" /></Button><Button size="icon" variant="ghost" disabled={busy} aria-label={`Remover ${step.title}`} className="size-7 text-red-300/80" onClick={() => { if (window.confirm(`Remover a etapa "${step.title}"? Quem já concluiu perde essa marcação.`)) run("delete_step", { id: step.id }, "Etapa removida."); }}><Trash2 className="size-3.5" /></Button></div>
    </li>)}</ol> : <div className="rounded-lg border border-dashed border-white/12 p-4 text-sm text-zinc-400"><p>Nenhuma etapa ainda. Quem entrar no portal verá &ldquo;Jornada em preparação&rdquo;.</p><Button size="sm" variant="outline" disabled={busy} onClick={useSuggestion} className="mt-3 border-white/10 bg-white/5 text-white">Começar com uma sugestão editável</Button></div>}
    <form key={editing?.id ?? "new"} className="mt-3 grid gap-2 border-t border-white/8 pt-3 text-sm" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget, f = new FormData(form); run("save_step", { id: editing?.id, audience, title: f.get("title"), description: f.get("description") }, editing ? "Etapa atualizada." : "Etapa adicionada.").then(() => { form.reset(); setEditing(null); }); }}>
      <input name="title" required minLength={3} maxLength={120} defaultValue={editing?.title} placeholder={editing ? "Título da etapa" : "Nova etapa (ex.: Diagnóstico inicial)"} className="commercial-input" aria-label="Título da etapa" />
      <input name="description" maxLength={600} defaultValue={editing?.description} placeholder="O que acontece nesta etapa (opcional)" className="commercial-input" aria-label="Descrição da etapa" />
      <div className="flex gap-2"><Button type="submit" size="sm" disabled={busy} className="bg-gold text-black">{editing ? "Salvar etapa" : <><Plus /> Adicionar etapa</>}</Button>{editing && <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>}</div>
    </form>
  </article>;
}

/** Aba "Portal": mentorados e empresas assinantes, a jornada de cada público e o que cada um vê. */
export function PortalAdmin({ data, onGo }: { data: DashboardData; onGo: (tab: string) => void }) {
  const [admin, setAdmin] = useState<PortalAdminData | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const load = useCallback(async () => {
    const response = await tenantFetch("/api/portal?admin=1");
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Não foi possível carregar o portal."); return; }
    setError(""); setAdmin(result.data);
  }, []);
  useEffect(() => { let alive = true; tenantFetch("/api/portal?admin=1").then(async (r) => { const b = await r.json().catch(() => ({})); if (!alive) return; if (r.ok) setAdmin(b.data); else setError(b.error || "Não foi possível carregar o portal."); }).catch(() => { if (alive) setError("Sem conexão."); }); return () => { alive = false; }; }, []);
  const ownerName = (email: string) => data.users.find((u) => u.email.toLowerCase() === email.toLowerCase())?.name || email || "—";
  return <section className="space-y-5">
    <MemberDialog key={editing?.userId ?? 0} member={editing} data={data} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="section-kicker">Mentorados</p><h2 className="text-2xl font-semibold tracking-tight text-white">Portal de mentorados</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Cada mentorado entra num portal só dele: jornada, próximo encontro, materiais e indicações. Não vê nada da operação da equipe.</p></div><div className="flex gap-2"><Button variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => load()}><RefreshCcw /> Atualizar</Button><Button className="bg-gold text-black" onClick={() => onGo("gestao/time")}><Users /> Convidar para o portal</Button></div></div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {!admin && !error && <p className="flex items-center gap-2 text-sm text-zinc-400"><LoaderCircle className="size-4 animate-spin" /> Carregando…</p>}
    {admin && <>
      <article className="elite-card overflow-hidden"><div className="border-b border-white/8 p-5"><p className="section-kicker">Membros</p><h3 className="text-lg font-semibold text-white">{admin.members.length} no portal</h3></div>
        {admin.members.length ? <ul className="divide-y divide-white/6">{admin.members.map((m) => { const pct = m.total ? Math.round((m.done / m.total) * 100) : 0; return <li key={m.userId} className="grid gap-3 p-4 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center">
          <div className="min-w-0"><p className="font-medium text-white">{m.name}</p><p className="truncate text-xs text-subtle">{`Mentorado(a)${m.personName ? ` · ${m.personName}` : ""}`}{m.hasPassword ? "" : " · ainda sem senha"}</p></div>
          <div className="text-xs text-zinc-400"><p>Contato: <span className="text-zinc-200">{ownerName(m.ownerEmail)}</span></p><p className="flex items-center gap-1"><CalendarClock className="size-3.5" /> {meetingLabel(m.nextMeetingAt)}</p></div>
          <div className="text-xs text-zinc-400"><p>Jornada: {m.total ? `${m.done}/${m.total}` : "sem etapas"}</p>{m.total > 0 && <Progress value={pct} className="mt-1 h-1 bg-white/8" />}<p className="mt-1">Indicações: {m.referrals}</p></div>
          <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => setEditing(m)}><Pencil /> Editar</Button>
        </li>; })}</ul> : <p className="p-5 text-sm leading-6 text-zinc-400">Ninguém no portal ainda. Em <strong className="text-zinc-200">Gestão → Time e acessos</strong>, convide com a função <strong className="text-zinc-200">Mentorado</strong>; o link de acesso vai com uma mensagem própria do portal.</p>}
      </article>
      <div className="grid max-w-3xl gap-5">{PORTAL_AUDIENCES.map((audience) => <JourneyEditor key={audience} audience={audience} steps={admin.steps.filter((s) => s.audience === audience)} onChange={load} />)}</div>
      <article className="elite-card p-5 text-sm leading-6 text-zinc-400"><p className="section-kicker">Materiais do portal</p><p>Em <strong className="text-zinc-200">Rede → Materiais</strong>, escolha <strong className="text-zinc-200">Para quem: Mentorados ou Todos</strong> e a situação <strong className="text-zinc-200">Aprovado</strong>. O material aparece no portal na hora. Embaixadores continuam vendo só os materiais deles.</p></article>
    </>}
  </section>;
}
