"use client";
/*
 * Calculadora → "Aplicar como meta", "Dividir pela equipe" e "Metas anteriores".
 * São as duas únicas gravações de meta (tabela goals). Aplicar nunca cria tarefa, missão, mensagem nem rotina do dia.
 */
import { useState } from "react";
import { Target, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AccessView } from "@/lib/expansion-types";
import { shortDate } from "@/lib/goal-calculator";
import { applySummary, formatTarget, historyLine, proportionalSplit, type Goal } from "@/lib/goals";
import { tenantFetch } from "@/lib/tenant-request";

export type GoalsPayload = { active: Goal[]; history: (Goal & { realized: number })[]; premises: Record<string, number> };
type Rate = { value: number | null; source: "real" | "sem-dados" | "consolidado" | "estimativa" };
type SplitRow = { email: string; name: string; sales: string; leads: string; people: string; maps: boolean };

async function post(action: "apply" | "split", data: unknown) {
  const response = await tenantFetch("/api/calculator", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível gravar a meta agora.");
  return body;
}

export function GoalPanel(props: {
  access: AccessView; cityId: number | null; scopeName: string; today: string; periodStart: string; periodEnd: string;
  metric: "Vendas pagas" | "Receita confirmada"; target: number | null;
  plan: { leads: number; people: number | null; startBy: string } | null;
  assumptions: Record<string, Rate>; goals: GoalsPayload | null; onSaved: () => void;
}) {
  const { access, cityId, scopeName, today, goals } = props;
  const [applyOpen, setApplyOpen] = useState(false);
  const [withPlan, setWithPlan] = useState(true);
  const [busy, setBusy] = useState(false);
  const [split, setSplit] = useState<{ rows: SplitRow[]; error?: string } | null>(null);
  const role = access.role;
  const canApply = role === "Administrador" || (role === "Coordenação" && cityId === access.cityId);
  const canSplit = cityId !== null && (role === "Administrador" || ((role === "Coordenação" || role === "Líder") && cityId === access.cityId));
  const scopeGoals = (goals?.active ?? []).filter((g) => cityId === null ? g.scope === "Empresa" : g.cityId === cityId && g.scope === "Cidade");
  const current = scopeGoals.find((g) => (g.metric === "Vendas pagas" || g.metric === "Receita confirmada") && g.periodStart <= today && today <= g.periodEnd) ?? null;
  const cityPlan = scopeGoals.filter((g) => g.metric === "Atendimentos" || g.metric === "Pessoas mapeadas");
  const personGoals = cityId === null ? [] : (goals?.active ?? []).filter((g) => g.scope === "Pessoa" && g.cityId === cityId);
  const plan = withPlan ? props.plan : null;
  const newGoal = { metric: props.metric, periodStart: props.periodStart, periodEnd: props.periodEnd };
  const overlaps = (g: Goal, start: string, end: string, metrics: string[]) => metrics.includes(g.metric) && g.periodStart <= end && start <= g.periodEnd;
  const replaced = scopeGoals.filter((g) => overlaps(g, newGoal.periodStart, newGoal.periodEnd, [props.metric]) || (plan !== null && overlaps(g, today, plan.startBy, plan.people === null ? ["Atendimentos"] : ["Atendimentos", "Pessoas mapeadas"])));
  const targetCents = props.target === null ? null : props.metric === "Receita confirmada" ? Math.round(props.target * 100) : Math.round(props.target);
  const summary = targetCents === null ? "" : applySummary({ scopeName: cityId === null ? `da empresa ${scopeName}` : `de ${scopeName}`, metric: props.metric, target: targetCents, periodStart: props.periodStart, periodEnd: props.periodEnd, plan: plan ? { ...plan, from: today } : null, replaced: replaced.filter((g) => g.metric === props.metric) });

  async function apply() {
    if (targetCents === null) return;
    setBusy(true);
    try {
      await post("apply", { cityId, metric: props.metric, target: targetCents, periodStart: props.periodStart, periodEnd: props.periodEnd, assumptions: props.assumptions, plan, replace: replaced.map((g) => ({ id: g.id, version: g.version })) });
      toast.success("Meta aplicada.");
      setApplyOpen(false); props.onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível gravar a meta agora."); } finally { setBusy(false); }
  }

  async function openSplit() {
    if (!current || cityId === null) return;
    setSplit({ rows: [] });
    try {
      const response = await tenantFetch(`/api/calculator?view=split&cityId=${cityId}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar a equipe.");
      const team = body.data as { email: string; name: string; sales: number; leads: number; people: number; maps: boolean }[];
      // Em proporção ao que cada um fez nas últimas 8 semanas; sem base, partes iguais. Editável.
      const sales = proportionalSplit(current.target, team.map((t) => t.sales || t.leads));
      const leadsPlan = cityPlan.find((g) => g.metric === "Atendimentos");
      const peoplePlan = cityPlan.find((g) => g.metric === "Pessoas mapeadas");
      const leads = leadsPlan ? proportionalSplit(leadsPlan.target, team.map((t) => t.leads)) : null;
      const mappers = team.filter((t) => t.maps);
      const people = peoplePlan && mappers.length ? proportionalSplit(peoplePlan.target, mappers.map((t) => t.people)) : null;
      setSplit({ rows: team.map((t, i) => ({ email: t.email, name: t.name, sales: String(sales[i]), leads: leads ? String(leads[i]) : "", people: people && t.maps ? String(people[mappers.indexOf(t)]) : "", maps: t.maps })) });
    } catch (e) { setSplit({ rows: [], error: e instanceof Error ? e.message : "Não foi possível carregar a equipe." }); }
  }

  async function saveSplit() {
    if (!split || !current) return;
    setBusy(true);
    try {
      const rows = split.rows.filter((r) => Number(r.sales) > 0 || Number(r.leads) > 0 || Number(r.people) > 0)
        .map((r) => ({ email: r.email, sales: Number(r.sales) || 0, leads: r.leads === "" ? null : Number(r.leads) || 0, people: r.maps && r.people !== "" ? Number(r.people) || 0 : null }));
      await post("split", { goalId: current.id, rows, replace: personGoals.map((g) => ({ id: g.id, version: g.version })) });
      toast.success("Meta dividida pela equipe.");
      setSplit(null); props.onSaved();
    } catch (e) { setSplit((s) => s && { ...s, error: e instanceof Error ? e.message : "Não foi possível dividir agora." }); } finally { setBusy(false); }
  }

  const splitTotal = split?.rows.reduce((s, r) => s + (Number(r.sales) || 0), 0) ?? 0;
  const unit = current?.metric === "Receita confirmada" ? "R$ (em centavos)" : "vendas";

  return <article className="elite-card grid gap-3 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="section-kicker">Meta</p>
        <p className="text-sm text-white">{current ? `Meta aplicada: ${formatTarget(current.metric, current.target)} de ${shortDate(current.periodStart)} a ${shortDate(current.periodEnd)}` : `Sem meta aplicada para ${scopeName}.`}</p>
        {current && personGoals.length > 0 && <p className="text-xs text-subtle">Dividida entre {new Set(personGoals.map((g) => g.ownerEmail)).size} pessoa(s) da equipe.</p>}
        {cityPlan.length > 0 && <p className="text-xs text-subtle">Plano: {cityPlan.map((g) => `${formatTarget(g.metric, g.target)} até ${shortDate(g.periodEnd)}`).join(" · ")}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {canApply && <Button type="button" disabled={targetCents === null || targetCents <= 0} onClick={() => setApplyOpen(true)}><Target /> Aplicar como meta</Button>}
        {canSplit && <Button type="button" variant="outline" disabled={!current} title={!current ? "Aplique primeiro a meta da cidade." : undefined} onClick={openSplit}><Users /> Dividir pela equipe</Button>}
      </div>
    </div>
    {role === "Líder" && !current && <p className="text-xs text-subtle">Quando a Coordenação ou o Administrador aplicar a meta da cidade, você pode dividi-la pela equipe aqui.</p>}
    {(goals?.history.length ?? 0) > 0 && <details className="text-sm"><summary className="cursor-pointer text-zinc-300">Metas anteriores</summary>
      <ul className="mt-2 grid gap-1 text-zinc-300">{goals!.history.map((g) => <li key={g.id}>{historyLine(g, g.realized)}{g.status === "Substituída" ? " · substituída" : ""}</li>)}</ul>
      <p className="mt-1 text-xs text-subtle">O realizado é recalculado agora: muda se um pagamento for cancelado ou houver pedido LGPD.</p>
    </details>}

    <Dialog open={applyOpen} onOpenChange={(open) => { if (!busy) setApplyOpen(open); }}>
      <DialogContent className="bg-zinc-950 text-white">
        <DialogHeader><DialogTitle>Aplicar como meta</DialogTitle>
          <DialogDescription>Isto será gravado e passa a aparecer em Hoje, em Metas e rotina e em Saúde das cidades. Nenhuma tarefa, missão ou mensagem é criada.</DialogDescription></DialogHeader>
        <p className="rounded-lg border border-white/10 p-3 text-sm">{summary}</p>
        {props.plan ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={withPlan} onChange={(e) => setWithPlan(e.target.checked)} />
          <span>Gravar também o plano<span className="block text-xs text-subtle">Atendimentos e pessoas mapeadas de hoje até a data de começar ({shortDate(props.plan.startBy)}): atendimento começado depois dela já não paga até o prazo.</span></span></label>
          : <p className="text-xs text-subtle">Sem plano de atendimentos para gravar (faltam dados ou o que está em andamento já basta).</p>}
        <p className="text-xs text-subtle">As taxas e premissas de agora vão junto, como foto do plano.</p>
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setApplyOpen(false)}>Cancelar</Button><Button type="button" disabled={busy} onClick={apply}>{busy ? "Gravando…" : "Aplicar como meta"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={split !== null} onOpenChange={(open) => { if (!open && !busy) setSplit(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-zinc-950 text-white">
        <DialogHeader><DialogTitle>Dividir pela equipe</DialogTitle>
          <DialogDescription>Preenchido em proporção ao que cada pessoa fez nas últimas 8 semanas (sem base, em partes iguais). Ajuste à vontade: a soma das vendas precisa fechar com a meta da cidade.</DialogDescription></DialogHeader>
        {split && !split.rows.length && !split.error && <p role="status" className="text-sm">Carregando a equipe…</p>}
        {split && split.rows.length > 0 && <div className="grid gap-2">
          <div className="grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem] gap-2 text-xs text-subtle"><span>Pessoa</span><span>{current?.metric === "Receita confirmada" ? "Receita" : "Vendas"}</span><span>Atend.</span><span>Mapear</span></div>
          {split.rows.map((r, i) => <div key={r.email} className="grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem] items-center gap-2 text-sm">
            <span className="truncate">{r.name}</span>
            {(["sales", "leads", "people"] as const).map((k) => k === "people" && !r.maps ? <span key={k} className="text-xs text-subtle">—</span>
              : <input key={k} inputMode="numeric" aria-label={`${k === "sales" ? "Vendas" : k === "leads" ? "Atendimentos" : "Pessoas a mapear"} de ${r.name}`} className="commercial-input w-full" value={r[k]} onChange={(e) => setSplit((s) => s && { ...s, rows: s.rows.map((row, j) => j === i ? { ...row, [k]: e.target.value.replace(/\D/g, "") } : row) })} />)}
          </div>)}
          <p className={`text-sm ${current && splitTotal !== current.target ? "text-amber-200" : "text-emerald-300"}`}>Soma: {splitTotal} de {current?.target ?? 0} {unit}</p>
        </div>}
        {split?.error && <p role="alert" className="text-sm text-amber-200">{split.error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setSplit(null)}>Cancelar</Button><Button type="button" disabled={busy || !split?.rows.length || splitTotal !== current?.target} onClick={saveSplit}>{busy ? "Gravando…" : "Dividir pela equipe"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </article>;
}
