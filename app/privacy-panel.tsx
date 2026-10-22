"use client";
import { useEffect, useState } from "react";
import { Download, Eraser, LoaderCircle, PenLine, Search, ShieldCheck, ShieldOff, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRIVACY_CHANNELS, PRIVACY_KIND_LABEL, RESPONSE_DAYS, type PrivacyDetails, type PrivacyKind, type PrivacyRequestRow, type PrivacySubject } from "@/lib/privacy";
import { tenantFetch } from "@/lib/tenant-request";

async function get<T>(query: string): Promise<T> {
  const response = await tenantFetch(`/api/privacy${query}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível carregar. Confira a conexão e tente de novo.");
  return body as T;
}
async function post(action: string, data: unknown) {
  const response = await tenantFetch("/api/privacy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) throw new Error(body.error || "Não foi possível concluir. Confira a conexão e tente de novo.");
  return body.result;
}
// Mesmo dia do servidor (horário de Brasília), para "hoje" valer igual nos dois lados.
const localDay = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
const brDate = (value: string) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "";
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
type Action = "export" | "correct" | "revoke" | "anonymize";
const ACTION_KIND: Record<Action, PrivacyKind> = { export: "acesso", correct: "correcao", revoke: "revogacao", anonymize: "anonimizacao" };

/**
 * Pedidos de titulares (LGPD, art. 18): o administrador encontra a pessoa,
 * entrega a cópia dos dados, corrige, revoga a autorização ou anonimiza, e cada
 * atendimento fica registrado com o prazo de 15 dias.
 */
export function PrivacyPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PrivacySubject[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [subject, setSubject] = useState<PrivacyDetails | null>(null);
  const [requests, setRequests] = useState<PrivacyRequestRow[] | null>(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    get<{ requests: PrivacyRequestRow[] }>("").then((body) => { if (alive) setRequests(body.requests); }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Não foi possível carregar os pedidos."); });
    return () => { alive = false; };
  }, [revision]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      get<{ subjects: PrivacySubject[] }>(`?q=${encodeURIComponent(q)}`).then((body) => { if (alive) setResults(body.subjects); })
        .catch((e) => { if (alive) toast.error(e instanceof Error ? e.message : "Busca indisponível."); })
        .finally(() => { if (alive) setSearching(false); });
    }, 300);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [query]);

  async function open(ref: string) {
    try { setSubject((await get<{ subject: PrivacyDetails }>(`?subject=${encodeURIComponent(ref)}`)).subject); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível abrir o titular."); }
  }
  async function done(ref: string) { setRevision((value) => value + 1); await open(ref); }

  return <div className="space-y-5">
    <section className="elite-card grid gap-3 p-5 text-sm leading-6 text-zinc-300">
      <h2 className="flex items-center gap-2 text-base font-semibold text-white"><ShieldCheck className="size-5 text-gold-soft" aria-hidden /> Pedidos de titulares (LGPD)</h2>
      <p>Quando alguém pede para ver, corrigir ou apagar os próprios dados, ou para não ser mais contatado, atenda aqui. Você tem <strong className="text-white">{RESPONSE_DAYS} dias</strong> a partir do pedido para responder; cada atendimento fica registrado abaixo.</p>
      <ul className="grid gap-1 text-zinc-400 sm:grid-cols-2">
        <li><strong className="text-zinc-200">Cópia dos dados</strong> — arquivo com tudo o que a empresa guarda sobre a pessoa, para enviar a ela.</li>
        <li><strong className="text-zinc-200">Correção</strong> — nome, e-mail e WhatsApp em todos os cadastros de uma vez.</li>
        <li><strong className="text-zinc-200">Revogação</strong> — a pessoa não quer mais contato: o atendimento é encerrado e sai da agenda.</li>
        <li><strong className="text-zinc-200">Exclusão (anonimização)</strong> — apaga o que identifica a pessoa; ficam só números sem nome. Não pode ser desfeita.</li>
      </ul>
    </section>

    <section className="elite-card grid gap-3 p-5">
      <label className="relative"><Search className="absolute left-3 top-3.5 size-4 text-subtle" aria-hidden /><input aria-label="Buscar titular" className="commercial-input pl-9" placeholder="Buscar pelo nome, e-mail ou WhatsApp" value={query} onChange={(e) => { setQuery(e.target.value); if (e.target.value.trim().length < 2) setResults(null); }} /></label>
      {searching && <p role="status" className="flex items-center gap-2 text-sm text-zinc-400"><LoaderCircle className="size-4 animate-spin" /> Buscando…</p>}
      {results && !searching && (results.length
        ? <ul className="grid gap-1" aria-label="Titulares encontrados">{results.map((item) => <li key={item.ref}><button type="button" onClick={() => open(item.ref)} className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-left text-sm ${subject?.ref === item.ref ? "border-gold/60 bg-gold/10" : "border-white/8 hover:bg-white/5"}`}>
            <span className="font-medium text-white">{item.name}</span><span className="text-xs text-subtle">{[item.city, item.place].filter(Boolean).join(" · ")}</span>
            <span className="ml-auto flex gap-1">{item.anonymized ? <Tag tone="muted">Anonimizado</Tag> : item.sources.map((source) => <Tag key={source}>{source}</Tag>)}</span>
          </button></li>)}</ul>
        : <p className="text-sm text-zinc-400">Ninguém com esse nome, e-mail ou WhatsApp nesta empresa.</p>)}
    </section>

    {subject && <SubjectCard subject={subject} onAction={setAction} />}

    <section className="elite-card p-5">
      <h2 className="mb-3 text-base font-semibold text-white">Pedidos atendidos</h2>
      {error ? <p role="alert" className="text-sm text-amber-100">{error}</p> : !requests ? <p role="status" className="flex items-center gap-2 text-sm text-zinc-400"><LoaderCircle className="size-4 animate-spin" /> Carregando…</p>
        : !requests.length ? <p className="text-sm text-zinc-400">Nenhum pedido atendido ainda. Quando você atender um pedido acima, ele aparece aqui com a data e o prazo.</p>
        : <div className="elite-table-stack -mx-5 overflow-x-auto"><Table>
          <TableHeader><TableRow className="border-white/8 hover:bg-transparent"><TableHead>Pedido recebido</TableHead><TableHead>Pedido</TableHead><TableHead>Titular</TableHead><TableHead>Canal</TableHead><TableHead>Atendido</TableHead><TableHead>Prazo</TableHead><TableHead>Por</TableHead></TableRow></TableHeader>
          <TableBody>{requests.map((r) => <TableRow key={r.id} className="border-white/6 align-top">
            <TableCell data-label="Recebido"><span>{brDate(r.receivedAt)}</span></TableCell>
            <TableCell data-label="Pedido" className="whitespace-normal"><span>{PRIVACY_KIND_LABEL[r.kind]}</span>{r.note && <span className="block text-xs text-subtle">{r.note}</span>}</TableCell>
            <TableCell data-label="Titular" className="whitespace-normal"><span>{r.subjectLabel}</span></TableCell>
            <TableCell data-label="Canal"><span>{r.channel}</span></TableCell>
            <TableCell data-label="Atendido"><span>{brDate(r.completedAt)} <span className="text-xs text-subtle">({r.days === 0 ? "no mesmo dia" : plural(r.days, "dia", "dias")})</span></span></TableCell>
            <TableCell data-label="Prazo">{r.onTime ? <Tag tone="ok">No prazo</Tag> : <Tag tone="warn">Fora do prazo ({brDate(r.deadline)})</Tag>}</TableCell>
            <TableCell data-label="Por" className="whitespace-normal break-all text-zinc-400"><span>{r.actorEmail}</span></TableCell>
          </TableRow>)}</TableBody>
        </Table></div>}
    </section>

    {subject && action && <ActionDialog key={`${subject.ref}-${action}`} subject={subject} action={action} onClose={() => setAction(null)} onDone={() => { setAction(null); void done(subject.ref); }} />}
  </div>;
}

function Tag({ children, tone = "gold" }: { children: React.ReactNode; tone?: "gold" | "ok" | "warn" | "muted" }) {
  const tones = { gold: "border-gold/30 bg-gold/10 text-gold-light", ok: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", warn: "border-amber-300/30 bg-amber-300/10 text-amber-200", muted: "border-white/10 bg-white/5 text-zinc-400" };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

function SubjectCard({ subject: s, onAction }: { subject: PrivacyDetails; onAction: (action: Action) => void }) {
  const stored = [
    s.sources.includes("Mapa") && `no mapa${s.place ? ` (ligada a ${s.place})` : ""}`,
    s.counts.roles && plural(s.counts.roles, "papel", "papéis"),
    s.counts.actions && plural(s.counts.actions, "ação do território", "ações do território"),
    s.sources.includes("Contato") && "contato com autorização",
    (s.counts.activities + s.counts.history) > 0 && plural(s.counts.activities + s.counts.history, "anotação de atendimento", "anotações de atendimento"),
    s.counts.sale && "venda registrada",
    s.sources.includes("Embaixador") && "cadastro de embaixador",
    s.counts.updates && plural(s.counts.updates, "atualização de embaixador", "atualizações de embaixador"),
  ].filter(Boolean) as string[];
  const outline = "border-white/10 bg-white/5 text-white";
  return <section className="elite-card grid gap-4 p-5" aria-label="Titular selecionado">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-lg font-semibold text-white">{s.name}</p><p className="text-sm text-zinc-400">{s.city}{s.email && ` · ${s.email}`}{s.whatsapp && ` · ${s.whatsapp}`}</p></div>
      {s.anonymized ? <Tag tone="muted">Anonimizado</Tag> : s.consent === "vigente" ? <Tag tone="ok">Contato autorizado</Tag> : s.consent === "revogada" ? <Tag tone="warn">Autorização revogada</Tag> : <Tag tone="muted">Sem contato registrado</Tag>}
    </div>
    {s.anonymized ? <p className="text-sm text-zinc-400">Os dados que identificavam esta pessoa já foram apagados. Ficaram só números sem identificação.</p>
      : <p className="text-sm text-zinc-300"><span className="text-subtle">Guardado sobre esta pessoa: </span>{stored.join(" · ")}.</p>}
    {s.platformAccess.length > 0 && !s.anonymized && <p className="flex items-start gap-2 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm text-amber-50"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />Esta pessoa também tem acesso à plataforma: {s.platformAccess.join(", ")}. Se o pedido incluir o acesso, desative em Gestão → Time e acessos.</p>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" className={outline} onClick={() => onAction("export")}><Download /> Cópia dos dados</Button>
      {!s.anonymized && <>
        <Button variant="outline" className={outline} onClick={() => onAction("correct")}><PenLine /> Corrigir dados</Button>
        <Button variant="outline" className={outline} disabled={s.consent !== "vigente"} title={s.consent !== "vigente" ? "Não há autorização de contato vigente." : undefined} onClick={() => onAction("revoke")}><ShieldOff /> Revogar autorização</Button>
        <Button variant="outline" className="border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/20" onClick={() => onAction("anonymize")}><Eraser /> Excluir (anonimizar)</Button>
      </>}
    </div>
  </section>;
}

function ActionDialog({ subject: s, action, onClose, onDone }: { subject: PrivacyDetails; action: Action; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ receivedAt: localDay(), channel: "", note: "", name: s.name, email: s.email, whatsapp: s.whatsapp, confirm: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const kind = ACTION_KIND[action];
  const ready = Boolean(form.channel && form.receivedAt) && (action !== "anonymize" || form.confirm) && (action !== "correct" || form.name.trim().length >= 2);

  async function submit() {
    setBusy(true); setError("");
    const base = { subject: s.ref, channel: form.channel, receivedAt: form.receivedAt, note: form.note };
    try {
      if (action === "export") {
        const result = await post("export", base) as { data: unknown; fileName: string };
        const url = URL.createObjectURL(new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" }));
        const link = Object.assign(document.createElement("a"), { href: url, download: result.fileName });
        document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
        toast.success("Arquivo gerado. Envie para a pessoa pelo mesmo canal do pedido.");
      } else if (action === "correct") {
        await post("correct", { ...base, name: form.name, email: form.email, whatsapp: form.whatsapp });
        toast.success("Dados corrigidos em todos os cadastros.");
      } else if (action === "revoke") {
        await post("revoke", base);
        toast.success("Autorização revogada. O atendimento foi encerrado e saiu da agenda.");
      } else {
        const result = await post("anonymize", { ...base, confirm: true }) as { label: string };
        toast.success(`Dados apagados. A pessoa agora aparece como “${result.label}”.`);
      }
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir."); }
    finally { setBusy(false); }
  }

  return <Dialog open onOpenChange={(value) => { if (!value && !busy) onClose(); }}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto border-white/10 bg-surface-raised text-white sm:max-w-lg">
      <DialogHeader><DialogTitle>{PRIVACY_KIND_LABEL[kind]}</DialogTitle><DialogDescription className="text-zinc-400">{s.name} · {s.city}</DialogDescription></DialogHeader>
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      {action === "export" && <p className="text-sm text-zinc-300">Gera um arquivo com tudo o que a empresa guarda sobre a pessoa: cadastro no mapa, contato e autorização, atendimento, venda e embaixador. Envie para ela pelo mesmo canal do pedido.</p>}
      {action === "correct" && <div className="grid gap-3">
        <label className="grid gap-1 text-sm">Nome<input className="commercial-input" value={form.name} maxLength={200} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        {s.sources.some((source) => source !== "Mapa") && <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">E-mail<input className="commercial-input" type="email" value={form.email} maxLength={200} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="grid gap-1 text-sm">WhatsApp<input className="commercial-input" inputMode="tel" value={form.whatsapp} maxLength={40} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(31) 99999-0000" /></label>
        </div>}
        <p className="text-xs text-subtle">A correção vale para o mapa, o contato e o cadastro de embaixador da pessoa.</p>
      </div>}
      {action === "revoke" && <p className="text-sm text-zinc-300">A pessoa não será mais contatada: o atendimento é encerrado, sai da agenda e a autorização de WhatsApp do embaixador é retirada. O cadastro no mapa continua.</p>}
      {action === "anonymize" && <div className="grid gap-3 text-sm">
        <div className="rounded-lg border border-red-400/25 bg-red-500/10 p-3 text-red-50">
          <p className="font-medium">Apaga de vez o que identifica a pessoa:</p>
          <p className="text-red-100/90">nome, e-mail, WhatsApp, local e vínculo, papéis, ponto no mapa, anotações do atendimento, ações do território e observações de embaixador.</p>
          <p className="mt-2 font-medium">Fica, sem identificação:</p>
          <p className="text-red-100/90">a contagem no mapa e nos indicadores, e a venda com produto e valor (exigida pela contabilidade).</p>
        </div>
        <label className="flex items-start gap-2 text-zinc-200"><input type="checkbox" className="mt-1" checked={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.checked })} />Entendo que a anonimização não pode ser desfeita.</label>
      </div>}
      <div className="grid gap-3 border-t border-white/8 pt-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Pedido recebido em<input className="commercial-input" type="date" max={localDay()} value={form.receivedAt} onChange={(e) => setForm({ ...form, receivedAt: e.target.value })} /></label>
        <label className="grid gap-1 text-sm">Por onde chegou<select className="commercial-input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}><option value="">Selecione</option>{PRIVACY_CHANNELS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Observação (opcional)<input className="commercial-input" value={form.note} maxLength={300} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ex.: número do protocolo. Não escreva dados da pessoa." /></label>
      </div>
      <div className="flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={onClose}>Cancelar</Button>
        <Button disabled={busy || !ready} onClick={submit} className={action === "anonymize" ? "bg-red-500 text-white hover:bg-red-600" : "bg-gold text-black hover:bg-gold-hover"}>{busy && <LoaderCircle className="animate-spin" />}{action === "export" ? "Gerar arquivo" : action === "correct" ? "Salvar correção" : action === "revoke" ? "Revogar autorização" : "Anonimizar agora"}</Button></div>
    </DialogContent>
  </Dialog>;
}
