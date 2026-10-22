"use client";
import { useEffect, useState } from "react";
import { Building2, Copy, LoaderCircle, Mail, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PlanDialog } from "@/app/subscriptions-panel";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/copy-text";
import { REQUEST_STATUSES, type RequestStatus, type SubscriptionRequestRow } from "@/lib/subscription-requests";
import { tenantFetch } from "@/lib/tenant-request";

async function post(action: string, data: unknown) {
  const response = await tenantFetch("/api/subscription-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) throw new Error(body.error || "Não foi possível salvar. Confira a conexão e tente de novo.");
}
const TONE: Record<RequestStatus, string> = {
  Novo: "border-gold/40 bg-gold/10 text-gold-light", "Em conversa": "border-sky-400/30 bg-sky-400/10 text-sky-200",
  "Virou assinante": "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", Descartado: "border-white/10 bg-white/5 text-zinc-400",
};
const when = (value: string) => new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const digits = (value: string) => value.replace(/\D/g, "");

/**
 * Pedidos da página pública /conheca. Os donos da plataforma conversam com a
 * empresa, anotam o andamento e, fechado o plano, criam o ambiente dela daqui.
 */
export function SubscriptionRequestsPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<SubscriptionRequestRow[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState<SubscriptionRequestRow | null>(null);

  useEffect(() => {
    let alive = true;
    tenantFetch("/api/subscription-requests").then(async (r) => { const b = await r.json().catch(() => ({})); if (!alive) return; if (r.ok) { setRows(b.requests); setError(""); } else setError(b.error || "Não foi possível carregar os pedidos."); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Sem conexão. Atualize a página."); });
    return () => { alive = false; };
  }, [revision]);
  const reload = () => { setRevision((value) => value + 1); onChanged?.(); };

  async function save(row: SubscriptionRequestRow, changes: Partial<Pick<SubscriptionRequestRow, "status" | "note" | "organizationId">>) {
    try { await post("update", { id: row.id, status: changes.status ?? row.status, note: changes.note ?? row.note, organizationId: changes.organizationId ?? null }); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
  }
  async function remove(row: SubscriptionRequestRow) {
    if (!window.confirm(`Apagar o pedido de ${row.company}? Os dados de contato saem da plataforma.`)) return;
    try { await post("delete", { id: row.id }); toast.success("Pedido apagado."); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível apagar."); }
  }

  if (error) return <p role="alert" className="elite-card p-6 text-sm text-red-200">{error}</p>;
  if (!rows) return <p role="status" className="elite-card flex items-center gap-2 p-6 text-sm text-zinc-400"><LoaderCircle className="size-4 animate-spin" /> Carregando pedidos…</p>;

  return <div className="space-y-5">
    <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="section-kicker">Plataforma</p><h2 className="text-2xl font-semibold text-white">Pedidos de assinatura</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Empresas que pediram apresentação pela página pública. Fale com a pessoa, anote o andamento e, fechado o plano, use <strong className="text-zinc-200">Criar empresa assinante</strong>: o ambiente nasce com os dados do pedido.</p></div>
      <Button asChild variant="outline" className="w-fit border-white/10 bg-white/5 text-white"><a href="/conheca" target="_blank" rel="noopener">Ver a página pública</a></Button>
    </section>

    {!rows.length ? <div className="elite-card p-8 text-center text-sm text-zinc-400"><p className="text-white">Nenhum pedido ainda.</p><p className="mt-1">Divulgue o endereço <strong className="text-zinc-200">/conheca</strong> da plataforma. Cada pedido aparece aqui.</p></div>
      : <ul className="grid gap-3" aria-label="Pedidos de assinatura">{rows.map((row) => <RequestCard key={`${row.id}-${row.updatedAt}`} row={row} onSave={save} onRemove={remove} onCreate={setCreating} />)}</ul>}

    <PlanDialog key={creating?.id ?? "closed"} target={creating ? "new" : null}
      prefill={creating ? { name: creating.company, ownerName: creating.contactName, ownerEmail: creating.email, notes: `Pedido pela página pública em ${when(creating.createdAt)}. WhatsApp: ${creating.whatsapp}. Cidade: ${creating.city}. Equipe: ${creating.teamSize}.` } : undefined}
      onClose={() => setCreating(null)}
      onSaved={(_data, _created, organizationId) => {
        const row = creating; setCreating(null);
        toast.success("Empresa criada. Entre nela para gerar o link do responsável em Time e acessos.");
        if (row) void save(row, { status: "Virou assinante", organizationId: organizationId ?? null });
      }} />
  </div>;
}

function RequestCard({ row, onSave, onRemove, onCreate }: { row: SubscriptionRequestRow; onSave: (row: SubscriptionRequestRow, changes: { status?: RequestStatus; note?: string }) => Promise<void>; onRemove: (row: SubscriptionRequestRow) => void; onCreate: (row: SubscriptionRequestRow) => void }) {
  const [note, setNote] = useState(row.note);
  const outline = "border-white/10 bg-white/5 text-white";
  return <li className={`elite-card grid gap-3 p-4 sm:p-5 ${row.status === "Descartado" ? "opacity-70" : ""}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0"><p className="text-lg font-semibold text-white">{row.company}</p><p className="text-sm text-zinc-400">{row.contactName} · {row.city} · {row.teamSize}</p></div>
      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE[row.status]}`}>{row.status}</span>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <a href={`mailto:${row.email}`} className="inline-flex min-w-0 items-center gap-1.5 break-all text-gold-soft hover:underline"><Mail className="size-4 shrink-0" aria-hidden />{row.email}</a>
      <a href={`https://wa.me/${digits(row.whatsapp).length <= 11 ? "55" : ""}${digits(row.whatsapp)}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-gold-soft hover:underline"><MessageCircle className="size-4 shrink-0" aria-hidden />{row.whatsapp}</a>
      <button type="button" onClick={() => copyText(`${row.contactName} — ${row.company}\n${row.email}\n${row.whatsapp}`).then(() => toast.success("Contato copiado."))} className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white"><Copy className="size-4" aria-hidden /> Copiar contato</button>
    </div>
    {row.message && <p className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300">“{row.message}”</p>}
    <p className="text-xs text-subtle">Recebido em {when(row.createdAt)}{row.handledBy && ` · atualizado por ${row.handledBy} em ${when(row.updatedAt)}`}{row.organizationId && ` · empresa nº ${row.organizationId}`}</p>
    <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
      <label className="grid gap-1 text-sm">Andamento<select className="commercial-input" value={row.status} onChange={(e) => onSave(row, { status: e.target.value as RequestStatus, note })}>{REQUEST_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Anotação<input className="commercial-input" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} onBlur={() => { if (note !== row.note) void onSave(row, { note }); }} placeholder="Ex.: apresentação marcada para sexta, 10h" /></label>
      <div className="flex flex-wrap gap-2">
        {row.status !== "Virou assinante" && <Button onClick={() => onCreate(row)} className="bg-gold text-black hover:bg-gold-hover"><Building2 /> Criar empresa assinante</Button>}
        <Button variant="outline" size="icon" className={outline} onClick={() => onRemove(row)} aria-label={`Apagar o pedido de ${row.company}`} title="Apagar pedido"><Trash2 /></Button>
      </div>
    </div>
  </li>;
}
