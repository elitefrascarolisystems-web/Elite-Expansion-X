"use client";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { tenantFetch } from "@/lib/tenant-request";

type Advisor = { email: string; name: string; active: boolean; eliteMember: boolean; platformOwner: boolean; grantedAt: string; revokedAt: string | null };

/** Quem do time Elite tem acesso de assessoria às empresas clientes (só donos da plataforma). */
export function AdvisorsPanel() {
  const [advisors, setAdvisors] = useState<Advisor[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    tenantFetch("/api/organizations", { signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setAdvisors(body.advisors ?? []); })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível carregar."); });
    return () => controller.abort();
  }, []);

  async function save(data: { email: string; active: boolean }) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await tenantFetch("/api/organizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "advisor", data }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Não foi possível salvar. Confira a conexão e tente de novo.");
      setAdvisors(result.advisors);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir. Confira a conexão e tente de novo."); return false; }
    finally { lock.current = false; setBusy(false); }
  }

  return <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
    <article className="elite-card overflow-hidden">
      <div className="border-b border-white/8 p-5"><p className="section-kicker">Assessoria Elite</p><h2 className="text-lg font-semibold text-white">Quem acompanha as empresas clientes</h2><p className="mt-1 text-sm leading-6 text-zinc-400">Assessores podem ver e editar as empresas clientes para mentoria e suporte. Os clientes veem quem tem esse acesso, e cada alteração fica registrada. Quem sai do time Elite perde o acesso na hora.</p></div>
      {advisors === null && !error ? <p role="status" className="flex items-center gap-2 p-5 text-sm text-zinc-400"><LoaderCircle className="size-4 animate-spin" /> Carregando…</p>
        : <ul className="divide-y divide-white/7">{(advisors ?? []).map((a) => <li key={a.email} className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0"><p className="truncate font-medium text-white">{a.name || a.email}</p><p className="truncate text-xs text-subtle">{a.email}{!a.active ? " · acesso retirado" : !a.eliteMember ? " · fora do time Elite (sem acesso)" : ""}</p></div>
          {a.platformOwner ? <span className="shrink-0 text-xs text-subtle">Dono da plataforma</span>
            : <Button size="sm" variant="outline" disabled={busy} className="shrink-0 border-white/10 bg-white/5 text-white" onClick={() => save({ email: a.email, active: !a.active })}>{a.active ? "Retirar" : "Reativar"}</Button>}
        </li>)}</ul>}
    </article>
    <form className="elite-card grid content-start gap-3 p-5 text-sm" onSubmit={async (e) => { e.preventDefault(); if (await save({ email, active: true })) setEmail(""); }}>
      <h3 className="font-semibold text-white">Adicionar assessor</h3>
      <label className="grid gap-1 text-zinc-300">E-mail de um membro ativo da Elite<input required type="email" maxLength={254} className="commercial-input" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {error && <p role="alert" className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-amber-100">{error}</p>}
      <Button disabled={busy} type="submit" className="bg-gold text-black">{busy ? "Salvando…" : "Conceder assessoria"}</Button>
    </form>
  </section>;
}
