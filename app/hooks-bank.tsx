"use client";
import { useEffect, useMemo, useState } from "react";
import { Copy, FileUp, LoaderCircle, MessageSquareQuote, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copyText } from "@/lib/copy-text";
import { fillHook, HOOK_CHANNELS, HOOK_SITUATIONS, HOOK_STATUSES, HOOK_VARIABLES, MAX_HOOK_IMPORT, parseHookLines, type HookContext, type HookRecord } from "@/lib/hooks";
import { SECTORS } from "@/lib/places";
import { tenantFetch } from "@/lib/tenant-request";

type Loaded = { hooks: HookRecord[]; canEdit: boolean };
const STATUS_TONE: Record<string, string> = { Aprovado: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", Rascunho: "border-amber-300/30 bg-amber-300/10 text-amber-200", Retirado: "border-slate-400/30 bg-slate-400/10 text-slate-300" };

async function load(): Promise<Loaded> {
  const response = await tenantFetch("/api/hooks");
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível carregar os ganchos.");
  return body as Loaded;
}
async function post(action: string, data: unknown) {
  const response = await tenantFetch("/api/hooks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) throw new Error(body.error || "Não foi possível salvar. Confira a conexão e tente de novo.");
  return body.result;
}

/**
 * Banco de Ganchos (Sistema de Prospecção): frases de abordagem por situação, canal e setor.
 * A gestão cadastra, importa e aprova; a equipe usa os aprovados.
 */
export function HooksBank() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [situation, setSituation] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<HookRecord | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    load().then((value) => { if (alive) { setData(value); setError(""); } }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Não foi possível carregar os ganchos."); });
    return () => { alive = false; };
  }, [revision]);

  const shown = useMemo(() => (data?.hooks ?? []).filter((h) => (!situation || h.situation === situation) && (!query || `${h.title} ${h.body} ${h.sector}`.toLowerCase().includes(query.toLowerCase()))), [data, situation, query]);
  const reload = () => setRevision((value) => value + 1);

  if (error) return <p role="alert" className="elite-card p-6 text-sm text-amber-100">{error}</p>;
  if (!data) return <p role="status" className="elite-card flex items-center gap-2 p-6 text-sm text-zinc-400"><LoaderCircle className="size-4 animate-spin" /> Carregando ganchos…</p>;

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <p className="max-w-2xl text-sm leading-6 text-zinc-400">Frases de abordagem do Sistema de Prospecção, por situação. Na ficha de cada atendimento, “Usar gancho” já troca o nome, a cidade e o responsável.</p>
      {data.canEdit && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setImporting(true)} className="border-white/10 bg-white/5 text-white"><FileUp /> Importar ganchos</Button><Button onClick={() => setEditing("new")} className="bg-gold text-black"><Plus /> Cadastrar gancho</Button></div>}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {["", ...HOOK_SITUATIONS].map((item) => <Button key={item || "todas"} size="sm" variant={situation === item ? "secondary" : "ghost"} onClick={() => setSituation(item)}>{item || "Todas"}</Button>)}
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar no texto" aria-label="Buscar ganchos" className="commercial-input ml-auto max-w-xs" />
    </div>
    {shown.length ? <div className="grid gap-4 lg:grid-cols-2">{shown.map((hook) => <article key={hook.id} className="elite-card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-white">{hook.title}</h3><p className="text-xs text-subtle">{[hook.situation, hook.channel, hook.sector].filter(Boolean).join(" · ")}</p></div>{data.canEdit && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${STATUS_TONE[hook.status]}`}>{hook.status}</span>}</div>
      <p className="flex-1 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{hook.body}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={async () => { if (await copyText(hook.body)) toast.success("Gancho copiado. Troque as variáveis antes de enviar."); else toast.error("Não foi possível copiar. Selecione o texto manualmente."); }}><Copy /> Copiar</Button>
        {data.canEdit && <Button size="sm" variant="ghost" onClick={() => setEditing(hook)}><Pencil /> Editar</Button>}
        {data.canEdit && hook.status !== "Aprovado" && <Button size="sm" variant="ghost" className="text-emerald-300" onClick={() => post("save", { ...hook, status: "Aprovado" }).then(() => { toast.success("Gancho aprovado: a equipe já pode usar."); reload(); }).catch((e) => toast.error(e.message))}>Aprovar</Button>}
      </div>
    </article>)}</div>
      : <article className="elite-card grid min-h-44 place-items-center px-5 py-8 text-center"><div><span className="elite-empty-icon"><MessageSquareQuote className="size-6" /></span><h3 className="font-semibold text-white">{data.hooks.length ? "Nenhum gancho neste filtro" : data.canEdit ? "O banco de ganchos ainda está vazio" : "Ainda não há ganchos aprovados"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-subtle">{data.hooks.length ? "Troque a situação ou limpe a busca." : data.canEdit ? "Cadastre os ganchos do Sistema de Prospecção Elite 1.0, um a um ou colando várias linhas de uma vez. Eles entram como rascunho até você aprovar." : "Quando a gestão aprovar os ganchos, eles aparecem aqui e na ficha de cada atendimento."}</p>{data.canEdit && !data.hooks.length && <Button onClick={() => setImporting(true)} className="mt-5 bg-gold text-black"><FileUp /> Importar ganchos</Button>}</div></article>}
    <HookDialog key={editing === "new" ? "new" : editing ? `h${editing.id}` : "closed"} hook={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
    <ImportDialog open={importing} onClose={() => setImporting(false)} onSaved={() => { setImporting(false); reload(); }} />
  </div>;
}

function HookDialog({ hook, onClose, onSaved }: { hook: HookRecord | "new" | null; onClose: () => void; onSaved: () => void }) {
  const row = hook && hook !== "new" ? hook : null;
  const [body, setBody] = useState(row?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await post("save", { ...(row ? { id: row.id } : {}), title: f.get("title"), situation: f.get("situation"), channel: f.get("channel"), sector: f.get("sector"), body, status: f.get("status") });
      toast.success(row ? "Gancho salvo." : "Gancho cadastrado.");
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  return <Dialog open={hook !== null} onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[92dvh] overflow-y-auto text-white sm:max-w-xl">
    <DialogHeader><DialogTitle>{row ? "Editar gancho" : "Cadastrar gancho"}</DialogTitle><DialogDescription className="text-zinc-400">Use as variáveis para a plataforma completar com os dados do atendimento.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="grid gap-3 text-sm">
      <label className="grid gap-1">Título<input name="title" required minLength={3} maxLength={120} defaultValue={row?.title} placeholder="Ex.: Abertura por indicação" className="commercial-input" /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1">Situação<select name="situation" defaultValue={row?.situation ?? "Primeiro contato"} className="commercial-input">{HOOK_SITUATIONS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="grid gap-1">Canal<select name="channel" defaultValue={row?.channel ?? "WhatsApp"} className="commercial-input">{HOOK_CHANNELS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="grid gap-1">Setor (opcional)<select name="sector" defaultValue={row?.sector ?? ""} className="commercial-input"><option value="">Todos</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select></label>
      </div>
      <label className="grid gap-1">Texto<textarea required minLength={10} maxLength={1500} value={body} onChange={(e) => setBody(e.target.value)} className="commercial-input min-h-32" /></label>
      <div className="flex flex-wrap gap-1.5">{HOOK_VARIABLES.map(([key, label]) => <button key={key} type="button" title={label} onClick={() => setBody((value) => `${value}${value && !value.endsWith(" ") ? " " : ""}${key}`)} className="rounded-md border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs text-gold-light hover:bg-gold/20">{key}</button>)}</div>
      <label className="grid gap-1">Situação do gancho<select name="status" defaultValue={row?.status ?? "Rascunho"} className="commercial-input">{HOOK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select><span className="text-xs text-subtle">Só os aprovados aparecem para a equipe.</span></label>
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy} className="bg-gold text-black">{busy && <LoaderCircle className="animate-spin" />} Salvar gancho</Button></div>
    </form>
  </DialogContent></Dialog>;
}

function ImportDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lines = parseHookLines(text);
  const invalid = lines.filter((l) => l.error);
  async function submit() {
    setBusy(true); setError("");
    try {
      const result = await post("import", { rows: lines.map((l) => l.input) });
      if (result.errors?.length) { setError(result.errors.map((e: { line: number; error: string }) => `Linha ${e.line}: ${e.error}`).join(" · ")); return; }
      toast.success(`${result.saved} ${result.saved === 1 ? "gancho importado" : "ganchos importados"} como rascunho. Revise e aprove.`);
      setText(""); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível importar."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={(value) => { if (!value && !busy) onClose(); }}><DialogContent className="max-h-[92dvh] overflow-y-auto text-white sm:max-w-2xl">
    <DialogHeader><DialogTitle>Importar ganchos</DialogTitle><DialogDescription className="text-zinc-400">Um gancho por linha: <code className="text-gold-light">Título | Situação | Texto</code> (canal e setor opcionais no fim: <code className="text-gold-light">| WhatsApp | Saúde</code>). Até {MAX_HOOK_IMPORT} por vez; entram como rascunho.</DialogDescription></DialogHeader>
    <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"Abertura por indicação | Indicação | Oi {primeiro_nome}, quem me passou seu contato foi…"} className="commercial-input min-h-48 font-mono text-xs" />
    <p className="text-xs text-subtle">{lines.length ? `${lines.length - invalid.length} de ${lines.length} linhas prontas.` : "Cole as linhas acima."}{invalid.length > 0 && <span className="text-amber-200"> {invalid.slice(0, 3).map((l) => `Linha ${l.line}: ${l.error}`).join(" · ")}</span>}</p>
    {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
    <div className="flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={busy || !lines.length || invalid.length > 0 || lines.length > MAX_HOOK_IMPORT} onClick={submit} className="bg-gold text-black">{busy && <LoaderCircle className="animate-spin" />} Importar {lines.length || ""}</Button></div>
  </DialogContent></Dialog>;
}

/** Na ficha do atendimento: escolhe um gancho aprovado, já preenchido, e copia. */
export function HookPicker({ context, onClose }: { context: HookContext | null; onClose: () => void }) {
  return <Dialog open={context !== null} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[92dvh] overflow-y-auto text-white sm:max-w-xl">
    {context && <PickerBody context={context} />}
  </DialogContent></Dialog>;
}

function PickerBody({ context }: { context: HookContext }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [situation, setSituation] = useState("");
  useEffect(() => { let alive = true; load().then((v) => { if (alive) setData(v); }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Não foi possível carregar."); }); return () => { alive = false; }; }, []);
  const approved = (data?.hooks ?? []).filter((h) => h.status === "Aprovado" && (!situation || h.situation === situation));
  return <>
    <DialogHeader><DialogTitle>Usar gancho · {context.name}</DialogTitle><DialogDescription className="text-zinc-400">O texto já vem com o nome, a cidade e o responsável. Confira antes de enviar.</DialogDescription></DialogHeader>
    <div className="flex flex-wrap gap-1.5">{["", ...HOOK_SITUATIONS].map((item) => <Button key={item || "todas"} size="sm" variant={situation === item ? "secondary" : "ghost"} onClick={() => setSituation(item)}>{item || "Todas"}</Button>)}</div>
    {error ? <p role="alert" className="text-sm text-amber-200">{error}</p> : !data ? <p role="status" className="flex items-center gap-2 text-sm text-zinc-400"><LoaderCircle className="size-4 animate-spin" /> Carregando…</p>
      : approved.length ? <ul className="grid gap-3">{approved.map((hook) => { const text = fillHook(hook.body, context); return <li key={hook.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-gold-soft">{hook.title} · {hook.situation} · {hook.channel}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-100">{text}</p><Button size="sm" className="mt-3 bg-gold text-black" onClick={async () => { if (await copyText(text)) toast.success("Mensagem copiada. Adapte se precisar e envie."); else toast.error("Não foi possível copiar. Selecione o texto manualmente."); }}><Copy /> Copiar mensagem</Button></li>; })}</ul>
      : <p className="rounded-xl border border-white/10 p-4 text-sm text-subtle">{data.hooks.length ? "Nenhum gancho aprovado nesta situação." : "Ainda não há ganchos aprovados. A gestão cadastra em Vendas → Ganchos."}</p>}
  </>;
}
