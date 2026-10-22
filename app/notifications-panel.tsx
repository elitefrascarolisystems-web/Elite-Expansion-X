"use client";
import { useEffect, useState } from "react";
import { BellRing, CircleCheck, LoaderCircle, Mail, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NOTIFICATION_LABEL, SEND_TIME, type EmailContent } from "@/lib/notifications";
import { tenantFetch } from "@/lib/tenant-request";

type MyPrefs = { daily: boolean; weekly: boolean; canWeekly: boolean; configured: boolean };
type Person = { email: string; name: string; role: string; daily: boolean; weekly: boolean; lastDaily: string | null; lastWeekly: string | null };
type Overview = {
  configured: boolean; missing: string[]; people: Person[];
  lastRun: { ranAt: string; configured: boolean; sent: number; failed: number; skipped: number; detail: string } | null;
  preview: { daily: EmailContent | null; weekly: EmailContent };
};

async function load<T>(query = ""): Promise<T> {
  const response = await tenantFetch(`/api/notifications${query}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível carregar os avisos.");
  return body as T;
}
async function post(action: string, data?: unknown) {
  const response = await tenantFetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) throw new Error(body.error || "Não foi possível salvar. Confira a conexão e tente de novo.");
  return body.result;
}
const when = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "ainda não";

/** Cartão em Hoje: cada pessoa liga ou desliga os próprios avisos. */
export function NoticesCard() {
  const [prefs, setPrefs] = useState<MyPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { let alive = true; load<MyPrefs>().then((value) => { if (alive) setPrefs(value); }).catch(() => undefined); return () => { alive = false; }; }, []);
  if (!prefs) return null;
  async function change(next: MyPrefs) {
    const before = prefs; setPrefs(next); setBusy(true);
    try { await post("prefs", { daily: next.daily, weekly: next.weekly }); }
    catch (e) { setPrefs(before); toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Avisos por e-mail" className="elite-card grid gap-3 p-5">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-gold/10 p-2.5 text-gold-soft"><BellRing className="size-5" aria-hidden /></span><div><h2 className="font-semibold text-white">Avisos por e-mail</h2><p className="text-sm text-zinc-400">Chegam às {SEND_TIME}, horário de Brasília.</p></div></div>
    <label className="flex items-start justify-between gap-4 text-sm"><span><span className="block text-zinc-100">{NOTIFICATION_LABEL.diario}</span><span className="text-zinc-400">Seus retornos atrasados e os de hoje. Sem retorno no dia, não chega e-mail.</span></span><Switch checked={prefs.daily} disabled={busy} onCheckedChange={(daily) => change({ ...prefs, daily })} aria-label={NOTIFICATION_LABEL.diario} /></label>
    {prefs.canWeekly && <label className="flex items-start justify-between gap-4 text-sm"><span><span className="block text-zinc-100">{NOTIFICATION_LABEL.semanal}</span><span className="text-zinc-400">Às segundas: mapeamento, atendimentos e vendas da semana, e quem tem retorno atrasado.</span></span><Switch checked={prefs.weekly} disabled={busy} onCheckedChange={(weekly) => change({ ...prefs, weekly })} aria-label={NOTIFICATION_LABEL.semanal} /></label>}
    {!prefs.configured && <p className="text-xs text-subtle">O envio começa quando a Elite ligar o serviço de e-mail. Sua escolha já fica salva.</p>}
  </section>;
}

/** Gestão → Avisos por e-mail: situação do envio, prévia dos e-mails e quem recebe. */
export function NotificationsPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"daily" | "weekly">("daily");
  const [sending, setSending] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    load<Overview>("?visao=1").then((value) => { if (alive) { setData(value); setError(""); } }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Não foi possível carregar."); });
    return () => { alive = false; };
  }, [revision]);

  async function toggle(person: Person, changes: Partial<Pick<Person, "daily" | "weekly">>) {
    try { await post("prefs", { email: person.email, daily: changes.daily ?? person.daily, weekly: changes.weekly ?? person.weekly }); setRevision((v) => v + 1); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
  }
  async function test() {
    setSending(true);
    try { const result = await post("test") as { sent: number }; toast.success(`${result.sent === 1 ? "1 e-mail de teste enviado" : `${result.sent} e-mails de teste enviados`} para você.`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível enviar."); }
    finally { setSending(false); }
  }

  if (error) return <p role="alert" className="elite-card p-6 text-sm text-red-200">{error}</p>;
  if (!data) return <p role="status" className="elite-card flex items-center gap-2 p-6 text-sm text-zinc-400"><LoaderCircle className="size-4 animate-spin" /> Carregando avisos…</p>;
  const preview = tab === "daily" ? data.preview.daily : data.preview.weekly;

  return <div className="space-y-5">
    <section className={`elite-card grid gap-3 p-5 ${data.configured ? "border-emerald-400/25" : "border-amber-300/25"}`}>
      <div className="flex flex-wrap items-start gap-3">
        {data.configured ? <CircleCheck className="mt-0.5 size-5 text-emerald-300" aria-hidden /> : <TriangleAlert className="mt-0.5 size-5 text-amber-200" aria-hidden />}
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-white">{data.configured ? "Envio ligado" : "Envio ainda desligado"}</h2>
          <p className="text-sm leading-6 text-zinc-400">{data.configured
            ? `Todo dia às ${SEND_TIME} (Brasília) sai o lembrete dos retornos; às segundas, também o resumo semanal da gestão.`
            : "Tudo já está pronto: quem recebe, o conteúdo e o horário. Os e-mails começam a sair quando o serviço de e-mail for configurado na publicação, junto com o endereço oficial da plataforma."}</p>
          {!data.configured && <p className="mt-1 text-xs text-subtle">Falta configurar: {data.missing.join(", ")}.</p>}
          {data.lastRun && <p className="mt-1 text-xs text-subtle">Última rodada: {when(data.lastRun.ranAt)} · {data.lastRun.sent} enviado(s){data.lastRun.failed ? ` · ${data.lastRun.failed} com falha` : ""}{data.lastRun.detail ? ` · ${data.lastRun.detail}` : ""}</p>}
        </div>
        <Button onClick={test} disabled={!data.configured || sending} title={data.configured ? undefined : "Disponível quando o envio estiver ligado."} className="bg-gold text-black hover:bg-gold-hover">{sending ? <LoaderCircle className="animate-spin" /> : <Send />} Enviar teste para mim</Button>
      </div>
    </section>

    <section className="elite-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-5 py-3">
        <Mail className="size-4 text-gold-soft" aria-hidden /><h2 className="mr-auto font-semibold text-white">Como chega o e-mail</h2>
        {(["daily", "weekly"] as const).map((key) => <Button key={key} size="sm" variant={tab === key ? "secondary" : "ghost"} onClick={() => setTab(key)}>{key === "daily" ? "Lembrete diário" : "Resumo semanal"}</Button>)}
      </div>
      {preview ? <>
        <p className="border-b border-white/8 px-5 py-2 text-sm text-zinc-300"><span className="text-subtle">Assunto: </span>{preview.subject}</p>
        <iframe title={`Prévia: ${preview.subject}`} srcDoc={preview.html} sandbox="" className="h-[34rem] w-full bg-[#f4f1ea]" />
      </> : <p className="p-5 text-sm text-zinc-400">Hoje você não tem retornos atrasados nem para hoje, então o lembrete diário não seria enviado. Ele só sai quando há o que fazer.</p>}
      <p className="border-t border-white/8 px-5 py-2 text-xs text-subtle">Prévia com os seus dados de agora. Cada pessoa recebe a própria agenda.</p>
    </section>

    <section className="elite-card overflow-hidden">
      <div className="border-b border-white/8 px-5 py-3"><h2 className="font-semibold text-white">Quem recebe</h2><p className="text-sm text-zinc-400">Cada pessoa também pode mudar os próprios avisos em Hoje, ou pelo link no fim do e-mail.</p></div>
      <ul className="divide-y divide-white/8">{data.people.map((person) => <li key={person.email} className="grid gap-2 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6">
        <div className="min-w-0"><p className="truncate text-zinc-100">{person.name}</p><p className="truncate text-xs text-subtle">{person.role} · {person.email}</p></div>
        <label className="flex items-center justify-between gap-3 sm:justify-start"><span><span className="block text-zinc-300">Diário</span><span className="text-xs text-subtle">último: {when(person.lastDaily)}</span></span><Switch checked={person.daily} onCheckedChange={(daily) => toggle(person, { daily })} aria-label={`Lembrete diário para ${person.name}`} /></label>
        {person.role === "Administrador" ? <label className="flex items-center justify-between gap-3 sm:justify-start"><span><span className="block text-zinc-300">Semanal</span><span className="text-xs text-subtle">último: {when(person.lastWeekly)}</span></span><Switch checked={person.weekly} onCheckedChange={(weekly) => toggle(person, { weekly })} aria-label={`Resumo semanal para ${person.name}`} /></label> : <span className="hidden text-xs text-subtle sm:block">Resumo só para administradores</span>}
      </li>)}</ul>
    </section>
  </div>;
}
