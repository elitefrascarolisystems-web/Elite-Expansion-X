"use client";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calculator, Copy, Minus, Plus, RotateCcw, Sparkles, TrendingUp, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { ChartFrame } from "@/components/elite/chart-frame";
import { Meter } from "@/components/elite/meter";
import { Segmented } from "@/components/elite/segmented";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { CalculatorBaseResponse, Rate } from "@/db/calculator";
import type { AccessView } from "@/lib/expansion-types";
import {
  addDays, ceil6, divergence, floor6, goalNumbers, lastOfMonth, leverFlow, leversAvailable, MAX_DAYS, networkBonus, paceProjection,
  perMonth, projectAtCurrentPace, projectWithLevers, rankAdjustments, reverseFunnel, shortDate, smallestTeamCombo, summaryText,
  type Arrival, type CalculatorBase, type GoalMetric, type Levers,
} from "@/lib/goal-calculator";
import { copyText } from "@/lib/copy-text";
import { tenantFetch } from "@/lib/tenant-request";

const GoalPaceChart = lazy(() => import("@/app/charts/goal-pace-chart"));

type Period = "mes" | "proximo" | "data";
/** Premissas digitadas: só na tela (a Etapa 3 grava junto com a meta). */
type Premises = Partial<Record<"ticket" | "c" | "m" | "kv" | "km" | "a" | "cpl", number>>;
const PREMISES: { key: keyof Premises; label: string; unit: string; rate: keyof CalculatorBaseResponse["rates"] }[] = [
  { key: "ticket", label: "Ticket médio", unit: "R$", rate: "ticketCents" },
  { key: "c", label: "Conversão", unit: "%", rate: "c" },
  { key: "m", label: "Tempo até pagar", unit: "dias", rate: "m" },
  { key: "kv", label: "Capacidade de um vendedor por semana", unit: "atendimentos", rate: "kv" },
  { key: "km", label: "Pessoas por mapeador por semana", unit: "pessoas", rate: "Pm" },
  { key: "a", label: "Pessoa mapeada → atendimento", unit: "%", rate: "a" },
  { key: "cpl", label: "Custo por atendimento de mídia", unit: "R$", rate: "cplCents" },
];

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const money = (reais: number) => reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;
const plural = (n: number, one: string, many: string) => `${int(n)} ${n === 1 ? one : many}`;

function arrivalText(a: Arrival, target: string) {
  if (a.kind === "nodata") return "Sem dados suficientes";
  if (a.kind === "never") return "A meta não chega";
  if (a.days > MAX_DAYS) return "mais de 2 anos";
  const when = a.diff > 0 ? `${plural(a.diff, "dia", "dias")} depois` : a.diff < 0 ? `${plural(-a.diff, "dia", "dias")} antes` : "no prazo";
  const [low, high] = a.rangeDates;
  const range = low && high ? ` · entre ${shortDate(low)} e ${shortDate(high)}` : high === null && low ? ` · entre ${shortDate(low)} e mais de 2 anos` : "";
  return `${shortDate(a.date, a.date.slice(0, 4) !== target.slice(0, 4))} · ${when}${range}`;
}

function Origin({ rate, typed }: { rate?: Rate; typed?: boolean }) {
  if (typed) return <span className="text-xs text-amber-200">premissa · digitada por você</span>;
  if (!rate) return null;
  if (rate.source === "real") return <span className="text-xs text-emerald-300">real · {rate.base}</span>;
  if (rate.source === "consolidado") return <span className="text-xs text-subtle">{rate.base}</span>;
  return <span className="text-xs text-subtle">Sem dados suficientes: digite sua estimativa</span>;
}

/** Resultados → Calculadora: simula a meta com as taxas reais da empresa (nada é gravado). */
export function GoalCalculator({ access, cities, organizationName }: { access: AccessView; cities: { id: number; name: string }[]; organizationName: string }) {
  const fixedCity = access.role === "Coordenação" || access.role === "Líder" ? access.cityId : null;
  const [cityId, setCityId] = useState<number | null>(fixedCity);
  const [state, setState] = useState<{ loading: boolean; error?: string; offline?: boolean; base?: CalculatorBaseResponse }>({ loading: true });
  const [metric, setMetric] = useState<GoalMetric>("Vendas pagas");
  const [goal, setGoal] = useState("40");
  const [period, setPeriod] = useState<Period>("mes");
  const [until, setUntil] = useState("");
  const [premises, setPremises] = useState<Premises>({});
  const [levers, setLevers] = useState<Levers>({});

  useEffect(() => {
    let live = true;
    const query = cityId ? `?cityId=${cityId}` : "";
    tenantFetch(`/api/calculator${query}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!live) return;
        if (!response.ok) setState({ loading: false, error: body.error || "Não foi possível calcular agora." });
        else { setState({ loading: false, base: body.data }); setLevers({}); }
      })
      .catch(() => { if (live) setState({ loading: false, offline: true }); });
    return () => { live = false; };
  }, [cityId]);

  const api = state.base;
  const today = api?.today ?? "";
  const target = !api ? "" : period === "mes" ? lastOfMonth(today) : period === "proximo" ? lastOfMonth(today, 1) : until && until >= today ? until : lastOfMonth(today);
  const typed = (key: keyof Premises) => premises[key] !== undefined;

  const base: CalculatorBase | null = useMemo((): CalculatorBase | null => {
    if (!api) return null;
    const r = api.rates;
    const val = (rate: Rate) => rate.value;
    const nm = val(r.nm);
    return {
      today: api.today, target, metric, goal: Math.max(0, Number(goal.replace(/\./g, "").replace(",", ".")) || 0),
      paid: api.paid, paidRevenue: api.paidRevenueCents / 100,
      ticket: premises.ticket ?? (r.ticketCents.value === null ? null : r.ticketCents.value / 100),
      v: val(r.v), c: premises.c ?? val(r.c), m: premises.m ?? val(r.m),
      N: val(r.N), Nmap: r.Nmap, Nind: r.Nind, Nmid: r.Nmid, Nout: r.Nout,
      Pm: premises.km !== undefined && nm ? premises.km * nm : val(r.Pm), nm, a: premises.a ?? val(r.a),
      nv: val(r.nv), kv: premises.kv ?? val(r.kv), C: val(r.C), r: val(r.r),
      cpl: access.role === "Comercial" ? null : premises.cpl ?? (r.cplCents.value === null ? null : r.cplCents.value / 100),
      organicGoal: api.organicGoal,
    };
  }, [api, target, metric, goal, premises, access.role]);

  if (state.loading) return <article className="elite-card p-6 text-sm text-zinc-400">Calculando com os números da empresa…</article>;
  if (state.offline) return <article className="elite-card flex items-start gap-3 p-6 text-sm text-zinc-300"><WifiOff className="mt-0.5 size-5 text-amber-200" aria-hidden />Sem conexão: a Calculadora precisa da internet para buscar os números de hoje (não mostramos números velhos).</article>;
  if (state.error || !api || !base) return <article className="elite-card p-6 text-sm text-zinc-300" role="alert">{state.error ?? "Não foi possível calcular agora."}</article>;

  const g = goalNumbers(base);
  const now = projectAtCurrentPace(base);
  const funnel = reverseFunnel(base);
  const can = leversAvailable(base);
  const adjusted = projectWithLevers(base, levers);
  const flow = leverFlow(base, levers);
  const rank = rankAdjustments(base);
  const combo = smallestTeamCombo(base);
  const bonus = networkBonus(base);
  const scopeName = api.scope.kind === "Cidade" ? api.scope.cityName : organizationName;
  const unit = metric === "Receita confirmada" ? "receita" : "vendas";
  const mappers = levers.mappers ?? base.nm ?? 0, sellers = levers.sellers ?? base.nv ?? 0;
  const conversion = levers.conversion ?? base.c ?? 0;
  const referrals = levers.referralsPerMonth ?? (base.r ? perMonth(base.r) : 0);
  const media = levers.mediaPerMonth ?? 0;

  // Gráfico: realizado acumulado (em receita, em vendas equivalentes) e as projeções a partir de hoje.
  const horizon = Math.max(g.D, Math.min(MAX_DAYS, adjusted.kind === "date" ? adjusted.days : now.kind === "date" ? now.days : g.D));
  const chart: { label: string; real?: number; hoje?: number; ajustes?: number }[] = [];
  if (g.P !== null && g.M !== null) {
    let acc = 0, accRevenue = 0;
    const series = new Map(api.series.map((s) => [s.day, s]));
    for (let d = api.periodStart; d <= today; d = addDays(d, 1)) {
      const s = series.get(d); acc += s?.sales ?? 0; accRevenue += (s?.revenueCents ?? 0) / 100;
      const real = metric === "Receita confirmada" ? (base.paidRevenue > 0 ? accRevenue * g.P / base.paidRevenue : 0) : acc;
      chart.push({ label: shortDate(d), real: d === today ? g.P : real });
    }
    const hoje = paceProjection(base, null, horizon), ajustes = paceProjection(base, adjusted.kind === "date" || adjusted.kind === "never" ? flow.v2 : null, horizon);
    hoje.forEach((p, i) => { if (p.day === 0) { chart[chart.length - 1].hoje = p.value; chart[chart.length - 1].ajustes = p.value; return; } chart.push({ label: shortDate(addDays(today, p.day)), hoje: p.value, ajustes: ajustes[i]?.value }); });
  }

  const setLever = (patch: Levers) => setLevers((current) => ({ ...current, ...patch }));
  const summary = summaryText(base, scopeName);

  return <div className="grid gap-4 pb-24 sm:pb-6">
    {access.isAdvisory && <p className="rounded-lg border border-amber-300/25 bg-amber-300/5 px-3 py-2 text-xs text-amber-100">Modo assessoria: você vê os números desta empresa.</p>}
    {/* 1. Escopo, período e a meta */}
    <article className="elite-card grid gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        {fixedCity === null && access.role === "Administrador"
          ? <label className="grid gap-1 text-xs text-zinc-400">Onde<select className="commercial-input" value={cityId ?? ""} onChange={(e) => { setState({ loading: true }); setCityId(e.target.value ? Number(e.target.value) : null); }}><option value="">A empresa inteira</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          : <p className="text-sm text-zinc-300">Onde: <strong className="text-white">{scopeName}</strong></p>}
        <Segmented label="Até quando" value={period} onChange={setPeriod} options={[{ value: "mes", label: "Este mês" }, { value: "proximo", label: "Próximo mês" }, { value: "data", label: "Até uma data" }]} />
        {period === "data" && <label className="grid gap-1 text-xs text-zinc-400">Data<input type="date" className="commercial-input" min={today} value={until} onChange={(e) => setUntil(e.target.value)} /></label>}
      </div>
      <div className="flex flex-wrap items-end gap-2 text-sm text-zinc-200">
        <span className="pb-2">Quero</span>
        <label className="grid gap-1 text-xs text-zinc-400"><span className="sr-only">Meta</span><input id="calc-meta" inputMode="numeric" className="commercial-input w-28" value={goal} onChange={(e) => setGoal(e.target.value)} aria-label="Meta" /></label>
        <select aria-label="Tipo de meta" className="commercial-input" value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}><option>Vendas pagas</option><option>Receita confirmada</option></select>
        <span className="pb-2">até {shortDate(target, true)}</span>
      </div>
      {api.scope.consolidated && <p className="text-xs text-subtle">Cidade em modo Consolidado: o realizado vem dos fechamentos consolidados, e as taxas ficam sem dados.</p>}
      {api.scope.kind === "Empresa" && api.scope.consolidatedCities > 0 && <p className="text-xs text-subtle">As taxas usam só as cidades em modo Detalhado ({api.scope.detailedCities}); {api.scope.consolidatedCities} em Consolidado entram só no realizado.</p>}
    </article>

    {/* 2 e 3. Quanto falta e no ritmo atual */}
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="elite-card flex items-center gap-4 p-5">
        {g.M !== null && g.P !== null && <Meter value={Math.min(g.P, g.M)} max={Math.max(1, g.M)} label={`${g.P} de ${g.M}`} valueText={`${g.P}/${g.M}`} />}
        <div><p className="section-kicker">Quanto falta</p>
          {g.needsTicket ? <p className="text-sm text-zinc-300">Sem dados suficientes: digite o ticket médio (Premissas).</p>
            : g.reached ? <p className="text-xl font-semibold text-emerald-300">Meta batida</p>
            : <p className="text-xl font-semibold text-white">Faltam {plural(g.F ?? 0, "venda", "vendas")}{g.missingRevenue !== null ? ` (≈ ${money(g.missingRevenue)})` : ""} em {plural(g.D, "dia", "dias")}</p>}
          <p className="text-xs text-subtle">{api.paidSource === "fechamento consolidado" ? "Realizado: fechamento consolidado" : "Realizado: vendas com pagamento confirmado, pela data do pagamento"}</p>
        </div>
      </article>
      <article className="elite-card p-5"><p className="section-kicker">No ritmo atual</p>
        <p className="text-xl font-semibold text-white">{now.kind === "never" ? "No ritmo atual a meta não chega" : arrivalText(now, target)}</p>
        <Origin rate={api.rates.v} />
        {divergence(base) && <p className="mt-2 flex gap-2 text-xs text-amber-200"><AlertTriangle className="size-4 shrink-0" aria-hidden />O ritmo recente e os atendimentos de hoje não batem: a data pode mudar.</p>}
      </article>
    </div>

    {/* 4. O que precisa acontecer */}
    {!g.reached && g.F !== null && <article className="elite-card p-5"><p className="section-kicker">O que precisa acontecer</p>
      {funnel.status === "sem-tempo-ate-pagar" && <p className="text-sm text-zinc-300">Sem dados suficientes: digite o tempo até pagar (Premissas).</p>}
      {funnel.status === "sem-conversao" && <p className="text-sm text-zinc-300">Sem dados suficientes: digite a conversão (Premissas).</p>}
      {funnel.status === "andamento-basta" && <p className="text-sm text-emerald-200">O que já está em andamento basta para a meta.</p>}
      {funnel.status === "estenda" && <p className="text-sm text-amber-200">Para este prazo só contam os atendimentos já em andamento: estenda a data.</p>}
      {funnel.status === "mantenha" && <p className="text-sm text-emerald-200">Mantenha o ritmo de hoje: no ritmo atual, a meta chega no prazo.</p>}
      {funnel.status === "precisa" && funnel.Nn !== null && <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-subtle">Vendas</dt><dd className="text-white">{floor6(funnel.E)} já em andamento · {ceil6(funnel.vn)} por semana de atendimentos novos</dd></div>
        <div><dt className="text-subtle">Atendimentos novos</dt><dd className="text-white">{funnel.absolute ? `+${ceil6(funnel.leadsDelta ?? 0)} por semana` : `${ceil6(funnel.Nn)} por semana (hoje ${ceil6(base.N ?? 0)})`} · {ceil6(funnel.totalLeads ?? 0)} no total, começando até {shortDate(funnel.startBy ?? target)}</dd></div>
        <div><dt className="text-subtle">Pessoas a mapear</dt><dd className="text-white">{funnel.peoplePerWeek === null ? "Sem dados suficientes: digite pessoa mapeada → atendimento" : `${ceil6(funnel.peoplePerWeek)} por semana · ${ceil6(funnel.peopleTotal ?? 0)} no total`}</dd></div>
        <div><dt className="text-subtle">Equipe</dt><dd className="text-white">{funnel.mappers === null ? "Mapeadores: sem dados" : `${funnel.mappers} ${funnel.mappers === 1 ? "mapeador" : "mapeadores"}${base.nm !== null ? ` (${funnel.mappers - base.nm >= 0 ? "+" : ""}${funnel.mappers - base.nm})` : ""}`} · {funnel.sellers === null ? (base.kv === null ? "Vendedores: digite a capacidade" : "Vendedores: sem dados") : `${funnel.sellers} ${funnel.sellers === 1 ? "vendedor" : "vendedores"}${base.nv !== null ? ` (${funnel.sellers - base.nv >= 0 ? "+" : ""}${funnel.sellers - base.nv})` : ""}`}</dd></div>
      </dl>}
      {funnel.status === "precisa" && <p className="mt-3 flex items-center gap-2 text-sm text-amber-100"><AlertTriangle className="size-4" aria-hidden />O que trava: {funnel.bottleneck === "atendimentos e vendedores" ? "atendimentos (e, com mais atendimentos, também os vendedores)" : funnel.bottleneck}</p>}
    </article>}

    {/* 5. E se…? */}
    {!g.reached && g.F !== null && base.m !== null && <article className="elite-card grid gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="section-kicker">E se…?</p><Button type="button" size="sm" variant="ghost" onClick={() => setLevers({})}><RotateCcw /> Voltar ao atual</Button></div>
      <div className="grid gap-4 sm:grid-cols-2">
        {([["Vendedores", "sellers", sellers, can.sellers, base.nv], ["Mapeadores", "mappers", mappers, can.mappers, base.nm]] as const).map(([label, key, value, enabled, current]) => <div key={key} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 p-3 text-sm">
          <span>{label}{!enabled && <span className="block text-xs text-subtle">{key === "mappers" ? "sem dados de mapeamento" : base.kv === null ? "digite a capacidade de um vendedor" : "sem vendedores com atendimento no período"}</span>}</span>
          <span className="flex items-center gap-2"><Button type="button" size="icon" variant="outline" aria-label={`Menos ${label.toLowerCase()}`} disabled={!enabled || value <= 0} onClick={() => setLever({ [key]: Math.max(0, value - 1) })}><Minus /></Button><span className="w-8 text-center tabular-nums">{value}</span><Button type="button" size="icon" variant="outline" aria-label={`Mais ${label.toLowerCase()}`} disabled={!enabled} onClick={() => setLever({ [key]: value + 1 })}><Plus /></Button>{current !== null && value !== current && <span className="text-xs text-subtle">hoje {current}</span>}</span>
        </div>)}
        <label className="grid gap-2 rounded-lg border border-white/8 p-3 text-sm">Conversão: {pct(conversion)}{!can.conversion && <span className="text-xs text-subtle">Sem dados suficientes: digite a conversão</span>}<Slider aria-label="Conversão" disabled={!can.conversion} min={0} max={100} step={1} value={[Math.round(conversion * 100)]} onValueChange={([x]) => setLever({ conversion: x / 100 })} /></label>
        <label className="grid gap-2 rounded-lg border border-white/8 p-3 text-sm">Indicações por cliente por mês: {referrals.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}{!can.referrals && <span className="text-xs text-subtle">Sem dados suficientes (mínimo de 5 clientes e 2 indicações)</span>}<Slider aria-label="Indicações por cliente por mês" disabled={!can.referrals} min={0} max={Math.max(1, Math.ceil(perMonth(base.r ?? 0) * 4 * 10) / 10)} step={0.05} value={[referrals]} onValueChange={([x]) => setLever({ referralsPerMonth: x })} /></label>
        {access.role !== "Comercial" && <label className="grid gap-2 rounded-lg border border-white/8 p-3 text-sm sm:col-span-2">Verba extra de mídia por mês: {money(media)}{!can.media && <span className="text-xs text-subtle">Sem custo por atendimento de mídia confiável: alavanca desligada</span>}<Slider aria-label="Verba extra de mídia por mês" disabled={!can.media} min={0} max={20000} step={500} value={[media]} onValueChange={([x]) => setLever({ mediaPerMonth: x })} />{flow.organicWarning && <span className="text-xs text-amber-200">A participação orgânica estimada ({Math.round(flow.organicShare ?? 0)}%) fica abaixo da meta de Regras e cálculos ({base.organicGoal}%).</span>}</label>}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-white/8 p-3"><p className="text-subtle">Hoje</p><p className="text-white">{arrivalText(now, target)}</p><p className="text-xs text-subtle">{base.N === null ? "atendimentos: sem dados" : `${ceil6(base.N)} atendimentos por semana`} · {base.nm ?? "–"} mapeadores · {base.nv ?? "–"} vendedores</p></div>
        <div className="rounded-lg border border-gold/30 p-3"><p className="text-subtle">Com ajustes <span className="elite-guide-badge ml-1">Projeção</span></p><p className="text-white">{arrivalText(adjusted, target)}</p><p className="text-xs text-subtle">{ceil6(flow.N2)} atendimentos por semana · {mappers} mapeadores · {sellers} vendedores{adjusted.kind === "date" && adjusted.increaseOnly ? " · conta só o acréscimo" : ""}</p></div>
      </div>
    </article>}

    {/* 6 e 7. O que mais ajuda, menor combinação e bônus da rede */}
    {!g.reached && g.F !== null && base.m !== null && <article className="elite-card grid gap-3 p-5"><p className="section-kicker">O que mais ajuda</p>
      {rank.needs ? <p className="text-sm text-zinc-300">Sem dados suficientes: digite a {rank.needs === "conversao" ? "conversão" : "capacidade de um vendedor"}.</p>
        : <ul className="grid gap-2">{rank.steps.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 p-3 text-sm">
          <span><strong className="text-white">{s.label}</strong> · {s.noGain ? `sozinho não muda a data: ${s.noGain}` : s.arrival.kind === "date" ? `${s.arrival.days > MAX_DAYS ? "mais de 2 anos" : shortDate(s.arrival.date, true)}${s.wasNever ? " (antes não chegava)" : s.gain ? ` · ${plural(s.gain, "dia", "dias")} a menos` : ""}` : "não chega"}</span>
          {!s.noGain && <Button type="button" size="sm" variant="outline" onClick={() => setLevers(s.levers)}><Sparkles /> Simular este</Button>}
        </li>)}</ul>}
      <p className="text-sm text-zinc-200"><TrendingUp className="mr-1 inline size-4 text-gold" aria-hidden />Menor equipe que bate a data: {combo.status === "basta" ? "a equipe de hoje basta." : combo.status === "nenhuma" ? "nem com +10 mapeadores e +5 vendedores: revise a meta ou a data." : combo.status === "sem-dados" ? `sem dados suficientes: digite ${combo.needs === "conversao" ? "a conversão" : combo.needs === "tempo" ? "o tempo até pagar" : "a capacidade"}.` : `+${combo.extraMappers} ${combo.extraMappers === 1 ? "mapeador" : "mapeadores"} e +${combo.extraSellers} ${combo.extraSellers === 1 ? "vendedor" : "vendedores"} (${combo.arrival.kind === "date" ? shortDate(combo.arrival.date, true) : ""}).`}</p>
      <p className="text-sm text-zinc-300">Bônus da rede: {bonus === null ? (base.r === null ? "Sem dados suficientes" : "—") : `≈ ${floor6(bonus)} indicações a mais até o prazo (fora da data)`}.</p>
    </article>}

    {/* 8. Chegamos lá? */}
    {chart.length > 0 && g.M !== null && <ChartFrame kicker="Projeção" title="Chegamos lá?" takeaway={`Vendas pagas acumuladas desde ${shortDate(api.periodStart)}${unit === "receita" ? " (receita em vendas equivalentes)" : ""}. Tracejado = projeção, não é resultado.`}
      table={{ columns: ["Dia", "Realizado", "Projeção · Hoje", "Projeção · Com ajustes"], rows: chart.filter((_, i) => i % 3 === 0).map((p) => [p.label, p.real === undefined ? "—" : String(floor6(p.real)), p.hoje === undefined ? "—" : String(floor6(p.hoje)), p.ajustes === undefined ? "—" : String(floor6(p.ajustes))]) }}>
      <Suspense fallback={<div className="h-[280px]" />}><GoalPaceChart data={chart} goal={g.M} /></Suspense>
    </ChartFrame>}

    {/* 9. Taxas, premissas e como calculamos */}
    <details className="elite-card p-5"><summary className="cursor-pointer font-semibold text-white">Taxas da sua empresa e premissas</summary>
      <ul className="mt-3 grid gap-3 text-sm">{PREMISES.filter((p) => p.key !== "cpl" || access.role !== "Comercial").map((p) => {
        const rate = api.rates[p.rate] as Rate;
        const shown = p.key === "ticket" && rate.value !== null ? money(rate.value / 100) : p.key === "cpl" && rate.value !== null ? money(rate.value / 100) : (p.key === "c" || p.key === "a") && rate.value !== null ? pct(rate.value) : p.key === "km" && rate.value !== null && api.rates.nm.value ? int(rate.value / api.rates.nm.value) : rate.value !== null ? int(rate.value) : null;
        return <li key={p.key} className="grid gap-1 rounded-lg border border-white/8 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div><p className="text-white">{p.label}: {typed(p.key) ? `${p.unit === "%" ? `${premises[p.key]! * 100}%` : p.unit === "R$" ? money(premises[p.key]!) : `${premises[p.key]} ${p.unit}`}` : shown ?? "—"}</p><Origin rate={rate} typed={typed(p.key)} />{p.key === "m" && api.rates.m.sameDay && !typed("m") && <p className="text-xs text-amber-200">Vendas registradas no mesmo dia do atendimento: confira.</p>}</div>
          <label className="flex items-center gap-2 text-xs text-zinc-400">{rate.value === null || typed(p.key) ? "Sua estimativa" : "Usar minha estimativa"}<input inputMode="decimal" className="commercial-input w-24" aria-label={`${p.label} (${p.unit})`} value={premises[p.key] === undefined ? "" : String(p.unit === "%" ? premises[p.key]! * 100 : premises[p.key])}
            onChange={(e) => { const raw = e.target.value.replace(",", "."); setPremises((cur) => { const next = { ...cur }; if (raw === "" || !Number.isFinite(Number(raw))) delete next[p.key]; else next[p.key] = p.unit === "%" ? Number(raw) / 100 : Number(raw); return next; }); }} /></label>
        </li>;
      })}</ul>
    </details>
    <details className="elite-card p-5 text-sm leading-6 text-zinc-300"><summary className="cursor-pointer font-semibold text-white">Como calculamos</summary>
      <HowWeCalculate excluded={api.excluded} />
    </details>

    {/* 10. Copiar resumo (fixo no celular) */}
    <div className="fixed inset-x-0 bottom-16 z-20 border-t border-white/10 bg-background/95 p-3 sm:static sm:border-0 sm:bg-transparent sm:p-0">
      <Button type="button" className="w-full bg-gold text-black sm:w-auto" onClick={async () => { if (await copyText(summary)) toast.success("Resumo copiado."); else toast.error("Não foi possível copiar."); }}><Copy /> Copiar resumo</Button>
    </div>
  </div>;
}

/** O mesmo texto aparece em Gestão → Regras e cálculos ("Como a Calculadora calcula"). */
export function HowWeCalculate({ excluded }: { excluded?: CalculatorBaseResponse["excluded"] }) {
  return <div className="mt-3 grid gap-2">
    <p><Calculator className="mr-1 inline size-4 text-gold" aria-hidden />Realizado e ritmo contam vendas com pagamento confirmado, pela data do pagamento (como o e-mail semanal). “Ganho” sem pagamento e “Venda confirmada” não contam. Cada atendimento tem no máximo uma venda: receita recorrente não entra.</p>
    <p>Ritmo: vendas pagas das últimas 8 semanas (ou das semanas que os dados cobrem) ÷ semanas. Conversão: só atendimentos começados entre 150 e 60 dias atrás, que já tiveram 60 dias para pagar; por isso é diferente da “Conversão” de Hoje, que usa todos os atendimentos válidos. Tempo até pagar: a mediana dos dias entre o atendimento e o pagamento.</p>
    <p>A importação da rede por planilha entra no realizado e no ticket, mas fica fora da conversão, do tempo até pagar e dos atendimentos por semana (as datas são retroativas). A Visão geral agrupa pelo mês do atendimento: os números podem diferir entre telas, e cada tela diz a sua base.</p>
    <p>Abaixo da amostra mínima não mostramos número: aparece “Sem dados suficientes” e você pode digitar uma estimativa, que fica marcada como premissa. Toda data projetada vem com a faixa “entre X e Y”.</p>
    {excluded && <p className="text-xs text-subtle">O que ficou de fora: {excluded.importedLeads} atendimentos importados, {excluded.consolidatedCities} cidades em Consolidado e {excluded.peopleWithoutOrigin} pessoas sem origem registrada.</p>}
    <p className="text-xs text-subtle">O histórico pode mudar: pagamentos cancelados, reembolsos e pedidos de exclusão (LGPD) mudam os números passados. Modelo simples: supõe que o ritmo recente continua; não prevê sazonalidade nem campanhas.</p>
  </div>;
}
