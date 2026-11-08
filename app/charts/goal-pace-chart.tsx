"use client";
/*
 * Gráfico "Chegamos lá?" (Resultados → Calculadora): vendas pagas acumuladas no período.
 * Realizado em linha cheia; as projeções "Hoje" e "Com ajustes" tracejadas, em cor neutra,
 * sempre rotuladas "Projeção"; a meta como linha de referência. Um eixo só.
 */
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export type PacePoint = { label: string; real?: number; hoje?: number; ajustes?: number };

const config = {
  real: { label: "Realizado", color: "var(--chart-1)" },
  hoje: { label: "Projeção · Hoje", color: "var(--chart-neutral, #a1a1aa)" },
  ajustes: { label: "Projeção · Com ajustes", color: "var(--chart-3)" },
} satisfies ChartConfig;

export default function GoalPaceChart({ data, goal }: { data: PacePoint[]; goal: number }) {
  return <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
    <LineChart data={data} margin={{ left: 0, right: 12, top: 12 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
      <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} domain={[0, (max: number) => Math.max(max, goal)]} />
      <ReferenceLine y={goal} stroke="var(--chart-1)" strokeDasharray="2 4" label={{ value: `Meta ${goal}`, position: "insideTopLeft", fill: "#e1c96e", fontSize: 12 }} />
      <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => <div className="flex w-full items-center gap-2"><span className="flex-1 text-muted-foreground">{config[name as keyof typeof config]?.label ?? String(name)}</span><span className="font-medium tabular-nums">{Math.floor(Number(value))}</span></div>} />} />
      <ChartLegend content={<ChartLegendContent />} />
      <Line dataKey="real" type="monotone" stroke="var(--color-real)" strokeWidth={2.5} dot={false} connectNulls={false} />
      <Line dataKey="hoje" type="linear" stroke="var(--color-hoje)" strokeWidth={2} strokeDasharray="6 5" dot={false} />
      <Line dataKey="ajustes" type="linear" stroke="var(--color-ajustes)" strokeWidth={2} strokeDasharray="3 4" dot={false} />
    </LineChart>
  </ChartContainer>;
}
