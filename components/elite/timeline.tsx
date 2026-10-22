import type { ReactNode } from "react";

import { groupByDay } from "@/lib/figures";

export type TimelineItem = { id: string; at: string; title: ReactNode; detail?: ReactNode; meta?: ReactNode; tone?: "gold" | "neutral" | "good" | "alert" };

const hour = (at: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(at));

/** Linha do tempo agrupada por dia ("Hoje", "Ontem", data), do mais novo para o mais antigo. */
export function Timeline({ items, now }: { items: TimelineItem[]; now?: number }) {
  return <div className="elite-timeline">
    {groupByDay(items, now).map((group) => <section key={group.key} aria-label={group.label}>
      <h3 className="elite-timeline-day">{group.label}</h3>
      <ol>
        {group.items.map((item) => <li key={item.id} data-tone={item.tone ?? "neutral"}>
          <time dateTime={item.at}>{hour(item.at)}</time>
          <div className="min-w-0"><p className="text-sm font-medium text-white">{item.title}</p>{item.detail && <p className="mt-0.5 text-sm leading-6 text-zinc-400">{item.detail}</p>}{item.meta && <p className="mt-0.5 text-xs text-subtle">{item.meta}</p>}</div>
        </li>)}
      </ol>
    </section>)}
  </div>;
}
