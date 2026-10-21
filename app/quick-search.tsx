"use client";
import { useEffect, useRef, useState } from "react";
import { Building2, HandCoins, LoaderCircle, MapPin, Search, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TerritoryRecord } from "@/lib/territory-types";
import { tenantFetch } from "@/lib/tenant-request";

type FollowupHit = { id: number; lead_id: number; lead_name: string; city_name: string; stage: string; next_action: string };
export type SearchPick = { kind: "territory"; key: string } | { kind: "followup"; leadId: number };
type Hit = { id: string; group: "Cidades" | "Pessoas e locais" | "Atendimentos"; title: string; detail: string; icon: typeof Search; pick: SearchPick };

const KIND_LABEL: Record<string, string> = { city: "Cidade", person: "Pessoa", business: "Local", partner: "Parceiro", event: "Evento", action: "Ação no território" };
const GROUPS = ["Cidades", "Pessoas e locais", "Atendimentos"] as const;

/**
 * Busca rápida (Ctrl+K / ⌘K): cidade, pessoa, local e atendimento. Usa as mesmas
 * consultas do mapa e do acompanhamento, então cada pessoa só encontra o que já pode ver.
 */
export function QuickSearch({ onPick, sales }: { onPick: (pick: SearchPick) => void; sales: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)} aria-label="Buscar pessoa, local, cidade ou atendimento" className="h-9 gap-2 border-white/12 bg-white/[0.04] px-3 text-zinc-300 hover:text-white">
      <Search className="size-4" /><span className="hidden md:inline">Buscar</span><kbd className="ml-1 hidden rounded border border-white/15 px-1.5 text-[10px] text-subtle lg:inline">Ctrl K</kbd>
    </Button>
    {/* A janela é recriada a cada abertura: começa sempre vazia. */}
    {open && <SearchDialog sales={sales} onClose={() => setOpen(false)} onPick={(pick) => { setOpen(false); onPick(pick); }} />}
  </>;
}

function SearchDialog({ sales, onClose, onPick }: { sales: boolean; onClose: () => void; onPick: (pick: SearchPick) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true); setError("");
      try {
        const q = encodeURIComponent(term);
        const [territory, followup] = await Promise.all([
          tenantFetch(`/api/territory?q=${q}`, { signal: controller.signal }).then(async (r) => (r.ok ? (await r.json()).records as TerritoryRecord[] : [])),
          sales ? tenantFetch(`/api/followup?q=${q}`, { signal: controller.signal }).then(async (r) => (r.ok ? (await r.json()).records as FollowupHit[] : [])) : Promise.resolve([] as FollowupHit[]),
        ]);
        const places: Hit[] = territory.slice(0, 8).map((r) => ({
          id: r.key, group: r.kind === "city" ? "Cidades" : "Pessoas e locais", title: r.name,
          detail: [KIND_LABEL[r.kind] ?? r.kind, r.kind === "city" ? r.state : r.cityName, r.place?.name].filter(Boolean).join(" · "),
          icon: r.kind === "city" ? MapPin : r.kind === "person" ? UserRound : Building2, pick: { kind: "territory", key: r.key },
        }));
        const deals: Hit[] = followup.slice(0, 6).map((r) => ({
          id: `op:${r.id}`, group: "Atendimentos", title: r.lead_name, detail: [r.city_name, r.stage, r.next_action].filter(Boolean).join(" · "),
          icon: HandCoins, pick: { kind: "followup", leadId: Number(r.lead_id) },
        }));
        setHits([...places, ...deals]); setActive(0);
      } catch {
        if (!controller.signal.aborted) setError("Não foi possível buscar agora. Confira a conexão e tente de novo.");
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term, sales]);

  const shown = term.length < 2 ? [] : hits;
  const ordered = GROUPS.flatMap((group) => shown.filter((hit) => hit.group === group));
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.max(0, Math.min(ordered.length - 1, active + (event.key === "ArrowDown" ? 1 : -1)));
      setActive(next);
      listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" && ordered[active]) { event.preventDefault(); onPick(ordered[active].pick); }
  }

  // Posição de cada resultado na lista inteira (para as setas), já separado por grupo.
  const grouped = GROUPS.map((group) => ({ group, items: ordered.map((hit, i) => ({ hit, i })).filter(({ hit }) => hit.group === group) })).filter(({ items }) => items.length);
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
    <DialogContent className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 text-white">
      <DialogHeader className="sr-only"><DialogTitle>Buscar</DialogTitle><DialogDescription>Cidade, pessoa, local ou atendimento. Use as setas e Enter para abrir.</DialogDescription></DialogHeader>
      <label className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <Search className="size-5 shrink-0 text-gold-soft" aria-hidden />
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown} placeholder="Buscar cidade, pessoa, local ou atendimento" aria-label="Buscar" role="combobox" aria-expanded={ordered.length > 0} aria-controls="quick-search-results" aria-activedescendant={ordered[active] ? `qs-${active}` : undefined} className="w-full bg-transparent text-base text-white outline-none placeholder:text-subtle" />
        {busy && <LoaderCircle className="size-4 shrink-0 animate-spin text-subtle" aria-label="Buscando" />}
      </label>
      <div className="max-h-[60dvh] overflow-y-auto p-2">
        {term.length < 2 ? <p className="px-3 py-6 text-center text-sm text-subtle">Digite pelo menos 2 letras. Você só encontra o que o seu acesso já mostra.</p>
          : error ? <p role="alert" className="px-3 py-6 text-center text-sm text-amber-200">{error}</p>
          : !busy && !ordered.length ? <p className="px-3 py-6 text-center text-sm text-subtle">Nada encontrado para “{term}”.</p>
          : <ul id="quick-search-results" ref={listRef} role="listbox" aria-label="Resultados">{grouped.map(({ group, items }) => <li key={group} role="presentation"><p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-soft">{group}</p><ul role="presentation">{items.map(({ hit, i }) => { const Icon = hit.icon; return <li key={hit.id} id={`qs-${i}`} role="option" aria-selected={i === active} data-index={i}><button type="button" onMouseEnter={() => setActive(i)} onClick={() => onPick(hit.pick)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${i === active ? "bg-gold/12 text-white" : "text-zinc-300"}`}><Icon className="size-4 shrink-0 text-gold-soft" /><span className="min-w-0"><span className="block truncate font-medium">{hit.title}</span><span className="block truncate text-xs text-subtle">{hit.detail}</span></span></button></li>; })}</ul></li>)}</ul>}
      </div>
    </DialogContent>
  </Dialog>;
}
