"use client";
/* eslint-disable @next/next/no-img-element -- emblema estático na folha impressa. */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, LoaderCircle, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TerritoryRecord } from "@/lib/territory-types";
import { tenantFetch } from "@/lib/tenant-request";

/** Mesmas cores dos pinos do mapa da plataforma. */
const COLORS: Record<string, string> = {
  Empresa: "#1d3f63", "Escritório": "#b8901f", "Network / comunidade": "#5b3a8c", "Instituição de ensino": "#1f6f6a",
  "Ponto de encontro": "#8a4b14", partner: "#235d48", event: "#354884", action: "#354884",
};
const KIND = { partner: "Parceiro", event: "Evento", action: "Ação no território" } as Record<string, string>;
const typeOf = (r: TerritoryRecord) => (r.kind === "business" ? r.roles[0] || "Empresa" : KIND[r.kind] ?? r.kind);
const colorOf = (r: TerritoryRecord) => COLORS[r.kind === "business" ? r.roles[0] || "Empresa" : r.kind] ?? "#1d3f63";
const ORDER = ["Escritório", "Network / comunidade", "Instituição de ensino", "Ponto de encontro", "Empresa", "Parceiro", "Evento", "Ação no território"];
const W = 1000, H = 700, PAD = 60;

type Loaded = { records: TerritoryRecord[]; linked: Map<string, number>; hasMore: boolean };

/**
 * Folha A3 (paisagem) do território de uma cidade: desenho com os locais numerados,
 * legenda e lista. Funciona sem o mapa de fundo; o navegador imprime ou salva em PDF.
 */
export function PrintMap({ organization, author, initialCity }: { organization: string; author: string; initialCity: number | null }) {
  const [cities, setCities] = useState<TerritoryRecord[] | null>(null);
  const [cityId, setCityId] = useState<number | null>(initialCity);
  const [loaded, setLoaded] = useState<{ city: number; data: Loaded } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    tenantFetch("/api/territory?layers=city", { signal: controller.signal })
      .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error); return body.records as TerritoryRecord[]; })
      .then((list) => { const only = list.filter((r) => r.kind === "city"); setCities(only); const first = only.find((c) => c.status === "Ativa") ?? only[0];
        setCityId((current) => current ?? (first ? Number(first.id) : null)); })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível carregar as cidades."); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (cityId === null) return;
    const controller = new AbortController();
    const get = async (layers: string, offset = 0) => { const r = await tenantFetch(`/api/territory?city=${cityId}&layers=${encodeURIComponent(layers)}&offset=${offset}`, { signal: controller.signal }); const body = await r.json(); if (!r.ok) throw new Error(body.error); return body; };
    // Quantas pessoas estão ligadas a cada local, pela ficha de cada uma (todas as páginas, até 2.000 pessoas).
    const linked = async () => {
      const counts = new Map<string, number>();
      for (let offset: number | null = 0, page = 0; offset !== null && page < 10; page += 1) {
        const body = await get("person", offset);
        for (const person of body.records as TerritoryRecord[]) if (person.place) counts.set(`business:${person.place.id}`, (counts.get(`business:${person.place.id}`) ?? 0) + 1);
        offset = body.nextOffset ?? null;
      }
      return counts;
    };
    Promise.all([get("city|business|partner|event|action"), linked()])
      .then(([places, counts]) => setLoaded({ city: cityId, data: { records: places.records, linked: counts, hasMore: Boolean(places.hasMore) } }))
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível carregar o mapa da cidade."); });
    return () => controller.abort();
  }, [cityId]);

  const data = loaded && loaded.city === cityId ? loaded.data : null;
  const city = cities?.find((c) => Number(c.id) === cityId) ?? null;
  const sheet = useMemo(() => (data ? layout(data) : null), [data]);
  const today = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date());

  return <main className="elite-print min-h-screen bg-neutral-300 px-4 py-6 text-neutral-900 print:bg-white print:p-0">
    <div className="print-hide mx-auto mb-4 flex max-w-[1400px] flex-wrap items-center gap-3">
      <Button variant="outline" className="border-neutral-400 bg-white text-neutral-900" onClick={() => { const org = new URLSearchParams(window.location.search).get("org"); window.location.assign(`/?${new URLSearchParams({ ...(org ? { org } : {}), area: "territorio", ver: "mapa" })}`); }}><ArrowLeft /> Voltar ao mapa</Button>
      <label className="flex items-center gap-2 text-sm">Cidade<select value={cityId ?? ""} onChange={(e) => setCityId(Number(e.target.value))} className="rounded-md border border-neutral-400 bg-white px-3 py-2">{(cities ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}/{c.state}</option>)}</select></label>
      <Button onClick={() => window.print()} disabled={!sheet} className="bg-neutral-900 text-white hover:bg-neutral-800"><Printer /> Imprimir ou salvar PDF</Button>
      <p className="text-xs text-neutral-600">Folha A3 deitada. No diálogo de impressão, escolha “Salvar como PDF” para gerar o arquivo.</p>
    </div>
    {error && <p role="alert" className="print-hide mx-auto max-w-[1400px] rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!sheet && !error && <p role="status" className="mx-auto flex max-w-[1400px] items-center gap-2 text-sm text-neutral-700"><LoaderCircle className="size-4 animate-spin" /> Preparando o mapa…</p>}
    {sheet && city && <article className="print-sheet mx-auto grid max-w-[1400px] grid-cols-[1.55fr_1fr] gap-6 bg-white p-8 shadow-xl print:max-w-none print:p-0 print:shadow-none">
      <header className="col-span-2 flex items-end justify-between gap-6 border-b-2 border-neutral-900 pb-4">
        <div className="flex items-center gap-4"><img src="/elite-emblem.png" alt="" width={56} height={56} className="size-14" /><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d14]">{organization} · Mapa territorial</p><h1 className="text-3xl font-bold tracking-tight">{city.name}/{city.state}</h1></div></div>
        <dl className="flex gap-8 text-right text-sm">{[["Locais", sheet.items.length], ["Pessoas ligadas", sheet.people], ["Parceiros", sheet.items.filter((i) => i.record.kind === "partner").length], ["Eventos e ações", sheet.items.filter((i) => ["event", "action"].includes(i.record.kind)).length]].map(([label, value]) => <div key={label}><dt className="text-neutral-500">{label}</dt><dd className="text-2xl font-bold">{value}</dd></div>)}</dl>
      </header>
      <section aria-label="Desenho do território" className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-lg border border-neutral-300 bg-[#f7f5ef]" role="img" aria-label={`Locais de ${city.name} numerados`}>
          {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} x1={i * 100} y1={0} x2={i * 100} y2={H} stroke="#e4e0d4" strokeWidth={1} />)}
          {Array.from({ length: 8 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 100} x2={W} y2={i * 100} stroke="#e4e0d4" strokeWidth={1} />)}
          {sheet.center && <g><circle cx={sheet.center.x} cy={sheet.center.y} r={26} fill="none" stroke="#b8901f" strokeWidth={3} strokeDasharray="6 5" /><text x={sheet.center.x} y={sheet.center.y + 46} textAnchor="middle" fontSize={16} fontWeight={700} fill="#6b5410">Centro de {city.name}</text></g>}
          {sheet.items.filter((i) => i.x !== null).map((i) => <g key={i.record.key}><circle cx={i.x!} cy={i.y!} r={15} fill={colorOf(i.record)} stroke="#fff" strokeWidth={3} /><text x={i.x!} y={i.y! + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fff">{i.n}</text></g>)}
          <g transform={`translate(${W - 150} ${H - 34})`}><line x1={0} y1={0} x2={100} y2={0} stroke="#555" strokeWidth={3} /><text x={50} y={-8} textAnchor="middle" fontSize={13} fill="#444">{sheet.scale}</text></g>
          <g transform="translate(40 50)"><path d="M0 -24 L9 6 L0 0 L-9 6 Z" fill="#333" /><text y={24} textAnchor="middle" fontSize={14} fontWeight={700} fill="#333">N</text></g>
        </svg>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">{ORDER.filter((t) => sheet.items.some((i) => typeOf(i.record) === t)).map((t) => <span key={t} className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-full" style={{ background: COLORS[t] ?? COLORS[{ Parceiro: "partner", Evento: "event", "Ação no território": "action" }[t] ?? "Empresa"] }} />{t}</span>)}{sheet.unplaced > 0 && <span className="text-neutral-500">{sheet.unplaced} sem ponto validado (só na lista)</span>}</div>
      </section>
      <section aria-label="Lista dos locais" className="min-w-0">
        <table className="w-full border-collapse text-[12px] leading-4">
          <thead><tr className="border-b-2 border-neutral-900 text-left"><th className="py-1.5 pr-2">Nº</th><th className="pr-2">Local</th><th className="pr-2">Tipo</th><th className="pr-2 text-right">Pessoas</th><th>Próximo passo</th></tr></thead>
          <tbody>{sheet.items.map((i) => <tr key={i.record.key} className="border-b border-neutral-200 align-top"><td className="py-1.5 pr-2 font-bold" style={{ color: colorOf(i.record) }}>{i.n}</td><td className="pr-2 font-medium">{i.record.name}</td><td className="pr-2 text-neutral-600">{[typeOf(i.record), i.record.kind === "business" ? i.record.roles[1] : ""].filter(Boolean).join(" · ")}</td><td className="pr-2 text-right">{i.people || "—"}</td><td className="text-neutral-600">{i.record.nextAction || "—"}</td></tr>)}</tbody>
        </table>
        {data?.hasMore && <p className="mt-2 text-xs text-neutral-600">A lista mostra os primeiros 200 registros da cidade.</p>}
      </section>
      <footer className="col-span-2 flex justify-between gap-6 border-t border-neutral-300 pt-3 text-[11px] text-neutral-500"><span>Uso interno da {organization}. Não compartilhe fora da equipe. Pessoas aparecem no local ligado a elas ou no centro da cidade, nunca na residência.</span><span className="shrink-0">Gerado em {today} por {author}</span></footer>
    </article>}
  </main>;
}

type Item = { record: TerritoryRecord; n: number; x: number | null; y: number | null; people: number };

/** Posiciona os locais na folha (projeção simples, proporcional à latitude) e numera na ordem da legenda. */
function layout(data: Loaded) {
  const people = data.linked;
  const cityRecord = data.records.find((r) => r.kind === "city");
  const places = data.records.filter((r) => r.kind !== "city" && r.kind !== "person")
    .sort((a, b) => (ORDER.indexOf(typeOf(a)) - ORDER.indexOf(typeOf(b))) || a.name.localeCompare(b.name, "pt-BR"));
  const located = (r: TerritoryRecord) => r.location?.validated && r.location.latitude != null && r.location.longitude != null && r.location.precision !== "Cidade";
  const coords = [...places.filter(located), ...(cityRecord?.location?.latitude != null ? [cityRecord] : [])].map((r) => ({ lat: r.location!.latitude!, lng: r.location!.longitude! }));
  let minLat = Math.min(...coords.map((c) => c.lat)), maxLat = Math.max(...coords.map((c) => c.lat));
  let minLng = Math.min(...coords.map((c) => c.lng)), maxLng = Math.max(...coords.map((c) => c.lng));
  if (!coords.length) { minLat = -1; maxLat = 1; minLng = -1; maxLng = 1; }
  if (maxLat - minLat < 0.01) { minLat -= 0.005; maxLat += 0.005; }
  if (maxLng - minLng < 0.01) { minLng -= 0.005; maxLng += 0.005; }
  const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const spanX = (maxLng - minLng) * k, spanY = maxLat - minLat;
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const offX = (W - spanX * scale) / 2, offY = (H - spanY * scale) / 2;
  const project = (lat: number, lng: number) => ({ x: offX + (lng - minLng) * k * scale, y: offY + (maxLat - lat) * scale });
  const items: Item[] = places.map((record, index) => {
    const point = located(record) ? project(record.location!.latitude!, record.location!.longitude!) : null;
    return { record, n: index + 1, x: point?.x ?? null, y: point?.y ?? null, people: people.get(record.key) ?? 0 };
  });
  // Escala gráfica: quantos quilômetros cabem em 100 unidades da folha.
  const km = (100 / scale) * 111.32;
  return {
    items, people: items.reduce((sum, item) => sum + item.people, 0), unplaced: items.filter((i) => i.x === null).length,
    center: cityRecord?.location?.latitude != null ? project(cityRecord.location.latitude, cityRecord.location.longitude!) : null,
    scale: km >= 1 ? `${km.toFixed(km >= 10 ? 0 : 1).replace(".", ",")} km` : `${Math.round(km * 1000)} m`,
  };
}
