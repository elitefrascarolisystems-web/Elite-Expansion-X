"use client";
/*
 * Calculadora → "Onde buscar": de onde podem vir as próximas vendas, com "Ver lista" (até 50 pessoas,
 * só nome e motivo, no escopo de quem vê) e "Abrir página da pessoa". A lista vem à parte, por pedido.
 */
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { tenantFetch } from "@/lib/tenant-request";

type ListKey = "clientes" | "indicacoes" | "mapeados" | "lugares";
const LINES: { key: ListKey; text: (n: number) => string }[] = [
  { key: "clientes", text: (n) => `${n} ${n === 1 ? "cliente ainda não indicou" : "clientes ainda não indicaram"} ninguém` },
  { key: "indicacoes", text: (n) => `${n} ${n === 1 ? "indicação" : "indicações"} sem atendimento` },
  { key: "mapeados", text: (n) => `${n} ${n === 1 ? "pessoa mapeada" : "pessoas mapeadas"} sem atendimento há mais de 14 dias` },
  { key: "lugares", text: (n) => `${n} ${n === 1 ? "lugar" : "lugares"} em Avançar sem plano de plantio` },
];

export function WhereToLook({ cityId, onPersonPage, onMapKey }: { cityId: number | null; onPersonPage?: (personId: string) => void; onMapKey?: (key: string) => void }) {
  const [counts, setCounts] = useState<Record<ListKey, number> | null>(null);
  const [open, setOpen] = useState<{ key: ListKey; people: { id: string; name: string; reason: string; kind?: "place" }[] | null } | null>(null);
  const query = cityId ? `&cityId=${cityId}` : "";
  useEffect(() => {
    let live = true;
    tenantFetch(`/api/calculator?view=where${query}`, { cache: "no-store" }).then(async (r) => { const b = await r.json().catch(() => ({})); if (live && r.ok) setCounts(b.data.counts); }).catch(() => undefined);
    return () => { live = false; };
  }, [query]);
  async function show(key: ListKey) {
    if (open?.key === key) { setOpen(null); return; }
    setOpen({ key, people: null });
    const r = await tenantFetch(`/api/calculator?view=where&list=${key}${query}`, { cache: "no-store" }).catch(() => null);
    const b = r ? await r.json().catch(() => ({})) : {};
    setOpen({ key, people: r?.ok ? b.data.people : [] });
  }
  if (!counts) return null;
  return <article className="elite-card grid gap-3 p-5"><p className="section-kicker">Onde buscar</p>
    <ul className="grid gap-2">{LINES.map((line) => <li key={line.key} className="rounded-lg border border-white/8 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-white"><Search className="mr-1 inline size-4 text-gold" aria-hidden />{line.text(counts[line.key])}</span>
        {counts[line.key] > 0 && <Button type="button" size="sm" variant="outline" aria-expanded={open?.key === line.key} onClick={() => show(line.key)}>{open?.key === line.key ? "Fechar lista" : "Ver lista"}</Button>}</div>
      {open?.key === line.key && (open.people === null ? <p role="status" className="mt-2 text-xs text-subtle">Carregando…</p>
        : <ul className="mt-2 grid gap-1">{open.people.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-1"><span>{p.name}</span>{p.kind === "place" ? onMapKey && <Button type="button" size="sm" variant="ghost" onClick={() => onMapKey(`business:${p.id}`)}>Ver no mapa</Button> : onPersonPage && <Button type="button" size="sm" variant="ghost" onClick={() => onPersonPage(p.id)}>Abrir página da pessoa</Button>}</li>)}
          {counts[line.key] > open.people.length && <li className="text-xs text-subtle">Mostrando {open.people.length} de {counts[line.key]}.</li>}</ul>)}
    </li>)}</ul>
  </article>;
}
