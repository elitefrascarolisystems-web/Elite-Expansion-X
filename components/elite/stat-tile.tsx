"use client";
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import { CountUp } from "@/components/elite/count-up";
import { sparkline } from "@/lib/figures";

export type Trend = { text: string; tone: "up" | "down" | "flat" };

/** Minigráfico da série recente: linha dourada fina, área suave e o último ponto em destaque. */
export function Sparkline({ values, label, width = 132, height = 36 }: { values: number[]; label: string; width?: number; height?: number }) {
  const shape = sparkline(values, width, height);
  if (!shape) return null;
  return <svg className="elite-spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label} preserveAspectRatio="none">
    <path d={shape.area} className="elite-spark-area" />
    <polyline points={shape.line} className="elite-spark-line" />
    <circle cx={shape.last.x} cy={shape.last.y} r={3} className="elite-spark-dot" />
  </svg>;
}

/**
 * Indicador: nome, número grande (que conta até o valor), variação, uma linha de
 * explicação e, quando houver série, o minigráfico dos últimos períodos.
 */
export function StatTile({ label, value, helper, icon: Icon, emphasis = false, trend, series }: {
  label: string; value: string; helper: string; icon: LucideIcon; emphasis?: boolean; trend?: Trend;
  /** Série recente (do mais antigo ao mais novo) e a frase para leitor de tela. */
  series?: { values: number[]; label: string };
}) {
  const TrendIcon = trend?.tone === "up" ? TrendingUp : trend?.tone === "down" ? TrendingDown : Minus;
  const empty = value === "Sem dados suficientes";
  return <article className={`elite-card elite-stat group overflow-hidden p-4 sm:p-5 ${emphasis ? "border-gold/30" : ""}`}>
    <div className="mb-3 flex items-start justify-between gap-2 sm:mb-4 sm:gap-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px] sm:tracking-[0.16em]">{label}</p><span className="shrink-0 rounded-xl border border-gold/25 bg-gradient-to-b from-gold/20 to-gold/5 p-1.5 text-gold-light shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] sm:p-2"><Icon className="size-4" /></span></div>
    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
      <p className={`elite-kpi-value text-xl font-semibold sm:text-2xl lg:text-[2rem] ${empty ? "text-subtle" : emphasis ? "text-gold-pale" : "text-white"}`} title={empty ? value : undefined}>{empty ? "—" : <CountUp text={value} />}</p>
      {series && !empty && <Sparkline values={series.values} label={series.label} />}
    </div>
    <div className="mt-2 flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">{trend && <span className={`elite-trend is-${trend.tone}`}><TrendIcon className="size-3" aria-hidden />{trend.text}</span>}<p className="text-xs leading-5 text-subtle">{empty ? `Sem dados suficientes · ${helper}` : helper}</p></div>
    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent opacity-0 transition group-hover:opacity-100" />
  </article>;
}
