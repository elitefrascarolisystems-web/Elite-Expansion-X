"use client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MappingStats } from "@/lib/expansion-types";

const when = (value: string | null) => {
  if (!value) return "—";
  const [day, time = ""] = value.replace("T", " ").split(" ");
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y.slice(2)} ${time.slice(0, 5)}`.trim();
};
const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "—");

/** Indicadores do mapeamento: cobertura por cidade e produção de cada pessoa da equipe. */
export function MappingStatsPanel({ stats }: { stats: MappingStats }) {
  const total = stats.cities.reduce((sum, city) => ({ hubs: sum.hubs + city.hubs, companies: sum.companies + city.companies, validated: sum.validated + city.validated, people: sum.people + city.people, linked: sum.linked + city.linked }), { hubs: 0, companies: 0, validated: 0, people: 0, linked: 0 });
  return <section className="mb-5 grid gap-4 xl:grid-cols-[1.25fr_1fr]" aria-label="Indicadores do mapeamento">
    <article className="elite-card overflow-hidden">
      <div className="border-b border-white/8 p-5"><p className="section-kicker">Mapeamento</p><h3 className="text-lg font-semibold text-white">Cobertura por cidade</h3><p className="mt-1 text-xs text-zinc-500">Locais no mapa só aparecem no ponto certo depois de validados. Pessoas sem local ficam no centro da cidade.</p></div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-white/8"><TableHead>Cidade</TableHead><TableHead className="text-right">Escritórios e networks</TableHead><TableHead className="text-right">Empresas</TableHead><TableHead className="text-right">Locais validados</TableHead><TableHead className="text-right">Pessoas</TableHead><TableHead className="text-right">Ligadas a um local</TableHead></TableRow></TableHeader>
        <TableBody>{stats.cities.map((city) => { const places = city.hubs + city.companies; return <TableRow key={city.cityId} className="border-white/7"><TableCell className="font-medium text-white">{city.cityName}</TableCell><TableCell className="text-right">{city.hubs}</TableCell><TableCell className="text-right">{city.companies}</TableCell><TableCell className="text-right">{city.validated} <span className="text-xs text-zinc-500">({pct(city.validated, places)})</span></TableCell><TableCell className="text-right">{city.people}</TableCell><TableCell className="text-right">{city.linked} <span className="text-xs text-zinc-500">({pct(city.linked, city.people)})</span></TableCell></TableRow>; })}
          {stats.cities.length > 1 && <TableRow className="border-white/7 bg-white/[0.02] font-semibold"><TableCell>Total</TableCell><TableCell className="text-right">{total.hubs}</TableCell><TableCell className="text-right">{total.companies}</TableCell><TableCell className="text-right">{total.validated} <span className="text-xs font-normal text-zinc-500">({pct(total.validated, total.hubs + total.companies)})</span></TableCell><TableCell className="text-right">{total.people}</TableCell><TableCell className="text-right">{total.linked} <span className="text-xs font-normal text-zinc-500">({pct(total.linked, total.people)})</span></TableCell></TableRow>}
        </TableBody></Table></div>
    </article>
    <article className="elite-card overflow-hidden">
      <div className="border-b border-white/8 p-5"><p className="section-kicker">Equipe</p><h3 className="text-lg font-semibold text-white">Produção por mapeador</h3><p className="mt-1 text-xs text-zinc-500">Cadastros feitos por cada pessoa: total e nos últimos 7 dias.</p></div>
      {stats.mappers.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-white/8"><TableHead>Pessoa</TableHead><TableHead className="text-right">Locais</TableHead><TableHead className="text-right">Pessoas</TableHead><TableHead className="text-right">7 dias</TableHead><TableHead>Último</TableHead></TableRow></TableHeader>
        <TableBody>{stats.mappers.map((mapper) => <TableRow key={mapper.email} className="border-white/7"><TableCell><p className="font-medium text-white">{mapper.name}</p>{mapper.name !== mapper.email && <p className="text-xs text-zinc-500">{mapper.email}</p>}</TableCell><TableCell className="text-right">{mapper.places}</TableCell><TableCell className="text-right">{mapper.people}</TableCell><TableCell className={`text-right ${mapper.lastWeek ? "text-emerald-300" : "text-zinc-500"}`}>{mapper.lastWeek}</TableCell><TableCell className="text-xs text-zinc-400">{when(mapper.lastAt)}</TableCell></TableRow>)}</TableBody></Table></div>
        : <p className="p-5 text-sm text-zinc-500">Ninguém mapeou ainda. Use &ldquo;Mapear&rdquo; para cadastrar o primeiro local e as pessoas dele.</p>}
    </article>
  </section>;
}
