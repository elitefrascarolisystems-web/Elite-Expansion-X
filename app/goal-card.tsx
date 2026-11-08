"use client";
/*
 * Hoje → cartão "Quanto falta": 2 linhas e o anel. Lê o progresso de goalProgress (a mesma fonte da Calculadora,
 * de Metas e rotina e de Saúde das cidades). Sem internet, diz "Sem conexão" em vez de mostrar número velho.
 */
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

import { Meter } from "@/components/elite/meter";
import { Button } from "@/components/ui/button";
import type { GoalProgress } from "@/db/goals";
import type { AccessView } from "@/lib/expansion-types";
import { daysBetween, shortDate } from "@/lib/goal-calculator";
import { formatTarget, type GoalMetricAny } from "@/lib/goals";
import { tenantFetch } from "@/lib/tenant-request";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function remaining(metric: GoalMetricAny, target: number, realized: number, end: string, today: string) {
  const left = Math.max(0, target - realized);
  const days = Math.max(0, daysBetween(today, end));
  if (!left) return "Meta batida";
  return `Faltam ${formatTarget(metric, left)} em ${days} ${days === 1 ? "dia" : "dias"} (até ${shortDate(end)})`;
}

export function GoalCard({ access, onGo }: { access: AccessView; onGo: (target: string) => void }) {
  const [state, setState] = useState<{ data?: GoalProgress; offline?: boolean; error?: boolean }>({});
  useEffect(() => {
    let live = true;
    tenantFetch("/api/calculator?view=goals", { cache: "no-store" })
      .then(async (r) => { const body = await r.json().catch(() => ({})); if (live) setState(r.ok ? { data: body.data } : { error: true }); })
      .catch(() => { if (live) setState({ offline: true }); });
    return () => { live = false; };
  }, []);
  const seller = access.role === "Comercial";
  const manage = access.role === "Administrador" || access.role === "Coordenação";
  if (state.error) return null;
  const shell = (children: React.ReactNode) => <article className="elite-card flex flex-wrap items-center gap-4 p-4" aria-label="Quanto falta">{children}</article>;
  if (state.offline) return shell(<p className="flex items-center gap-2 text-sm text-zinc-300"><WifiOff className="size-4 text-amber-200" aria-hidden />Sem conexão: a meta aparece quando a internet voltar.</p>);
  const data = state.data;
  if (!data) return shell(<p role="status" className="text-sm text-subtle">Carregando a meta…</p>);
  const month = MONTHS[Number(data.today.slice(5, 7)) - 1];

  if (seller) {
    const me = data.people[0];
    const sales = me?.sales;
    if (!sales) return shell(<><p className="mr-auto text-sm text-zinc-300">A gestão ainda não definiu sua meta.</p><Button size="sm" variant="outline" onClick={() => onGo("vendas/agenda")}>Abrir a agenda</Button></>);
    return shell(<>
      <Meter value={Math.min(sales.realized, sales.target)} max={Math.max(1, sales.target)} label={`Minha meta: ${sales.realized} de ${sales.target}`} valueText={sales.metric === "Receita confirmada" ? `${Math.round(sales.realized / Math.max(1, sales.target) * 100)}%` : `${sales.realized}/${sales.target}`} size={52} />
      <div className="mr-auto min-w-0"><p className="font-semibold text-white">Minha meta: {sales.metric === "Receita confirmada" ? `${formatTarget(sales.metric, sales.realized)} de ${formatTarget(sales.metric, sales.target)}` : `${sales.realized} de ${formatTarget(sales.metric, sales.target)}`}</p>
        <p className="text-xs text-subtle">{remaining(sales.metric, sales.target, sales.realized, sales.periodEnd, data.today)}{me.week ? ` · Semana: ${me.week.done} de ${me.week.target} atendimentos` : ""}</p></div>
      <Button size="sm" variant="outline" onClick={() => onGo("vendas/agenda")}>Abrir a agenda</Button>
    </>);
  }

  // Gestão: a meta da empresa (ou a soma das cidades) ou a da própria cidade.
  const ownCity = access.role !== "Administrador" ? data.cities[0] : null;
  const goal = ownCity ? ownCity.goal : data.company.goal;
  const sum = ownCity ? null : data.company.sum;
  const view = goal ? { metric: goal.metric, target: goal.target, realized: goal.realized, end: goal.periodEnd, note: goal.consolidated ? "fechamento consolidado" : "" }
    : sum ? { metric: sum.metric, target: sum.target, realized: sum.realized, end: sum.periodEnd, note: `soma de ${sum.withGoal} de ${sum.cities} cidades` } : null;
  if (!view) return shell(<><p className="mr-auto text-sm text-zinc-300">Sem meta para {month}{manage ? "" : ". A Coordenação define a meta da cidade na Calculadora."}</p>{manage && <Button size="sm" variant="outline" onClick={() => onGo("resultados/calculadora")}>Definir na calculadora</Button>}</>);
  const scope = ownCity ? ownCity.name : "Empresa";
  return shell(<>
    <Meter value={Math.min(view.realized, view.target)} max={Math.max(1, view.target)} label={`Meta de ${scope}: ${view.realized} de ${view.target}`} valueText={view.metric === "Receita confirmada" ? `${Math.round(view.realized / Math.max(1, view.target) * 100)}%` : `${view.realized}/${view.target}`} size={52} />
    <div className="mr-auto min-w-0"><p className="font-semibold text-white">Quanto falta · {scope}: {view.metric === "Receita confirmada" ? `${formatTarget(view.metric, view.realized)} de ${formatTarget(view.metric, view.target)}` : `${view.realized} de ${formatTarget(view.metric, view.target)}`}</p>
      <p className="text-xs text-subtle">{remaining(view.metric, view.target, view.realized, view.end, data.today)}{view.note ? ` · ${view.note}` : ""}{!ownCity && data.unowned ? ` · sem responsável: ${data.unowned}` : ""}</p></div>
    <Button size="sm" variant="outline" onClick={() => onGo("resultados/calculadora")}>Abrir calculadora</Button>
  </>);
}

/** Progresso das metas para outras telas (coluna "Meta" de Saúde das cidades). Sem conexão: null. */
export function useGoalProgress(enabled = true) {
  const [data, setData] = useState<GoalProgress | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    tenantFetch("/api/calculator?view=goals", { cache: "no-store" }).then(async (r) => { const body = await r.json().catch(() => ({})); if (live && r.ok) setData(body.data); }).catch(() => {});
    return () => { live = false; };
  }, [enabled]);
  return data;
}

/** Célula "Meta": realizado sobre a meta, com barra e prazo. */
export function GoalCell({ progress, cityId }: { progress: GoalProgress | null; cityId: number }) {
  if (!progress) return <span className="text-xs text-subtle">—</span>;
  const goal = progress.cities.find((c) => c.cityId === cityId)?.goal;
  if (!goal) return <span className="text-xs text-subtle">Sem meta</span>;
  const pct = goal.target > 0 ? Math.min(100, goal.realized / goal.target * 100) : 0;
  const fmt = (n: number) => goal.metric === "Receita confirmada" ? formatTarget(goal.metric, n) : String(n);
  return <div className="min-w-28">
    <div className="mb-1 flex justify-between gap-2 text-xs"><span>{fmt(goal.realized)} de {fmt(goal.target)}</span><span className="text-subtle">até {shortDate(goal.periodEnd)}</span></div>
    <div className="h-1.5 overflow-hidden rounded-full bg-white/8" role="img" aria-label={`Meta: ${fmt(goal.realized)} de ${fmt(goal.target)} ${goal.metric === "Vendas pagas" ? "vendas pagas" : ""}, até ${shortDate(goal.periodEnd)}`}><div className="h-full bg-gold" style={{ width: `${pct}%` }} /></div>
    {goal.consolidated && <p className="mt-1 text-[11px] text-subtle">fechamento consolidado</p>}
  </div>;
}
