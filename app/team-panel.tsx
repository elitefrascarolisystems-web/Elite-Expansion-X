"use client";
import { useMemo, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, KeyRound, LoaderCircle, Pencil, Plus, UsersRound, XCircle } from "lucide-react";
import { toast } from "sonner";

import type { DialogState } from "@/app/expansion-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/copy-text";
import { isPortalRole, type DashboardData, type UserProfileRecord } from "@/lib/expansion-types";
import { inviteMessage, MAX_TEAM_ROWS, mentorshipLabel, parseTeamLines, TEAM_LINE_FORMAT } from "@/lib/team";
import { tenantFetch } from "@/lib/tenant-request";

const when = (value: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value))
  : "";
const roleLabel = (role: string) => role === "Comercial" ? "Comercial (vendas)" : role;

type Access = { label: string; detail: string; tone: "ok" | "wait" | "late" | "none" | "off" };

/** Em que pé está o acesso de cada pessoa, em palavras simples. */
export function accessState(user: UserProfileRecord): Access {
  if (!user.active) return { label: "Pausado", detail: "Sem acesso à plataforma.", tone: "off" };
  if (user.hasPassword) return { label: "Ativo", detail: user.lastLoginAt ? `Último acesso: ${when(user.lastLoginAt)}` : "Senha criada.", tone: "ok" };
  if (user.linkStatus === "Válido") return { label: "Convite enviado", detail: `Vence em ${when(user.linkExpiresAt)}`, tone: "wait" };
  if (user.linkStatus === "Vencido") return { label: "Convite vencido", detail: "Gere um novo link.", tone: "late" };
  return { label: "Sem convite", detail: "Gere o link e envie à pessoa.", tone: "none" };
}

const toneClass: Record<Access["tone"], string> = {
  ok: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  wait: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  late: "border-red-400/30 bg-red-400/10 text-red-300",
  none: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  off: "border-slate-400/30 bg-slate-400/10 text-slate-300",
};

function SendButtons({ message, link }: { message: string; link: string }) {
  return <div className="flex flex-wrap gap-2">
    <Button size="sm" onClick={async () => { if (await copyText(message)) toast.success("Mensagem copiada."); else toast.error("Não foi possível copiar. Selecione o texto manualmente."); }} className="bg-gold text-black"><Copy /> Copiar mensagem</Button>
    <Button asChild size="sm" variant="outline" className="border-white/10 bg-white/5 text-white"><a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><ExternalLink /> WhatsApp</a></Button>
    <Button size="sm" variant="ghost" className="text-zinc-400" onClick={async () => { if (await copyText(link)) toast.success("Link copiado."); }}>Só o link</Button>
  </div>;
}

/** Gera o link de uso único para a pessoa criar (ou trocar) a senha e mostra para o administrador enviar. */
export function AccessLinkDialog({ user, onClose, onDone, organization = "" }: { user: UserProfileRecord | null; onClose: () => void; onDone?: () => void; organization?: string }) {
  const [state, setState] = useState<{ link?: string; error?: string; busy?: boolean }>({});
  async function generate() {
    if (!user) return;
    setState({ busy: true });
    try {
      const response = await tenantFetch("/api/auth/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: user.email }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível gerar o link.");
      setState({ link: result.link });
      onDone?.();
    } catch (e) { setState({ error: e instanceof Error ? e.message : "Não foi possível gerar o link." }); }
  }
  return <Dialog open={user !== null} onOpenChange={(value) => !value && onClose()}><DialogContent className="border-white/10 bg-surface-raised text-white sm:max-w-lg">
    <DialogHeader><DialogTitle>Link de acesso</DialogTitle><DialogDescription className="text-zinc-400">{user?.hasPassword ? "A pessoa vai definir uma senha nova. A senha atual deixa de valer e as sessões abertas são encerradas." : "A pessoa vai criar a senha e já entrar na plataforma."}</DialogDescription></DialogHeader>
    {user && <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm"><p className="font-medium text-white">{user.name}</p><p className="text-xs text-subtle">{user.email}</p></div>}
    {state.error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">{state.error}</p>}
    {state.link && user ? <div className="grid gap-3"><p className="whitespace-pre-line rounded-lg border border-white/8 bg-black/30 p-3 text-xs leading-5 text-zinc-300">{inviteMessage(user.name, state.link, user.hasPassword, isPortalRole(user.role), organization)}</p><SendButtons message={inviteMessage(user.name, state.link, user.hasPassword, isPortalRole(user.role), organization)} link={state.link} /><p className="text-xs leading-5 text-subtle">Envie só para a própria pessoa. Vale por 72 horas e só funciona uma vez. Gerar outro link cancela este.</p></div>
      : <Button disabled={state.busy || !user} onClick={generate} className="bg-gold text-black">{state.busy ? <><LoaderCircle className="animate-spin" /> Gerando…</> : <><KeyRound /> Gerar link de acesso</>}</Button>}
  </DialogContent></Dialog>;
}

type InviteResult = { email: string; name: string; ok: boolean; link?: string; error?: string };

const EXAMPLE = `Flávia Silva; flavia@exemplo.com; Executiva de Vendas; ; Executiva de Vendas; 2
Fabricio; fabricio@exemplo.com; Executivo de Vendas; ; Executivo de Vendas; 1`;

/** Cadastro de várias pessoas de uma vez: cola a lista, confere a prévia e recebe os links. */
function BulkInviteDialog({ open, data, onClose, onData }: { open: boolean; data: DashboardData; onClose: () => void; onData: (data: DashboardData) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<InviteResult[] | null>(null);
  const [portalEmails, setPortalEmails] = useState<Set<string>>(new Set());
  const rows = useMemo(() => parseTeamLines(text, data.cities), [text, data.cities]);
  const valid = rows.filter((row) => !row.error);
  const existing = new Set(data.users.map((user) => user.email.toLowerCase()));
  function close() { if (busy) return; setText(""); setResults(null); onClose(); }
  async function submit() {
    if (!valid.length || valid.length > MAX_TEAM_ROWS) return;
    setBusy(true);
    try {
      const response = await tenantFetch("/api/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "invite", rows: valid.map(({ name, email, role, cityId, title, mentorshipCycle }) => ({ name, email, role, cityId, title, mentorshipCycle })) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível cadastrar.");
      setPortalEmails(new Set(valid.filter((row) => row.role && isPortalRole(row.role)).map((row) => row.email))); setResults(result.results); onData(result.data);
      const ok = (result.results as InviteResult[]).filter((item) => item.ok).length;
      toast.success(`${ok} ${ok === 1 ? "pessoa cadastrada" : "pessoas cadastradas"} com link de acesso.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível cadastrar."); }
    finally { setBusy(false); }
  }
  const allMessages = (results ?? []).filter((item) => item.ok && item.link).map((item) => `${item.name}:\n${inviteMessage(item.name, item.link!, false, portalEmails.has(item.email), data.access.organizationName)}`).join("\n\n---\n\n");
  return <Dialog open={open} onOpenChange={(value) => !value && close()}><DialogContent className="max-h-[92dvh] overflow-y-auto border-white/10 bg-surface-raised text-white sm:max-w-3xl">
    <DialogHeader><DialogTitle>Convidar equipe</DialogTitle><DialogDescription className="text-zinc-400">Cole uma pessoa por linha. Cada uma recebe um link pessoal para criar a senha (vale 72 horas, uso único).</DialogDescription></DialogHeader>
    {!results ? <div className="grid gap-4">
      <div className="rounded-lg border border-white/8 bg-white/[0.03] p-3 text-xs leading-5 text-zinc-400"><p><strong className="text-zinc-200">Formato:</strong> {TEAM_LINE_FORMAT}</p><p>Só nome, e-mail e função são obrigatórios. Função: Administrador, Coordenação, Líder, Comercial (também vale &ldquo;Executivo(a) de Vendas&rdquo;), ou Mentorado (entra só no portal de mentoria). Cidade vazia = todas. Mentoria = número do ciclo (vazio = não é mentorado). Pode colar direto de uma planilha.</p><Button type="button" size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs text-gold-soft" onClick={() => setText(EXAMPLE)}>Ver exemplo</Button></div>
      <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={7} placeholder={EXAMPLE} className="border-white/12 bg-white/5 font-mono text-xs" aria-label="Lista da equipe" />
      {rows.length > 0 && <div className="overflow-x-auto rounded-lg border border-white/8"><Table><TableHeader><TableRow className="border-white/8"><TableHead>Linha</TableHead><TableHead>Pessoa</TableHead><TableHead>Função</TableHead><TableHead>Cidade</TableHead><TableHead>Cargo / mentoria</TableHead><TableHead>Prévia</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.line} className="border-white/7"><TableCell>{row.line}</TableCell><TableCell><p className="text-white">{row.name || "—"}</p><p className="text-xs text-subtle">{row.email}</p></TableCell><TableCell>{row.role ? roleLabel(row.role) : "—"}</TableCell><TableCell>{row.cityName || "Todas"}</TableCell><TableCell className="text-xs">{[row.title, mentorshipLabel(row.mentorshipCycle)].filter(Boolean).join(" · ") || "—"}</TableCell><TableCell className="text-xs">{row.error ? <span className="text-red-300">{row.error}</span> : <span className="text-emerald-300">{existing.has(row.email) ? "Atualiza o perfil e gera link novo" : "Pronto"}</span>}</TableCell></TableRow>)}</TableBody></Table></div>}
      {valid.length > MAX_TEAM_ROWS && <p role="alert" className="text-sm text-red-300">Envie no máximo {MAX_TEAM_ROWS} pessoas por vez.</p>}
      <div className="flex flex-wrap items-center justify-end gap-2"><span className="mr-auto text-xs text-subtle">{valid.length} pronta(s){rows.length - valid.length ? ` · ${rows.length - valid.length} com ajuste pendente (ficam de fora)` : ""}</span><Button variant="ghost" onClick={close} disabled={busy}>Cancelar</Button><Button onClick={submit} disabled={busy || !valid.length || valid.length > MAX_TEAM_ROWS} className="bg-gold text-black">{busy ? <><LoaderCircle className="animate-spin" /> Cadastrando…</> : <><KeyRound /> Cadastrar e gerar {valid.length || ""} link(s)</>}</Button></div>
    </div> : <div className="grid gap-3">
      {allMessages && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold/25 bg-gold/5 p-3 text-sm"><span>Envie cada mensagem só para a própria pessoa.</span><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={async () => { if (await copyText(allMessages)) toast.success("Todas as mensagens copiadas."); }}><Copy /> Copiar todas</Button></div>}
      {results.map((item) => <article key={item.email} className="rounded-lg border border-white/8 bg-white/[0.03] p-3"><div className="mb-2 flex items-start gap-2">{item.ok ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-300" /> : <XCircle className="mt-0.5 size-4 text-red-300" />}<div><p className="font-medium text-white">{item.name}</p><p className="text-xs text-subtle">{item.email}</p></div></div>{item.ok && item.link ? <SendButtons message={inviteMessage(item.name, item.link, false, portalEmails.has(item.email), data.access.organizationName)} link={item.link} /> : <p className="text-sm text-red-200">{item.error}</p>}</article>)}
      <div className="flex justify-end gap-2"><Button variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => { setResults(null); setText(""); }}>Convidar mais pessoas</Button><Button onClick={close} className="bg-gold text-black">Concluir</Button></div>
    </div>}
  </DialogContent></Dialog>;
}

/** Aba "Time e acessos": quem é da equipe, o que cada um acessa e em que pé está o login. */
export function TeamPanel({ data, onData, onRefresh, open, startInvite = false }: { data: DashboardData; onData: (data: DashboardData) => void; onRefresh: () => Promise<void>; open: (dialog: DialogState) => void; startInvite?: boolean }) {
  const [linkFor, setLinkFor] = useState<UserProfileRecord | null>(null);
  // "+ Novo → Convidar equipe" abre esta tela já com o convite aberto.
  const [bulk, setBulk] = useState(startInvite);
  const states = data.users.map(accessState);
  const count = (tone: Access["tone"]) => states.filter((state) => state.tone === tone).length;
  return <section className="space-y-4">
    <AccessLinkDialog key={linkFor?.id ?? 0} user={linkFor} organization={data.access.organizationName} onClose={() => setLinkFor(null)} onDone={() => { onRefresh().catch(() => undefined); }} />
    <BulkInviteDialog open={bulk} data={data} onClose={() => setBulk(false)} onData={onData} />
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="section-kicker">Equipe Elite</p><h2 className="text-2xl font-semibold tracking-tight text-white">Time e acessos</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Cadastre quem vai trabalhar na plataforma, envie o link de acesso e acompanhe quem já entrou. A função define o que cada pessoa vê; o cargo e a mentoria só descrevem.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => open({ name: "user" })}><Plus /> Adicionar pessoa</Button><Button className="bg-gold text-black" onClick={() => setBulk(true)}><UsersRound /> Convidar equipe</Button></div></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([["Ativos", count("ok"), "ok"], ["Convite enviado", count("wait"), "wait"], ["Convite vencido", count("late"), "late"], ["Sem convite", count("none"), "none"]] as const).map(([label, value, tone]) => <div key={label} className="elite-card p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">{label}</p><p className={`mt-1 text-2xl font-semibold ${value && tone !== "ok" ? (tone === "late" ? "text-red-300" : "text-amber-200") : "text-white"}`}>{value}</p></div>)}</div>
    <article className="elite-card overflow-hidden"><div className="elite-table-stack overflow-x-auto"><Table><TableHeader><TableRow className="border-white/8"><TableHead>Pessoa</TableHead><TableHead>Cargo</TableHead><TableHead>Função e alcance</TableHead><TableHead>Acesso</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{data.users.map((user, index) => { const state = states[index]; return <TableRow key={user.id} className="border-white/7"><TableCell data-label="Pessoa"><p className="font-medium text-white">{user.name}</p><p className="text-xs text-subtle">{user.email}</p></TableCell><TableCell data-label="Cargo"><p className="text-sm text-zinc-200">{user.title || <span className="text-subtle">—</span>}</p>{user.mentorshipCycle > 0 && <Badge variant="outline" className="mt-1 border-violet-400/30 bg-violet-400/10 text-violet-200">{mentorshipLabel(user.mentorshipCycle)}</Badge>}</TableCell><TableCell data-label="Função"><p className="text-sm text-zinc-200">{roleLabel(user.role)}</p><p className="text-xs text-subtle">{user.ambassadorName || user.cityName || "Todas as cidades"}</p></TableCell><TableCell data-label="Acesso"><Badge variant="outline" className={toneClass[state.tone]}>{state.label}</Badge><p className="mt-1 text-xs text-subtle">{state.detail}</p></TableCell><TableCell data-label=""><div className="flex justify-end gap-2">{user.active && <Button size="sm" variant="outline" onClick={() => setLinkFor(user)} className="h-8 border-white/10 bg-white/5 px-2 text-xs text-white"><KeyRound /> {user.hasPassword ? "Nova senha" : state.tone === "none" ? "Gerar link" : "Novo link"}</Button>}<Button size="sm" variant="ghost" aria-label={`Editar ${user.name}`} onClick={() => open({ name: "user", entityId: user.id })} className="h-8 px-2 text-zinc-300"><Pencil /></Button></div></TableCell></TableRow>; })}</TableBody></Table></div>
      <p className="border-t border-white/8 px-5 py-4 text-xs leading-5 text-subtle">O link é pessoal, vale por 72 horas e só funciona uma vez. Depois de criar a senha, a pessoa entra sempre por <strong className="text-zinc-300">/entrar</strong> com o e-mail e a senha dela.</p>
    </article>
  </section>;
}
