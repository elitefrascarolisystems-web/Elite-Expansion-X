"use client";
import { useEffect, useMemo, useState } from "react";
import { Building2, CircleDollarSign, ExternalLink, LoaderCircle, Pause, Pencil, Play, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { paymentState, PLAN_FEATURES, type PaymentState, type PlanUsage, type SubscriberRow, type SubscriptionsData } from "@/lib/subscriptions";
import { tenantFetch } from "@/lib/tenant-request";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const when = (value: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(value))
  : "—";
const day = (value: string) => value.split("-").reverse().join("/");
/** "1.497,90", "R$ 497" ou "497.5" → centavos; null se não for um valor. */
function cents(value: string): number | null {
  const clean = value.replace(/[R$\s]/g, "");
  if (!clean) return 0;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}
const limitValue = (value: FormDataEntryValue | null) => { const n = Number(value); return value === "" || value === null || !n ? null : n; };

const toneClass: Record<PaymentState["tone"], string> = {
  ok: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  warn: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  late: "border-red-400/30 bg-red-400/10 text-red-300",
  none: "border-slate-400/30 bg-slate-400/10 text-slate-300",
};
const ACTIONS: Record<string, string> = { create: "Criada", subscription: "Plano atualizado", suspend: "Suspensa", reactivate: "Reativada" };

async function post(action: string, data: unknown) {
  const response = await tenantFetch("/api/subscriptions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível salvar. Confira a conexão e tente de novo.");
  return body as { result: { organizationId: number }; data: SubscriptionsData };
}

function Usage({ used, limit, label }: { used: number; limit: number | null; label: string }) {
  const full = limit !== null && used >= limit;
  const words = limit === null && used === 1 ? label.split(" ").map((w) => w.replace(/s$/, "")).join(" ") : label;
  return <p className={full ? "text-amber-200" : "text-zinc-300"}>{used}{limit !== null ? ` de ${limit}` : ""} <span className="text-subtle">{words}</span>{full && <span className="sr-only"> (limite atingido)</span>}</p>;
}

function Company({ s }: { s: SubscriberRow }) {
  return <div><p className="font-medium text-white">{s.name}</p><p className="text-xs text-subtle">{s.ownerName || s.ownerEmail}</p>{!s.active && <span className="mt-1 inline-flex rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] text-red-300">Suspensa</span>}{s.active && !s.ownerJoined && <p className="mt-1 text-xs text-amber-200">Responsável ainda não criou a senha</p>}</div>;
}
function PlanInfo({ s }: { s: SubscriberRow }) {
  const off = PLAN_FEATURES.filter(([key]) => !s[key]).map(([, label]) => label.toLowerCase());
  return <div><p className="text-white">{s.plan || <span className="text-subtle">Sem plano</span>}</p><p className="text-xs text-zinc-400">{s.priceCents ? `${money(s.priceCents)}/mês` : "Valor não definido"}</p>{off.length > 0 && <p className="mt-1 text-[11px] text-subtle">Sem {off.join(", ")}</p>}</div>;
}
function Payment({ s, today }: { s: SubscriberRow; today: string }) {
  const pay = paymentState(s.paidUntil, today);
  return <div><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${toneClass[pay.tone]}`}>{pay.label}</span>{s.paidUntil && <p className="mt-1 text-xs text-subtle">Pago até {day(s.paidUntil)}</p>}</div>;
}
function UsageInfo({ s }: { s: SubscriberRow }) {
  return <><Usage used={s.users} limit={s.userLimit} label="usuários" /><Usage used={s.cities} limit={s.cityLimit} label="cidades ativas" />{s.mentorados > 0 && <p className="text-subtle">{s.mentorados} mentorado{s.mentorados > 1 ? "s" : ""}</p>}</>;
}
function Activity({ s }: { s: SubscriberRow }) {
  return <div className="text-xs text-zinc-400"><p>{s.people} pessoas no mapa · {s.leads} leads</p><p className="text-subtle">Último acesso: {when(s.lastLogin)}</p></div>;
}
function Actions({ s, onEdit, onStatus, className }: { s: SubscriberRow; onEdit: (s: SubscriberRow) => void; onStatus: (s: SubscriberRow) => void; className: string }) {
  return <div className={`flex flex-wrap gap-1.5 ${className}`}>
    <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => onEdit(s)}><Pencil /> Plano</Button>
    {s.active && <Button size="sm" variant="ghost" asChild className="text-zinc-300"><a href={`/?org=${s.id}`} target="_blank" rel="noopener"><ExternalLink /> Entrar</a></Button>}
    <Button size="sm" variant="ghost" className={s.active ? "text-red-300 hover:text-red-200" : "text-emerald-300 hover:text-emerald-200"} onClick={() => onStatus(s)}>{s.active ? <><Pause /> Suspender</> : <><Play /> Reativar</>}</Button>
  </div>;
}

/**
 * Empresas assinantes, só para os donos da plataforma: plano, valor, vencimento,
 * uso x limites e suspensão. A cobrança acontece fora; aqui fica o controle.
 */
export function SubscriptionsPanel() {
  const [data, setData] = useState<SubscriptionsData | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<SubscriberRow | "new" | null>(null);
  const [status, setStatus] = useState<SubscriberRow | null>(null);

  useEffect(() => {
    let alive = true;
    tenantFetch("/api/subscriptions").then(async (r) => { const b = await r.json().catch(() => ({})); if (!alive) return; if (r.ok) setData(b); else setError(b.error || "Não foi possível carregar as assinaturas."); })
      .catch(() => { if (alive) setError("Sem conexão. Atualize a página."); });
    return () => { alive = false; };
  }, []);

  const totals = useMemo(() => {
    const list = data?.subscribers ?? [], active = list.filter((s) => s.active);
    const states = active.map((s) => paymentState(s.paidUntil, data?.today ?? ""));
    return { active: active.length, suspended: list.length - active.length, revenue: active.reduce((sum, s) => sum + s.priceCents, 0),
      late: states.filter((s) => s.tone === "late").length, soon: states.filter((s) => s.tone === "warn").length };
  }, [data]);

  if (error) return <p role="alert" className="elite-card p-6 text-sm text-red-200">{error}</p>;
  if (!data) return <p role="status" className="elite-card flex items-center gap-2 p-6 text-sm text-zinc-400"><LoaderCircle className="size-4 animate-spin" /> Carregando assinaturas…</p>;
  const names = new Map(data.subscribers.map((s) => [s.id, s.name]));

  return <div className="space-y-5">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="section-kicker">Plataforma</p><h2 className="text-2xl font-semibold text-white">Empresas assinantes</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Cada empresa usa a plataforma inteira em um ambiente só dela. Aqui você controla plano, valor, vencimento e limites, e suspende quem deixou de pagar. A cobrança é feita fora da plataforma.</p></div>
      <Button onClick={() => setEditing("new")} className="w-fit bg-gold text-black hover:bg-gold-hover"><Plus /> Nova empresa assinante</Button>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { label: "Empresas ativas", value: String(totals.active), helper: totals.suspended ? `${totals.suspended} suspensa${totals.suspended > 1 ? "s" : ""}` : "Nenhuma suspensa", icon: Building2 },
        { label: "Receita mensal", value: money(totals.revenue), helper: "Soma dos planos das empresas ativas", icon: CircleDollarSign },
        { label: "Pagamento vencido", value: String(totals.late), helper: "Empresas ativas com a data de pagamento vencida", icon: TriangleAlert },
        { label: "Vencem em 7 dias", value: String(totals.soon), helper: "Hora de lembrar o cliente", icon: TriangleAlert },
      ].map(({ label, value, helper, icon: Icon }) => <article key={label} className="elite-card p-4"><div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-subtle">{label}<Icon className="size-4 text-gold" /></div><p className="mt-2 text-2xl font-semibold text-white">{value}</p><p className="mt-1 text-xs text-subtle">{helper}</p></article>)}
    </section>

    <section className="elite-card overflow-hidden">
      {data.subscribers.length === 0 ? <div className="p-8 text-center text-sm text-zinc-400"><p className="text-white">Nenhuma empresa assinante ainda.</p><p className="mt-1">Use <strong>Nova empresa assinante</strong> para criar o ambiente da primeira empresa e definir o plano dela.</p></div>
      : <>
        <ul className="grid divide-y divide-white/8 md:hidden">{data.subscribers.map((s) => <li key={s.id} className={`grid gap-3 p-4 ${s.active ? "" : "opacity-70"}`}>
          <Company s={s} />
          <div className="grid grid-cols-2 gap-3"><PlanInfo s={s} /><Payment s={s} today={data.today} /></div>
          <div className="grid grid-cols-2 gap-3 text-xs"><div><UsageInfo s={s} /></div><Activity s={s} /></div>
          <Actions s={s} onEdit={setEditing} onStatus={setStatus} className="justify-start" />
        </li>)}</ul>
        <div className="hidden overflow-x-auto md:block"><Table className="min-w-[56rem]">
        <TableHeader><TableRow className="border-white/8 hover:bg-transparent"><TableHead>Empresa</TableHead><TableHead>Plano</TableHead><TableHead>Pagamento</TableHead><TableHead>Uso</TableHead><TableHead>Atividade</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
        <TableBody>{data.subscribers.map((s) => <TableRow key={s.id} className={`border-white/8 align-top ${s.active ? "" : "opacity-70"}`}>
          <TableCell className="max-w-[16rem] whitespace-normal"><Company s={s} /></TableCell>
          <TableCell className="whitespace-normal"><PlanInfo s={s} /></TableCell>
          <TableCell><Payment s={s} today={data.today} /></TableCell>
          <TableCell className="text-xs"><UsageInfo s={s} /></TableCell>
          <TableCell><Activity s={s} /></TableCell>
          <TableCell><Actions s={s} onEdit={setEditing} onStatus={setStatus} className="justify-end" /></TableCell>
        </TableRow>)}</TableBody>
      </Table></div></>}
    </section>

    {data.audit.length > 0 && <section className="elite-card p-5"><h3 className="text-sm font-semibold text-white">Histórico das assinaturas</h3><ul className="mt-3 grid gap-2 text-xs text-zinc-400">{data.audit.slice(0, 12).map((item, index) => <li key={index} className="flex flex-wrap gap-x-2"><span className="text-subtle">{when(item.at)}</span><span className="text-white">{names.get(item.organizationId) ?? `Empresa ${item.organizationId}`}</span><span className="text-gold-soft">{ACTIONS[item.action] ?? item.action}</span><span className="min-w-0 break-words">{item.reason}</span><span className="text-subtle">por {item.actor}</span></li>)}</ul></section>}

    {/* A chave recria o formulário a cada abertura: erro limpo e nova solicitação. */}
    <PlanDialog key={editing === "new" ? "new" : `plan-${editing?.id ?? "closed"}`} target={editing} onClose={() => setEditing(null)} onSaved={(next, created) => { setData(next); setEditing(null); if (created) toast.success("Empresa criada. Use Entrar para gerar o link do responsável em Time e acessos."); else toast.success("Plano salvo."); }} />
    <StatusDialog key={`status-${status?.id ?? "closed"}`} target={status} onClose={() => setStatus(null)} onSaved={(next) => { setData(next); setStatus(null); }} />
  </div>;
}

/** `prefill`: dados vindos de um pedido da página /conheca (Plataforma → Pedidos de assinatura). */
export function PlanDialog({ target, prefill, onClose, onSaved }: { target: SubscriberRow | "new" | null; prefill?: { name: string; ownerName: string; ownerEmail: string; notes: string }; onClose: () => void; onSaved: (data: SubscriptionsData, created: boolean, organizationId?: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const isNew = target === "new";
  const row = target && target !== "new" ? target : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const price = cents(String(f.get("price") ?? ""));
    if (price === null) { setError("Informe o valor mensal em reais, por exemplo 497,00."); return; }
    const plan = {
      plan: String(f.get("plan") ?? ""), priceCents: price, paidUntil: String(f.get("paidUntil") || "") || null, notes: String(f.get("notes") ?? ""),
      userLimit: limitValue(f.get("userLimit")), cityLimit: limitValue(f.get("cityLimit")),
      ...Object.fromEntries(PLAN_FEATURES.map(([key]) => [key, f.get(key) === "on"])),
    };
    setBusy(true); setError("");
    try {
      const result = isNew
        ? await post("create", { ...plan, requestId, name: f.get("name"), ownerName: f.get("ownerName"), ownerEmail: f.get("ownerEmail") })
        : await post("save", { ...plan, organizationId: row!.id });
      onSaved(result.data, isNew, result.result?.organizationId);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar. Confira a conexão e tente de novo."); }
    finally { setBusy(false); }
  }

  return <Dialog open={target !== null} onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[92dvh] overflow-y-auto border-white/10 bg-surface-raised text-white sm:max-w-xl">
    <DialogHeader><DialogTitle>{isNew ? "Nova empresa assinante" : `Plano da ${row?.name ?? ""}`}</DialogTitle><DialogDescription className="text-zinc-400">{isNew ? "Cria o ambiente da empresa, vazio e só dela, já com o plano. Depois você entra nele e gera o link de acesso do responsável." : "Os limites valem na hora. Quem já está cadastrado continua com acesso; só não entram pessoas ou cidades novas além do limite."}</DialogDescription></DialogHeader>
    {target && <form key={row?.id ?? "new"} onSubmit={submit} className="grid gap-3 text-sm">
      {isNew && <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 sm:col-span-2">Nome da empresa<input name="name" required minLength={2} maxLength={120} defaultValue={prefill?.name} className="commercial-input" placeholder="Ex.: Academia Horizonte" /></label>
        <label className="grid gap-1">Nome do responsável<input name="ownerName" required minLength={2} maxLength={120} defaultValue={prefill?.ownerName} className="commercial-input" /></label>
        <label className="grid gap-1">E-mail do responsável<input name="ownerEmail" type="email" required maxLength={254} defaultValue={prefill?.ownerEmail} className="commercial-input" /></label>
      </div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">Plano<input name="plan" maxLength={60} defaultValue={row?.plan ?? ""} placeholder="Ex.: Expansão Pro" className="commercial-input" /></label>
        <label className="grid gap-1">Valor mensal (R$)<input name="price" inputMode="decimal" defaultValue={row?.priceCents ? (row.priceCents / 100).toFixed(2).replace(".", ",") : ""} placeholder="497,00" className="commercial-input" /></label>
        <label className="grid gap-1">Pago até<input name="paidUntil" type="date" defaultValue={row?.paidUntil ?? ""} className="commercial-input" /></label>
        <span className="hidden sm:block" />
        <label className="grid gap-1">Usuários da equipe<input name="userLimit" type="number" min={1} max={100000} defaultValue={row?.userLimit ?? ""} placeholder="Sem limite" className="commercial-input" /><span className="text-xs text-subtle">Mentorados não contam.{row ? ` Hoje: ${row.users}.` : ""}</span></label>
        <label className="grid gap-1">Cidades ativas<input name="cityLimit" type="number" min={1} max={100000} defaultValue={row?.cityLimit ?? ""} placeholder="Sem limite" className="commercial-input" /><span className="text-xs text-subtle">Cidades planejadas não contam.{row ? ` Hoje: ${row.cities}.` : ""}</span></label>
      </div>
      <fieldset className="grid gap-2 rounded-lg border border-white/8 p-3"><legend className="px-1 text-xs text-zinc-400">Recursos incluídos</legend>{PLAN_FEATURES.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-zinc-200"><input type="checkbox" name={key} defaultChecked={row ? row[key] : true} />{label}</label>)}<p className="text-xs text-subtle">Mapa, cidades, equipe, vendas, portal de mentorados e indicadores fazem parte de todo plano.</p></fieldset>
      <label className="grid gap-1">Anotações internas<Textarea name="notes" maxLength={1000} defaultValue={row?.notes ?? prefill?.notes ?? ""} placeholder="Forma de pagamento, contato financeiro, combinados…" className="commercial-input min-h-20" /></label>
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy} className="bg-gold text-black">{busy && <LoaderCircle className="animate-spin" />} {isNew ? "Criar empresa" : "Salvar plano"}</Button></div>
    </form>}
  </DialogContent></Dialog>;
}

function StatusDialog({ target, onClose, onSaved }: { target: SubscriberRow | null; onClose: () => void; onSaved: (data: SubscriptionsData) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const suspend = target?.active === true;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) return;
    setBusy(true); setError("");
    try {
      const result = await post("status", { organizationId: target.id, active: !suspend, reason: new FormData(event.currentTarget).get("reason") });
      toast.success(suspend ? `${target.name} suspensa. A equipe dela vê o aviso de assinatura suspensa.` : `${target.name} reativada. O acesso voltou para toda a equipe.`);
      onSaved(result.data);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar. Confira a conexão e tente de novo."); }
    finally { setBusy(false); }
  }

  return <Dialog open={target !== null} onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="border-white/10 bg-surface-raised text-white sm:max-w-lg">
    <DialogHeader><DialogTitle>{suspend ? `Suspender ${target?.name ?? ""}` : `Reativar ${target?.name ?? ""}`}</DialogTitle><DialogDescription className="text-zinc-400">{suspend ? "Ninguém da empresa entra enquanto estiver suspensa, nem a Assessoria Elite. Os dados ficam guardados e voltam ao reativar." : "Toda a equipe da empresa volta a entrar normalmente, com os dados como estavam."}</DialogDescription></DialogHeader>
    {target && <form key={target.id} onSubmit={submit} className="grid gap-3 text-sm">
      <label className="grid gap-1">Motivo (fica no histórico)<Textarea name="reason" required minLength={5} maxLength={500} placeholder={suspend ? "Ex.: pagamento de outubro em aberto" : "Ex.: pagamento confirmado"} className="commercial-input min-h-20" /></label>
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy} className={suspend ? "bg-red-500 text-white hover:bg-red-400" : "bg-emerald-500 text-black hover:bg-emerald-400"}>{busy && <LoaderCircle className="animate-spin" />} {suspend ? "Suspender acesso" : "Reativar acesso"}</Button></div>
    </form>}
  </DialogContent></Dialog>;
}

/** O plano visto pela própria empresa assinante (Gestão → Plano). */
export function PlanCard({ plan, organization }: { plan: PlanUsage; organization: string }) {
  const meter = (used: number, limit: number | null, label: string) => <div><div className="flex justify-between text-xs"><span className="text-zinc-400">{label}</span><span className={limit !== null && used >= limit ? "text-amber-200" : "text-white"}>{used}{limit !== null ? ` de ${limit}` : " · sem limite"}</span></div>{limit !== null && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))}%` }} /></div>}</div>;
  return <article className="elite-card grid gap-5 p-6 lg:grid-cols-[1fr_1fr]">
    <div><p className="section-kicker">Assinatura</p><h3 className="text-xl font-semibold text-white">{plan.plan || `Plano da ${organization}`}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">A plataforma de expansão completa, só da {organization}. Mentorados não ocupam vaga da equipe. Para ampliar o plano, fale com a Elite.</p>
      <ul className="mt-3 grid gap-1 text-sm">{PLAN_FEATURES.map(([key, label]) => <li key={key} className={plan[key] ? "text-zinc-200" : "text-subtle line-through"}>{plan[key] ? "✓" : "—"} {label}</li>)}</ul></div>
    <div className="grid content-start gap-4">{meter(plan.users, plan.userLimit, "Usuários da equipe")}{meter(plan.cities, plan.cityLimit, "Cidades ativas")}</div>
  </article>;
}
