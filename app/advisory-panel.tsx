"use client";
/**
 * Assessoria Elite na empresa cliente: quem acompanha, a regra de acesso (decidida pela empresa)
 * e as últimas entradas. A assessoria vê a regra, mas não muda.
 */
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarClock, LoaderCircle, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AdvisoryMode, AdvisoryPolicy } from "@/lib/advisory";
import type { DashboardData } from "@/lib/expansion-types";
import { tenantFetch } from "@/lib/tenant-request";

const OPTIONS: { mode: AdvisoryMode; label: string; help: string }[] = [
  { mode: "liberado", label: "Liberado", help: "A assessoria entra quando precisar acompanhar a operação." },
  { mode: "prazo", label: "Liberado até uma data", help: "Depois da data, ninguém da assessoria entra até você liberar de novo." },
  { mode: "desligado", label: "Desligado", help: "Ninguém da assessoria entra. A empresa some da lista da assessoria." },
];
/** Hoje no fuso de Brasília, AAAA-MM-DD (o mesmo dia que o servidor usa). */
const todayBr = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const when = (at: string) => { const [d, t = ""] = at.split(/[ T]/); return `${d.split("-").reverse().join("/")}${t ? ` às ${t.slice(0, 5)}` : ""}`; };

async function call(method: "GET" | "POST", body?: Record<string, unknown>): Promise<AdvisoryPolicy> {
  const response = await tenantFetch("/api/advisory", { method, cache: "no-store", ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível carregar agora.");
  return result.data;
}

export function AdvisoryPanel({ data }: { data: DashboardData }) {
  const readOnly = data.access.isAdvisory === true;
  const [policy, setPolicy] = useState<AdvisoryPolicy | null>(null);
  const [mode, setMode] = useState<AdvisoryMode>("liberado");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const apply = useCallback((p: AdvisoryPolicy) => { setPolicy(p); setMode(p.mode); setUntil(p.until ?? ""); }, []);
  useEffect(() => { call("GET").then(apply).catch((e: Error) => setError(e.message)); }, [apply]);

  const changed = policy !== null && (mode !== policy.mode || (mode === "prazo" && until !== (policy.until ?? "")));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try { apply(await call("POST", { mode, until: mode === "prazo" ? until : null })); toast.success("Acesso da assessoria atualizado."); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  const accesses = policy?.events.filter((e) => e.action === "advisory_access") ?? [];
  return <article className="elite-card p-6">
    <p className="section-kicker">Acompanhamento</p>
    <h3 className="text-lg font-semibold text-white">Assessoria Elite na sua empresa</h3>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">A assessoria acompanha a operação para mentorar e dar suporte. Quem decide se ela entra é a sua empresa, e cada entrada e cada alteração feita pela assessoria ficam no Histórico.</p>
    {data.advisors.length > 0 && <ul className="mt-4 flex flex-wrap gap-2" aria-label="Quem da assessoria acompanha">{data.advisors.map((advisor) => <li key={advisor.email} className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-sm"><span className="font-medium text-white">{advisor.name}</span><span className="block text-xs text-subtle">{advisor.email}</span></li>)}</ul>}
    {!policy ? (error ? <p role="alert" className="mt-4 text-sm text-red-200">{error}</p> : <p role="status" className="mt-4 flex items-center gap-2 text-sm text-zinc-400"><LoaderCircle className="size-4 animate-spin" /> Carregando…</p>) : <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <p className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${policy.allowed ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-white/15 bg-white/5 text-zinc-300"}`}>{policy.allowed ? <ShieldCheck className="size-4" /> : <ShieldOff className="size-4" />}Acesso da assessoria: {policy.label.toLowerCase()}</p>
        {policy.changedAt && <p className="mt-2 text-xs text-subtle">Última mudança em {when(policy.changedAt)}{policy.changedBy ? ` por ${policy.changedBy}` : ""}.</p>}
        {readOnly ? <p className="mt-4 text-sm text-zinc-400">Você está como Assessoria Elite: só o administrador da empresa muda esta regra.</p> : <form className="mt-4 grid gap-3" onSubmit={save}>
          <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-medium text-zinc-200">Acesso da assessoria</legend>
            {OPTIONS.map((o) => <label key={o.mode} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${mode === o.mode ? "border-gold/50 bg-gold/[0.06]" : "border-white/10 bg-black/20"}`}>
              <input type="radio" name="advisory-mode" value={o.mode} checked={mode === o.mode} onChange={() => setMode(o.mode)} className="mt-1" />
              <span><span className="font-medium text-white">{o.label}</span><span className="block text-xs text-zinc-400">{o.help}</span></span>
            </label>)}
          </fieldset>
          {mode === "prazo" && <label className="grid max-w-xs gap-1 text-sm text-zinc-200"><span className="flex items-center gap-2"><CalendarClock className="size-4 text-gold-soft" />Liberado até (inclusive)</span><input type="date" required min={todayBr()} value={until} onChange={(e) => setUntil(e.target.value)} className="commercial-input" /></label>}
          {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
          <div><Button type="submit" disabled={busy || !changed} className="bg-gold text-black">{busy ? <LoaderCircle className="animate-spin" /> : null}Salvar</Button></div>
        </form>}
      </div>
      <div>
        <h4 className="text-sm font-medium text-zinc-200">Últimas entradas da assessoria</h4>
        {accesses.length === 0 ? <p className="mt-2 text-sm text-subtle">Nenhuma entrada registrada ainda.</p> : <ul className="mt-2 grid gap-1.5 text-sm">{accesses.slice(0, 8).map((e) => <li key={`${e.at}-${e.actor}`} className="flex flex-wrap justify-between gap-x-3 rounded-lg border border-white/8 bg-black/20 px-3 py-2"><span className="text-white">{e.actor}</span><span className="text-xs text-subtle">{when(e.at)}</span></li>)}</ul>}
        <p className="mt-2 text-xs text-subtle">Uma linha por dia por pessoa da assessoria. O que ela alterou aparece no Histórico.</p>
      </div>
    </div>}
  </article>;
}
