"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Building2, CornerDownRight, HandCoins, LoaderCircle, MapPin, Search, UserRound, type LucideIcon } from "lucide-react";

import type { NewAction } from "@/app/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { goCommands, matches } from "@/lib/commands";
import type { NavArea, NavLocation } from "@/lib/navigation";
import type { TerritoryRecord } from "@/lib/territory-types";
import { tenantFetch } from "@/lib/tenant-request";

type FollowupHit = { id: number; lead_id: number; lead_name: string; city_name: string; stage: string; next_action: string };
export type SearchPick = { kind: "territory"; key: string } | { kind: "followup"; leadId: number };
type Group = "Nesta área" | "Ir para" | "Criar" | "Cidades" | "Pessoas e locais" | "Atendimentos";
type Hit = { id: string; group: Group; title: string; detail: string; icon: LucideIcon; run: () => void };
/** O que a central de comandos oferece além da busca: as telas e as ações do "+ Novo" desta função. */
export type Commands = { areas: NavArea[]; current: NavLocation; actions: NewAction[]; onNavigate: (location: NavLocation) => void };

const KIND_LABEL: Record<string, string> = { city: "Cidade", person: "Pessoa", business: "Local", partner: "Parceiro", event: "Evento", action: "Ação no território" };
const GROUPS: Group[] = ["Nesta área", "Ir para", "Criar", "Cidades", "Pessoas e locais", "Atendimentos"];

/**
 * Central de comandos (Ctrl+K / ⌘K): busca cidade, pessoa, local e atendimento
 * (as mesmas consultas do mapa e do acompanhamento, então cada pessoa só encontra
 * o que já pode ver), leva a qualquer tela do menu e cria o que o "+ Novo" cria.
 */
export function QuickSearch({ onPick, sales, commands }: { onPick: (pick: SearchPick) => void; sales: boolean; commands?: Commands }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)} aria-label="Buscar ou ir para (pessoa, local, cidade, atendimento ou tela)" className="h-9 gap-2 border-white/12 bg-white/[0.04] px-3 text-zinc-300 hover:text-white">
      <Search className="size-4" /><span className="hidden md:inline">Buscar</span><kbd className="ml-1 hidden rounded border border-white/15 px-1.5 text-[10px] text-subtle lg:inline">Ctrl K</kbd>
    </Button>
    {/* A janela é recriada a cada abertura: começa sempre vazia. Fecha antes de abrir a tela ou a janela escolhida. */}
    {open && <SearchDialog sales={sales} commands={commands} onClose={() => setOpen(false)} onRun={(run) => { setOpen(false); setTimeout(run, 0); }} onPick={onPick} />}
  </>;
}

function SearchDialog({ sales, commands, onClose, onRun, onPick }: { sales: boolean; commands?: Commands; onClose: () => void; onRun: (run: () => void) => void; onPick: (pick: SearchPick) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  // A busca no servidor não recomeça só porque a tela de trás mudou.
  const pickRef = useRef(onPick);
  useEffect(() => { pickRef.current = onPick; }, [onPick]);
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
          icon: r.kind === "city" ? MapPin : r.kind === "person" ? UserRound : Building2, run: () => pickRef.current({ kind: "territory", key: r.key }),
        }));
        const deals: Hit[] = followup.slice(0, 6).map((r) => ({
          id: `op:${r.id}`, group: "Atendimentos", title: r.lead_name, detail: [r.city_name, r.stage, r.next_action].filter(Boolean).join(" · "),
          icon: HandCoins, run: () => pickRef.current({ kind: "followup", leadId: Number(r.lead_id) }),
        }));
        setHits([...places, ...deals]); setActive(0);
      } catch {
        if (!controller.signal.aborted) setError("Não foi possível buscar agora. Confira a conexão e tente de novo.");
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term, sales]);

  // Telas e ações: respondem na hora, sem esperar o servidor.
  const local: Hit[] = commands ? [
    ...goCommands(term, commands.areas, commands.current).map((command) => ({
      id: command.id, group: command.group, title: command.title, detail: command.detail,
      icon: command.group === "Nesta área" ? CornerDownRight : ArrowRight, run: () => commands.onNavigate(command.location),
    })),
    ...commands.actions.filter((action) => !action.disabled && (!term || matches(term, action.label))).slice(0, term ? 6 : 4).map((action) => ({
      id: `run:${action.id}`, group: "Criar" as const, title: action.label, detail: action.group === "dia" ? "No dia a dia" : "Cadastro", icon: action.icon, run: action.run,
    })),
  ] : [];
  const ordered = GROUPS.flatMap((group) => [...local, ...(term.length < 2 ? [] : hits)].filter((hit) => hit.group === group));
  const current = Math.min(active, Math.max(0, ordered.length - 1));

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.max(0, Math.min(ordered.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)));
      setActive(next);
      listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" && ordered[current]) { event.preventDefault(); onRun(ordered[current].run); }
  }

  // Posição de cada resultado na lista inteira (para as setas), já separado por grupo.
  // As opções não recebem foco: o teclado fica no campo de busca (setas e Enter), como num combobox.
  const grouped = GROUPS.map((group) => ({ group, items: ordered.map((hit, i) => ({ hit, i })).filter(({ hit }) => hit.group === group) })).filter(({ items }) => items.length);
  const hint = term.length < 2 ? "Digite 2 letras para buscar pessoas, locais, atendimentos e cidades. Você só encontra o que o seu acesso já mostra." : "";
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
    <DialogContent className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 text-white">
      <DialogHeader className="sr-only"><DialogTitle>Central de comandos</DialogTitle><DialogDescription>Busque cidade, pessoa, local ou atendimento, vá para uma tela ou crie um cadastro. Use as setas e Enter.</DialogDescription></DialogHeader>
      <label className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <Search className="size-5 shrink-0 text-gold-soft" aria-hidden />
        <input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKeyDown} placeholder="Buscar pessoa, local, atendimento… ou ir para uma tela" aria-label="Buscar ou ir para" role="combobox" aria-expanded={ordered.length > 0} aria-controls="quick-search-results" aria-activedescendant={ordered[current] ? `qs-${current}` : undefined} className="w-full bg-transparent text-base text-white outline-none placeholder:text-subtle" />
        {busy && <LoaderCircle className="size-4 shrink-0 animate-spin text-subtle" aria-label="Buscando" />}
      </label>
      <div className="max-h-[60dvh] overflow-y-auto p-2">
        {error && <p role="alert" className="px-3 py-3 text-center text-sm text-amber-200">{error}</p>}
        {ordered.length ? <ul id="quick-search-results" ref={listRef} role="listbox" aria-label="Resultados">{grouped.map(({ group, items }) => <li key={group} role="presentation"><p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-soft">{group}</p><ul role="presentation">{items.map(({ hit, i }) => { const Icon = hit.icon; return <li key={hit.id} id={`qs-${i}`} role="option" aria-selected={i === current} data-index={i} onMouseEnter={() => setActive(i)} onClick={() => onRun(hit.run)} className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left ${i === current ? "bg-gold/12 text-white" : "text-zinc-300"}`}><Icon className="size-4 shrink-0 text-gold-soft" aria-hidden /><span className="min-w-0"><span className="block truncate font-medium">{hit.title}</span><span className="block truncate text-xs text-subtle">{hit.detail}</span></span></li>; })}</ul></li>)}</ul>
          : term.length >= 2 && !busy && !error ? <p className="px-3 py-6 text-center text-sm text-subtle">Nada encontrado para “{term}”.</p> : null}
        {hint && <p className="px-3 py-4 text-center text-xs text-subtle">{hint}</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
