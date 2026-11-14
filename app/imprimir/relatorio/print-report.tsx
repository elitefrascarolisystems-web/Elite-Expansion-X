"use client";
/* eslint-disable @next/next/no-img-element -- logo da empresa na folha impressa. */
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowLeft, LoaderCircle, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { GoalLine } from "@/db/goals";
import type { MonthlyReport } from "@/db/report";
import { availablePeriods, buildDashboardView, EMPTY_FILTERS } from "@/lib/expansion-domain";
import type { DashboardData, DashboardView } from "@/lib/expansion-types";
import { shortDate } from "@/lib/goal-calculator";
import { formatTarget } from "@/lib/goals";
import { tenantFetch } from "@/lib/tenant-request";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const monthName = (month: string) => { const [y, m] = month.split("-"); return `${MONTHS[Number(m) - 1]} de ${y}`; };
const monthTitle = (month: string) => { const name = monthName(month); return name[0].toUpperCase() + name.slice(1); };
const shortMonth = (month: string) => { const [y, m] = month.split("-"); return `${MONTHS[Number(m) - 1].slice(0, 3)}/${y.slice(2)}`; };
const previousMonth = (month: string) => { const [y, m] = month.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
const thisMonth = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
const money = (cents: number | null) => cents === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
const number = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const percent = (value: number | null) => value === null ? "—" : `${Math.round(value * 100)}%`;
const day = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Mês padrão: o último mês fechado com dados; sem ele, o mês com dados mais recente; sem dados, o atual. */
function defaultMonth(data: DashboardData) {
  const periods = availablePeriods(data).filter((p) => p <= thisMonth());
  const closed = previousMonth(thisMonth());
  return periods.includes(closed) ? closed : periods[0] ?? thisMonth();
}

type Change = { text: string; tone: "good" | "bad" | "flat" };
/** Comparação com o mês anterior. `lowerIsBetter`: custo e CAC. */
function change(now: number | null, before: number | null, lowerIsBetter = false): Change | null {
  if (now === null || before === null || before === 0) return null;
  const diff = (now - before) / Math.abs(before);
  if (Math.abs(diff) < 0.005) return { text: "igual ao mês anterior", tone: "flat" };
  const up = diff > 0;
  return { text: `${up ? "▲" : "▼"} ${Math.round(Math.abs(diff) * 100)}% sobre o mês anterior`, tone: up === !lowerIsBetter ? "good" : "bad" };
}
const toneClass = { good: "text-emerald-700", bad: "text-red-700", flat: "text-neutral-500" };

function Tile({ label, value, delta, helper }: { label: string; value: string; delta?: Change | null; helper?: string }) {
  return <div className="rounded-lg border border-neutral-300 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
    <p className="mt-1 text-xl font-semibold text-neutral-900">{value}</p>
    {delta ? <p className={`mt-0.5 text-[11px] ${toneClass[delta.tone]}`}>{delta.text}</p> : helper ? <p className="mt-0.5 text-[11px] text-neutral-500">{helper}</p> : null}
  </div>;
}

function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return <section className="report-block mt-6 min-w-0">
    <h2 className="border-b border-neutral-300 pb-1 text-sm font-semibold uppercase tracking-[0.14em] text-[#8a6d14]">{title}</h2>
    <div className="mt-3">{children}</div>
    {note && <p className="mt-2 text-[11px] text-neutral-500">{note}</p>}
  </section>;
}

/** Tabela da folha. No celular rola de lado (região focável pelo teclado); na impressão ocupa a largura. */
function Table({ label, head, rows, empty, align }: { label: string; head: string[]; rows: (string | number)[][]; empty: string; align?: ("l" | "r")[] }) {
  if (!rows.length) return <p className="text-sm text-neutral-500">{empty}</p>;
  const side = (i: number) => (align?.[i] ?? (i === 0 ? "l" : "r")) === "l" ? "text-left" : "text-right";
  return <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto bg-white print:overflow-visible"><table className="w-full min-w-[520px] border-collapse text-[12px] print:min-w-0">
    <thead><tr>{head.map((h, i) => <th key={h} scope="col" className={`border-b border-neutral-400 px-2 py-1 font-semibold text-neutral-700 ${side(i)}`}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((row, r) => <tr key={r} className="report-row">{row.map((cell, i) => <td key={i} className={`border-b border-neutral-200 px-2 py-1 text-neutral-900 ${side(i)}`}>{cell}</td>)}</tr>)}</tbody>
  </table></div>;
}

function GoalRow({ label, goal }: { label: string; goal: GoalLine }) {
  const pct = goal.target > 0 ? Math.min(100, Math.round(goal.realized / goal.target * 100)) : 0;
  return <tr className="report-row">
    <td className="border-b border-neutral-200 px-2 py-1 text-left">{label}</td>
    <td className="border-b border-neutral-200 px-2 py-1 text-left">{goal.metric}</td>
    <td className="border-b border-neutral-200 px-2 py-1 text-right">{goal.metric === "Receita confirmada" ? `${formatTarget(goal.metric, goal.realized)} de ${formatTarget(goal.metric, goal.target)}` : `${number(goal.realized)} de ${formatTarget(goal.metric, goal.target)}`}</td>
    <td className="border-b border-neutral-200 px-2 py-1"><div className="flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200"><div className="h-full rounded-full bg-[#b8901f]" style={{ width: `${pct}%` }} /></div><span className="w-9 text-right">{pct}%</span></div></td>
    <td className="border-b border-neutral-200 px-2 py-1 text-right text-neutral-600">{shortDate(goal.periodStart)} a {shortDate(goal.periodEnd)}</td>
  </tr>;
}

type Sheet = { now: DashboardView; before: DashboardView; all: DashboardView };

export function PrintReport({ logo, organization, author, initialMonth }: { logo: string | null; organization: string; author: string; initialMonth: string | null }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [month, setMonth] = useState<string | null>(initialMonth);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    tenantFetch("/api/dashboard", { signal: controller.signal })
      .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error); return body.data as DashboardData; })
      .then((loaded) => { setData(loaded); setMonth((current) => current ?? defaultMonth(loaded)); })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível carregar os números."); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!month) return;
    const controller = new AbortController();
    const url = new URL(window.location.href); url.searchParams.set("mes", month); window.history.replaceState(null, "", url);
    tenantFetch(`/api/report?month=${month}`, { signal: controller.signal })
      .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error); setReport(body.data as MonthlyReport); setError(""); })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível montar o relatório."); });
    return () => controller.abort();
  }, [month]);

  const sheet = useMemo<Sheet | null>(() => data && month ? {
    now: buildDashboardView(data, { ...EMPTY_FILTERS, period: month }),
    before: buildDashboardView(data, { ...EMPTY_FILTERS, period: previousMonth(month) }),
    all: buildDashboardView(data),
  } : null, [data, month]);
  const ready = data && sheet && report && report.month === month ? { data, sheet, report } : null;
  const months = useMemo(() => {
    const list = new Set([thisMonth(), previousMonth(thisMonth()), ...(data ? availablePeriods(data) : []), ...(month ? [month] : [])]);
    return [...list].filter((m) => m <= thisMonth()).sort().reverse();
  }, [data, month]);
  const generated = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date());

  return <main className="elite-print min-h-screen bg-neutral-300 px-4 py-6 text-neutral-900 print:bg-white print:p-0">
    {/* Folha desta página: A4 em pé (o mapa impresso usa A3 deitado). */}
    <style>{"@page { size: A4 portrait; margin: 12mm; }"}</style>
    <div className="print-hide mx-auto mb-4 flex max-w-[860px] flex-wrap items-center gap-3">
      <Button variant="outline" className="border-neutral-400 bg-white text-neutral-900" onClick={() => { const org = new URLSearchParams(window.location.search).get("org"); window.location.assign(`/?${new URLSearchParams({ ...(org ? { org } : {}), area: "resultados" })}`); }}><ArrowLeft /> Voltar</Button>
      <label className="flex items-center gap-2 text-sm">Mês<select value={month ?? ""} onChange={(e) => { setReport(null); setMonth(e.target.value); }} className="rounded-md border border-neutral-400 bg-white px-3 py-2">{months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}</select></label>
      <Button onClick={() => window.print()} disabled={!ready} className="bg-neutral-900 text-white hover:bg-neutral-800"><Printer /> Imprimir ou salvar PDF</Button>
      <p className="text-xs text-neutral-600">Folha A4 em pé. No diálogo de impressão, escolha “Salvar como PDF” para gerar o arquivo.</p>
    </div>
    {error && <p role="alert" className="print-hide mx-auto max-w-[860px] rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!ready && !error && <p role="status" className="mx-auto flex max-w-[860px] items-center gap-2 text-sm text-neutral-700"><LoaderCircle className="size-4 animate-spin" /> Preparando o relatório…</p>}
    {ready && month && <Report month={month} sheet={ready.sheet} report={ready.report} data={ready.data} logo={logo} organization={organization} author={author} generated={generated} />}
  </main>;
}

function Report({ month, sheet, report, data, logo, organization, author, generated }: { month: string; sheet: Sheet; report: MonthlyReport; data: DashboardData; logo: string | null; organization: string; author: string; generated: string }) {
  const s = sheet.now.summary, b = sheet.before.summary;
  const result = s.revenueCents - s.costCents, resultBefore = b.revenueCents - b.costCents;
  const decisions = new Map(sheet.all.cities.map((c) => [c.id, c.decision]));
  const cities = [...sheet.now.cities].sort((x, y) => y.revenueCents - x.revenueCents || y.validLeads - x.validLeads);
  const evolution = sheet.all.timeline.filter((p) => p.period <= month).slice(-6);
  const goals = report.goals;
  const cityGoals = goals.cities.flatMap((c) => c.goal ? [{ cityId: c.cityId, name: c.name, goal: c.goal }] : []);
  const people = goals.people.flatMap((p) => p.sales ? [{ name: p.name, goal: p.sales }] : p.leads ? [{ name: p.name, goal: p.leads }] : []);
  const beat = people.filter((p) => p.goal.target > 0 && p.goal.realized >= p.goal.target).length;
  const mapped = report.mapping.filter((m) => m.places || m.people);
  const stats = data.mappingStats?.cities ?? [];
  const totalPlaces = stats.reduce((n, c) => n + c.hubs + c.companies, 0), totalPeople = stats.reduce((n, c) => n + c.people, 0);
  const alerts = sheet.all.alerts.slice(0, 6);
  // Mês corrente: o servidor conta até hoje (antes do último dia do mês).
  const partial = report.asOf < `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}`;

  return <article className="report-sheet mx-auto max-w-[860px] bg-white p-5 shadow-xl sm:p-10 print:max-w-none print:p-0 print:shadow-none">
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b-2 border-neutral-900 pb-4">
      <div className="flex items-center gap-4">
        <img src={logo ?? "/elite-emblem.png"} alt="" width={56} height={56} className="size-14 object-contain" />
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d14]">Relatório executivo</p><h1 className="text-2xl font-semibold leading-tight">{monthTitle(month)}</h1><p className="text-sm text-neutral-600">{organization}</p></div>
      </div>
      <div className="text-xs text-neutral-600 sm:text-right"><p>Gerado em {generated}</p><p>por {author}</p>{partial && <p className="mt-1 font-medium text-neutral-800">Mês em andamento: dados até {day(report.asOf)}</p>}</div>
    </header>

    <Section title="Resumo do mês">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
        <Tile label="Atendimentos" value={number(s.validLeads)} delta={change(s.validLeads, b.validLeads)} helper="Contatos válidos no mês" />
        <Tile label="Clientes pagos" value={number(s.confirmedPayments)} delta={change(s.confirmedPayments, b.confirmedPayments)} helper={`${percent(s.conversion)} dos atendimentos`} />
        <Tile label="Receita confirmada" value={money(s.revenueCents)} delta={change(s.revenueCents, b.revenueCents)} helper="Só pagamentos confirmados" />
        <Tile label="Resultado" value={money(result)} delta={change(result, resultBefore)} helper="Receita menos custo" />
        <Tile label="Custo total" value={money(s.costCents)} delta={change(s.costCents, b.costCents, true)} helper={`${money(s.cplCents)} por atendimento`} />
        <Tile label="CAC" value={money(s.cacCents)} delta={change(s.cacCents, b.cacCents, true)} helper="Custo por cliente pago" />
        <Tile label="Sem mídia paga" value={percent(s.organicShare)} helper="Atendimentos orgânicos" />
        <Tile label="Cidades ativas" value={`${s.activeCities} de ${s.plannedCities}`} helper={`${s.activeAmbassadors} embaixadores ativos`} />
      </div>
      <p className="mt-3 text-sm text-neutral-700">Atendimentos abertos no mês: <strong>{number(report.opportunities.created)}</strong> · ganhos: <strong>{number(report.opportunities.won)}</strong> · perdidos: <strong>{number(report.opportunities.lost)}</strong>.</p>
    </Section>

    <Section title="Metas" note={goals.company.goal || cityGoals.length ? `Como estavam em ${day(report.asOf)}.` : undefined}>
      {goals.company.goal || cityGoals.length ? <div role="region" aria-label="Metas" tabIndex={0} className="overflow-x-auto bg-white print:overflow-visible"><table className="w-full min-w-[560px] border-collapse text-[12px] print:min-w-0">
        <thead><tr>{["Meta de", "Indicador", "Realizado", "Andamento", "Período"].map((h, i) => <th key={h} scope="col" className={`border-b border-neutral-400 px-2 py-1 font-semibold text-neutral-700 ${i >= 2 && i !== 3 ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
        <tbody>
          {goals.company.goal && <GoalRow label="Empresa" goal={goals.company.goal} />}
          {cityGoals.map((c) => <GoalRow key={c.cityId} label={c.name} goal={c.goal} />)}
        </tbody>
      </table></div> : <p className="text-sm text-neutral-500">Nenhuma meta ativa em {day(report.asOf)}. As metas são aplicadas na Calculadora.</p>}
      {people.length > 0 && <p className="mt-2 text-sm text-neutral-700">Equipe: {people.length} {people.length === 1 ? "pessoa com meta" : "pessoas com meta"}, {beat} já {beat === 1 ? "bateu" : "bateram"}.</p>}
    </Section>

    <Section title="Cidades" note="Recomendação de hoje, pelas regras da empresa (Gestão → Empresa → Regras e cálculos).">
      <Table label="Cidades" head={["Cidade", "Atendimentos", "Clientes pagos", "Receita", "Custo", "CAC", "Recomendação"]} empty="Nenhuma cidade cadastrada."
        rows={cities.map((c) => [c.name, number(c.validLeads), number(c.confirmedPayments), money(c.revenueCents), money(c.costCents), money(c.cacCents), decisions.get(c.id) ?? c.decision])} />
    </Section>

    <div className="grid gap-x-6 sm:grid-cols-2 print:grid-cols-2">
      <Section title="Canais">
        <Table label="Canais" head={["Canal", "Atend.", "Pagos", "Receita", "Custo"]} empty="Sem atendimentos no mês."
          rows={sheet.now.channels.filter((c) => c.leads || c.payments || c.costCents).map((c) => [c.channel, number(c.leads), number(c.payments), money(c.revenueCents), money(c.costCents)])} />
      </Section>
      <Section title="Evolução">
        <Table label="Evolução" head={["Mês", "Receita", "Custo", "Resultado"]} empty="Ainda sem meses para comparar."
          rows={evolution.map((p) => [shortMonth(p.period), money(p.revenue * 100), money(p.cost * 100), money((p.revenue - p.cost) * 100)])} />
      </Section>
    </div>

    <Section title="Mapa e rede" note={`Hoje no mapa: ${number(totalPlaces)} locais e ${number(totalPeople)} pessoas da rede.`}>
      <Table label="Mapa e rede" head={["Cidade", "Locais novos no mês", "Pessoas novas no mês"]} empty="Nenhum local ou pessoa nova no mês."
        rows={mapped.map((m) => [m.name, number(m.places), number(m.people)])} />
    </Section>

    <Section title="Decisões registradas no mês">
      {report.decisions.length ? <ul className="grid gap-1.5 text-[12px]">{report.decisions.map((d, i) => <li key={i} className="report-row rounded border border-neutral-200 px-2 py-1.5"><strong>{d.city}: {d.decision}</strong>{d.reason && <> — {d.reason}</>}{d.nextAction && <span className="block text-neutral-600">Próximo passo: {d.nextAction}{d.reviewDate ? ` (rever em ${day(d.reviewDate)})` : ""}</span>}<span className="block text-[11px] text-neutral-500">{day(d.at)} · {d.by}</span></li>)}</ul>
        : <p className="text-sm text-neutral-500">Nenhuma decisão registrada no mês.</p>}
    </Section>

    <Section title="Pontos de atenção (hoje)">
      {alerts.length ? <ul className="grid gap-1 text-[12px]">{alerts.map((a) => <li key={a.id} className="report-row"><strong className={a.severity === "Alta" ? "text-red-700" : "text-neutral-900"}>{a.severity === "Alta" ? "Alta" : "Atenção"}:</strong> {a.title} — <span className="text-neutral-600">{a.description}</span></li>)}</ul>
        : <p className="text-sm text-neutral-500">Nada pedindo atenção agora.</p>}
    </Section>

    <footer className="mt-8 border-t border-neutral-300 pt-2 text-[10px] leading-4 text-neutral-500">
      Elite Expansion X · Números do mês conforme registrados na plataforma (só pagamentos confirmados contam como receita). Cidades com fechamento consolidado usam os números informados por período. Este relatório não traz dados pessoais de contatos.
    </footer>
  </article>;
}
