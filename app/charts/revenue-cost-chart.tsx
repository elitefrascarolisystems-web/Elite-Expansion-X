"use client";
/*
 * Gráfico "Receita confirmada e custo" (Resultados → Visão geral). Fica num arquivo
 * próprio, carregado só quando a aba abre: a biblioteca de gráficos não pesa nas outras telas.
 */
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { TimelineMetric } from "@/lib/expansion-types";
import { monthLabel } from "@/lib/figures";

const config = {
  revenue: { label: "Receita confirmada", color: "var(--chart-1)" },
  cost: { label: "Custo", color: "var(--chart-2)" },
} satisfies ChartConfig;

const compact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function RevenueCostChart({ data }: { data: TimelineMetric[] }) {
  return <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
    <BarChart data={data} margin={{ left: 0, right: 8, top: 10 }} barGap={2} barCategoryGap="28%" accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={monthLabel} />
      <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(value: number) => compact.format(value)} />
      <ChartTooltip cursor={{ fill: "rgb(255 255 255 / 0.04)" }} content={<ChartTooltipContent labelFormatter={(value) => monthLabel(String(value))}
        formatter={(value, name) => <div className="flex w-full items-center gap-2"><span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: `var(--color-${String(name)})` }} /><span className="flex-1 text-muted-foreground">{config[name as keyof typeof config]?.label ?? String(name)}</span><span className="font-medium tabular-nums text-foreground">{full.format(Number(value))}</span></div>} />} />
      <ChartLegend content={<ChartLegendContent />} />
      <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={40} />
      <Bar dataKey="cost" fill="var(--color-cost)" radius={[4, 4, 0, 0]} maxBarSize={40} />
    </BarChart>
  </ChartContainer>;
}
