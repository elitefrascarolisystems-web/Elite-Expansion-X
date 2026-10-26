"use client";
import type { ReactNode } from "react";
import { CircleCheck, Pause, Play } from "lucide-react";

import { Segmented } from "@/components/elite/segmented";
import { Button } from "@/components/ui/button";
import { monthLabel } from "@/lib/figures";
import { FUNNEL_GROUPS, HEAT_METRICS, MAP_MODES, modePalette, rampFor, TEMPERATURE_OPTIONS, type funnelTotals, type HeatMetric, type MapMode, type Temperature, type timelineFrame } from "@/lib/map-modes";

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;

/** Seletor dos modos de ver, sobre o mapa (no celular, rola para o lado). */
export function ModeBar({ mode, onChange }: { mode: MapMode; onChange: (mode: MapMode) => void }) {
  return <div className="territory-modes"><Segmented label="Modo de ver o mapa" size="sm" value={mode} onChange={onChange} options={MAP_MODES.map((m) => ({ value: m.id, label: m.label }))} /></div>;
}
export function HeatOptions({ metric, onChange }: { metric: HeatMetric; onChange: (metric: HeatMetric) => void }) {
  return <div className="territory-mode-options"><Segmented label="Medida do calor" size="sm" value={metric} onChange={onChange} options={HEAT_METRICS.map((m) => ({ value: m.id, label: m.label }))} /></div>;
}
export function FunnelOptions({ temperature, onChange }: { temperature: Temperature; onChange: (temperature: Temperature) => void }) {
  return <div className="territory-mode-options"><span className="territory-mode-options-label">Temperatura</span><Segmented label="Temperatura dos atendimentos" size="sm" value={temperature} onChange={onChange} options={TEMPERATURE_OPTIONS} /></div>;
}

/** Régua da linha do tempo: barras de novos locais por mês, o mês escolhido e o play/pausa. */
export function TimelinePlayer({ months, index, playing, onIndex, onToggle, mapped }: {
  months: string[]; index: number; playing: boolean; onIndex: (index: number) => void; onToggle: () => void; mapped: number[];
}) {
  const max = Math.max(1, ...mapped);
  return <div className="territory-mode-options territory-player" role="group" aria-label="Linha do tempo">
    <Button type="button" size="icon" variant="outline" className="territory-play" onClick={onToggle} aria-pressed={playing} aria-label={playing ? "Pausar a linha do tempo" : "Reproduzir a expansão mês a mês"}>{playing ? <Pause /> : <Play />}</Button>
    <div className="territory-ruler">
      <div className="territory-ruler-bars" aria-hidden="true">{mapped.map((value, i) => <span key={months[i]} style={{ height: `${value ? Math.max(14, 100 * value / max) : 5}%` }} data-state={i === index ? "current" : i < index ? "past" : "future"} />)}</div>
      <input type="range" min={0} max={Math.max(0, months.length - 1)} step={1} value={index} onChange={(e) => onIndex(Number(e.target.value))} aria-label="Mês da linha do tempo" aria-valuetext={monthLabel(months[index] ?? "")} />
      <div className="territory-ruler-labels"><span>{monthLabel(months[0] ?? "")}</span><strong>{monthLabel(months[index] ?? "")}</strong><span>{monthLabel(months.at(-1) ?? "")}</span></div>
    </div>
  </div>;
}

/** Cartão da legenda (no celular, o mesmo conteúdo abre numa gaveta de baixo). */
export function LegendCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <div className="territory-legend-body">
    <p className="territory-legend-title">{title}</p>
    {hint && <p className="territory-legend-hint">{hint}</p>}
    {children}
  </div>;
}
function Swatch({ color, ring = false, dashed = false }: { color: string; ring?: boolean; dashed?: boolean }) {
  return <span aria-hidden="true" className={`territory-swatch ${ring ? "is-ring" : ""} ${dashed ? "is-dashed" : ""}`} style={ring || dashed ? { borderColor: color } : { background: color }} />;
}
function Table({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  if (!rows.length) return null;
  return <details className="territory-legend-table"><summary>Ver tabela</summary>
    <table><caption className="sr-only">{caption}</caption><thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => j ? <td key={j}>{typeof cell === "number" ? cell.toLocaleString("pt-BR") : cell}</td> : <th key={j} scope="row">{cell}</th>)}</tr>)}</tbody></table>
  </details>;
}
/** Avisos que valem para todos os modos que usam locais. */
export function PlacesNotes({ capped, loading, error }: { capped: boolean; loading: boolean; error: string }) {
  return <>
    {loading && <p className="territory-legend-hint" role="status">Carregando os locais…</p>}
    {error && <p className="territory-legend-hint text-amber-200" role="alert">{error}</p>}
    {capped && <p className="territory-legend-hint" role="status">Mostrando os primeiros 5.000 locais. Escolha uma cidade para ver todos.</p>}
    <p className="territory-legend-hint">Só locais, centros de bairro e centros de cidade, nunca a posição de uma pessoa. Aqui valem a cidade, o estado e o tipo ou setor do local.</p>
  </>;
}

export function HeatLegend({ dark, metric, weights, names }: { dark: boolean; metric: HeatMetric; weights: number[]; names: string[] }) {
  const unit = HEAT_METRICS.find((m) => m.id === metric)!.unit;
  const places = weights.filter((w) => w > 0).length, total = weights.reduce((n, w) => n + w, 0), max = Math.max(0, ...weights);
  const top = weights.map((value, i) => ({ value, name: names[i] })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
  const ramp = modePalette(dark).sequential;
  return <LegendCard title="Calor" hint={MAP_MODES[1].description}>
    <div className="territory-gradient" style={{ background: `linear-gradient(90deg, transparent, ${ramp.join(", ")})` }} aria-hidden="true" />
    <div className="territory-gradient-labels"><span>menos</span><span>mais{max ? ` (até ${max.toLocaleString("pt-BR")} num ponto)` : ""}</span></div>
    <p className="territory-legend-count">{total ? <><strong>{plural(total, unit[0], unit[1])}</strong> em {plural(places, "ponto", "pontos")}</> : `Sem ${unit[1]} neste filtro.`}</p>
    <Table caption={`Onde há mais ${unit[1]}`} head={["Local", HEAT_METRICS.find((m) => m.id === metric)!.label]} rows={top.map((r) => [r.name, r.value])} />
  </LegendCard>;
}

export function CoverageLegend({ dark, labels, rows, hexes, neighbors, places, area }: {
  dark: boolean; labels: string[]; rows: { hexes: number; places: number }[]; hexes: number; neighbors: number; places: number; area: string;
}) {
  const colors = rampFor(Math.max(1, labels.length), modePalette(dark).sequential);
  return <LegendCard title="Cobertura" hint={`Cada hexágono ${area}. ${MAP_MODES[2].description}`}>
    <ul className="territory-swatches">
      {labels.map((label, i) => <li key={label}><Swatch color={colors[i]} />{label} {label === "1" ? "local" : "locais"}</li>)}
      <li><Swatch color={modePalette(dark).sequential[2]} dashed />Vizinho sem locais</li>
    </ul>
    <p className="territory-legend-count">{places ? <><strong>{plural(places, "local mapeado", "locais mapeados")}</strong> em {plural(hexes, "área", "áreas")} · {plural(neighbors, "área vizinha vazia", "áreas vizinhas vazias")}</> : "Nenhum local validado neste filtro."}</p>
    <Table caption="Áreas por faixa de locais mapeados" head={["Faixa", "Áreas", "Locais"]} rows={labels.map((label, i) => [label, rows[i]?.hexes ?? 0, rows[i]?.places ?? 0])} />
  </LegendCard>;
}

export function FunnelLegend({ dark, totals, unplaced }: { dark: boolean; totals: ReturnType<typeof funnelTotals>; unplaced: number }) {
  const p = modePalette(dark);
  return <LegendCard title="Funil" hint={`${MAP_MODES[3].description} O tamanho acompanha os atendimentos abertos e ganhos.`}>
    <ul className="territory-swatches">{FUNNEL_GROUPS.map((group, i) => <li key={group.label}><Swatch color={i < 4 ? p.stages[i] : p.lost} />{group.label}<span className="territory-swatch-count">{totals.byGroup[i]}</span></li>)}</ul>
    <p className="territory-legend-count">{totals.places ? <><strong>{plural(totals.places, "ponto", "pontos")}</strong> com atendimento · {plural(totals.open, "aberto", "abertos")} · {plural(totals.won, "ganho", "ganhos")} · {plural(totals.hot, "quente aberto", "quentes abertos")}</> : "Nenhum atendimento ligado a locais neste filtro."}</p>
    {unplaced > 0 && <p className="territory-legend-hint">{plural(unplaced, "atendimento", "atendimentos")} em cidades ainda sem ponto no mapa.</p>}
    <Table caption="Pontos por etapa mais avançada" head={["Etapa mais avançada", "Pontos"]} rows={FUNNEL_GROUPS.map((group, i) => [group.label, totals.byGroup[i]])} />
  </LegendCard>;
}

export function TimelineLegend({ dark, frame, months, series }: { dark: boolean; frame: ReturnType<typeof timelineFrame> | null; months: string[]; series: { mapped: number[]; sales: number[] } }) {
  const p = modePalette(dark);
  const month = frame ? monthLabel(frame.month) : "";
  return <LegendCard title="Linha do tempo" hint={MAP_MODES[4].description}>
    <ul className="territory-swatches">
      <li><Swatch color={p.sequential[4]} />Cadastrado em {month || "—"}</li>
      <li><Swatch color={p.sequential[2]} />Cadastrado antes</li>
      <li><Swatch color={p.sale} ring /><CircleCheck className="size-3.5 text-[#0ca30c]" aria-hidden="true" />Venda confirmada até o mês</li>
    </ul>
    <p className="territory-legend-count">{frame ? <>Até {month}: <strong>{plural(frame.mapped, "local", "locais")}</strong> (+{frame.newMapped} no mês) · {plural(frame.sales, "venda confirmada", "vendas confirmadas")} (+{frame.newSales})</> : "Ainda não há cadastros com data."}</p>
    <Table caption="Novos locais e vendas por mês" head={["Mês", "Novos locais", "Vendas"]} rows={months.map((m, i) => [monthLabel(m), series.mapped[i], series.sales[i]])} />
  </LegendCard>;
}

export function TowerLegend({ dark, rows }: { dark: boolean; rows: { name: string; people: number; open: number }[] }) {
  return <LegendCard title="Cidade acesa" hint="Altura da torre: pessoas ligadas ao local + atendimentos abertos. Para girar: botão direito do mouse ou dois dedos.">
    <ul className="territory-swatches"><li><Swatch color={modePalette(dark).tower} />Torre de luz: um local mapeado</li></ul>
    <p className="territory-legend-count">{rows.length ? <><strong>{plural(rows.length, "local aceso", "locais acesos")}</strong></> : "Nenhum local validado neste filtro."}</p>
    <Table caption="Locais com as torres mais altas" head={["Local", "Pessoas", "Abertos"]} rows={[...rows].sort((a, b) => b.people + b.open - a.people - a.open).slice(0, 8).map((r) => [r.name, r.people, r.open])} />
  </LegendCard>;
}
