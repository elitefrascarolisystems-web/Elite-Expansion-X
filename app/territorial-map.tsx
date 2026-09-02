"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Building2,
  CircleDollarSign,
  Compass,
  Handshake,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Target,
  UserRound,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildTerritorialPoints, cityReference, normalizeLocationName } from "@/lib/territorial-map";
import type { AmbassadorMetric, CityMetric, DashboardView } from "@/lib/expansion-types";

const money = (cents: number | null) => cents === null
  ? "Sem dados suficientes"
  : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const ratio = (value: number | null) => value === null ? "Sem dados suficientes" : `${Math.round(value * 100)}%`;

function mapBadgeClass(value: string) {
  if (["Ativa", "Ativo", "Avançar"].includes(value)) return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (["Pausada", "Pausado", "Desligado", "Corrigir", "Pausar"].includes(value)) return "border-red-400/30 bg-red-400/10 text-red-200";
  if (["Planejada", "Preparar", "Convidado", "Em análise"].includes(value)) return "border-zinc-400/30 bg-zinc-400/10 text-zinc-300";
  return "border-amber-300/30 bg-amber-300/10 text-amber-100";
}

function cityPeople(ambassadors: AmbassadorMetric[], city: CityMetric) {
  const leader = city.leaderName
    ? [{ id: `leader-${city.id}`, name: city.leaderName, role: "Líder", status: "Responsável", level: "Liderança", active: city.status === "Ativa", lastActivity: null }]
    : [];
  return [
    ...leader,
    ...ambassadors.filter((item) => item.cityId === city.id).map((item) => ({
      id: `ambassador-${item.id}`,
      name: item.name,
      role: "Embaixador",
      status: item.status,
      level: item.level,
      active: item.isActive,
      lastActivity: item.lastActivity,
      ambassador: item,
    })),
  ];
}

export function TerritorialMap({ view, onConfigureCity }: { view: DashboardView; onConfigureCity?: (id: number) => void }) {
  const [selectedCityId, setSelectedCityId] = useState<number | null>(view.cities[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [level, setLevel] = useState("all");
  const [activity, setActivity] = useState("all");
  const [zoom, setZoom] = useState(1);

  const points = useMemo(() => buildTerritorialPoints(view.cities), [view.cities]);
  const selectedCity = view.cities.find((city) => city.id === selectedCityId) ?? view.cities[0] ?? null;

  function peopleFor(city: CityMetric) {
    const search = normalizeLocationName(query);
    return cityPeople(view.ambassadors, city).filter((person) => {
      if (role !== "all" && person.role !== role) return false;
      if (status !== "all" && person.status !== status) return false;
      if (level !== "all" && person.level !== level) return false;
      if (activity === "active" && !person.active) return false;
      if (activity === "inactive" && person.active) return false;
      if (search && !normalizeLocationName(`${person.name} ${city.name}`).includes(search)) return false;
      return true;
    });
  }

  const selectedPeople = selectedCity ? peopleFor(selectedCity) : [];
  const statuses = [...new Set(view.ambassadors.map((item) => item.status))].sort();
  const levels = [...new Set(view.ambassadors.map((item) => item.level))].sort();
  const totalPeople = view.cities.reduce((total, city) => total + cityPeople(view.ambassadors, city).length, 0);
  const activeCities = view.cities.filter((city) => city.status === "Ativa").length;
  const missingLocations = view.cities.filter((city) => !cityReference(city.name, city.state));
  const selectedReference = selectedCity ? cityReference(selectedCity.name, selectedCity.state) : null;

  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-3">
      <article className="map-summary-card"><span><MapPin /></span><div><strong>{view.cities.length}</strong><p>Cidades no recorte atual</p></div></article>
      <article className="map-summary-card"><span><Users /></span><div><strong>{totalPeople}</strong><p>Líderes e embaixadores registrados</p></div></article>
      <article className="map-summary-card"><span><BadgeCheck /></span><div><strong>{activeCities}</strong><p>Cidades com operação ativa</p></div></article>
    </section>

    <section className="elite-card p-4 sm:p-5">
      <div className="mb-4 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="section-kicker">Presença por cidade</p>
          <h2 className="section-title">Mapa territorial da Elite</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Os pontos representam a sede de cada cidade. Nenhum endereço pessoal ou posição exata é exibido.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="icon" variant="outline" className="map-control" onClick={() => setZoom((value) => Math.max(.85, value - .15))} disabled={zoom <= .85} aria-label="Diminuir mapa"><Minus /></Button>
          <Button type="button" size="icon" variant="outline" className="map-control" onClick={() => setZoom(1)} disabled={zoom === 1} aria-label="Restaurar mapa"><RotateCcw /></Button>
          <Button type="button" size="icon" variant="outline" className="map-control" onClick={() => setZoom((value) => Math.min(1.45, value + .15))} disabled={zoom >= 1.45} aria-label="Ampliar mapa"><Plus /></Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_repeat(4,minmax(0,.7fr))]">
        <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><span className="sr-only">Buscar cidade ou pessoa</span><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cidade ou pessoa" className="border-white/10 bg-white/[0.035] pl-10" /></label>
        <Select value={role} onValueChange={setRole}><SelectTrigger className="border-white/10 bg-white/[0.035]" aria-label="Filtrar função"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as funções</SelectItem><SelectItem value="Líder">Líderes</SelectItem><SelectItem value="Embaixador">Embaixadores</SelectItem></SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="border-white/10 bg-white/[0.035]" aria-label="Filtrar situação"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as situações</SelectItem>{statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
        <Select value={level} onValueChange={setLevel}><SelectTrigger className="border-white/10 bg-white/[0.035]" aria-label="Filtrar nível"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os níveis</SelectItem>{levels.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
        <Select value={activity} onValueChange={setActivity}><SelectTrigger className="border-white/10 bg-white/[0.035]" aria-label="Filtrar atividade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toda atividade</SelectItem><SelectItem value="active">Ativos agora</SelectItem><SelectItem value="inactive">Sem ativação</SelectItem></SelectContent></Select>
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
      <article className="territorial-map-shell" aria-label="Mapa das cidades da Elite">
        <div className="map-compass" aria-hidden="true"><Compass /><span>N</span></div>
        <div className="map-scale">Referência territorial · não mostra endereços</div>
        <div className="territorial-map-layer" style={{ transform: `scale(${zoom})` }}>
          <div className="territorial-route" aria-hidden="true" />
          {points.map((point) => {
            const city = view.cities.find((item) => item.id === point.id);
            if (!city) return null;
            const people = peopleFor(city);
            const searchMatchesCity = !query || normalizeLocationName(city.name).includes(normalizeLocationName(query));
            const faded = Boolean(query) && !people.length && !searchMatchesCity;
            return <button
              type="button"
              key={city.id}
              className={`territorial-marker ${selectedCity?.id === city.id ? "is-selected" : ""} ${faded ? "is-faded" : ""}`}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              onClick={() => setSelectedCityId(city.id)}
              aria-label={`${city.name}: ${people.length} pessoas visíveis`}
              aria-pressed={selectedCity?.id === city.id}
            >
              <span className="marker-count">{people.length}</span>
              <span className="marker-label">{city.name}<small>{city.status}</small></span>
            </button>;
          })}
        </div>
        {!points.length && <div className="absolute inset-0 grid place-items-center px-6 text-center"><div><LocateFixed className="mx-auto mb-3 size-8 text-[#d6b94f]" /><p className="font-semibold text-white">Nenhuma cidade localizada</p><p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">As cidades continuam disponíveis na lista. Cadastre uma referência municipal validada antes de colocá-las no mapa.</p></div></div>}
      </article>

      <article className="elite-card overflow-hidden">
        {selectedCity ? <>
          <div className="border-b border-white/8 p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="section-kicker">Cidade selecionada</p><h3 className="text-xl font-semibold text-white">{selectedCity.name}/{selectedCity.state}</h3><p className="mt-1 text-sm text-zinc-500">{selectedCity.leaderName || "Líder ainda não definido"}</p></div><Badge variant="outline" className={mapBadgeClass(selectedCity.status)}>{selectedCity.status}</Badge></div>
            <div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline" className={mapBadgeClass(selectedCity.decision)}>{selectedCity.decision}</Badge><span className="text-xs leading-6 text-zinc-500">{selectedCity.decisionReason}</span></div>
          </div>
          <dl className="map-city-metrics">
            <div><dt><Users /> Pessoas</dt><dd>{cityPeople(view.ambassadors, selectedCity).length}</dd></div>
            <div><dt><Activity /> Ativos</dt><dd>{selectedCity.activeAmbassadors}</dd></div>
            <div><dt><Handshake /> Parceiros</dt><dd>{selectedCity.activePartners}</dd></div>
            <div><dt><Target /> Leads válidos</dt><dd>{selectedCity.validLeads}</dd></div>
            <div><dt><BadgeCheck /> Pagamentos</dt><dd>{selectedCity.confirmedPayments}</dd></div>
            <div><dt><CircleDollarSign /> CAC</dt><dd>{money(selectedCity.cacCents)}</dd></div>
          </dl>
          <div className="border-t border-white/8 p-5">
            <div className="grid gap-2 text-sm"><div className="flex justify-between gap-4"><span className="text-zinc-500">Participação orgânica</span><strong className="text-white">{ratio(selectedCity.organicShare)}</strong></div><div className="flex justify-between gap-4"><span className="text-zinc-500">Receita confirmada</span><strong className="text-white">{money(selectedCity.revenueCents)}</strong></div><div className="flex justify-between gap-4"><span className="text-zinc-500">Custo atribuído</span><strong className="text-white">{money(selectedCity.costCents)}</strong></div></div>
            {onConfigureCity && <Button type="button" onClick={() => onConfigureCity(selectedCity.id)} variant="outline" className="mt-5 w-full border-white/10 bg-white/5 text-white"><Building2 /> Configurar cidade</Button>}
          </div>
        </> : <div className="grid min-h-80 place-items-center p-6 text-center text-sm text-zinc-500">Selecione uma cidade.</div>}
      </article>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1fr_.55fr]">
      <article className="elite-card overflow-hidden">
        <div className="border-b border-white/8 p-5"><p className="section-kicker">Lista ligada ao mapa</p><h3 className="text-lg font-semibold text-white">Pessoas em {selectedCity?.name ?? "cada cidade"}</h3><p className="mt-2 text-sm text-zinc-500">Somente função, etapa e atividade. Dados de contato não aparecem aqui.</p></div>
        {selectedPeople.length ? <div className="divide-y divide-white/7">{selectedPeople.map((person) => <div key={person.id} className="flex items-center justify-between gap-4 p-4"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#c9a227]/20 bg-[#c9a227]/8 text-[#d6b94f]"><UserRound className="size-4" /></span><div className="min-w-0"><p className="truncate font-medium text-white">{person.name}</p><p className="mt-1 text-xs text-zinc-500">{person.role} · {person.level}</p></div></div><div className="text-right"><Badge variant="outline" className={mapBadgeClass(person.status)}>{person.status}</Badge><p className={`mt-1 text-xs ${person.active ? "text-emerald-300" : "text-zinc-600"}`}>{person.active ? "Ativo agora" : "Sem ativação"}</p></div></div>)}</div> : <div className="grid min-h-48 place-items-center p-6 text-center"><div><Users className="mx-auto mb-3 size-7 text-[#d6b94f]" /><p className="font-medium text-white">Nenhuma pessoa neste filtro</p><p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">Cadastre o líder e os embaixadores ou limpe os filtros acima.</p></div></div>}
      </article>

      <article className="elite-card p-5">
        <p className="section-kicker">Segurança do mapa</p><h3 className="text-lg font-semibold text-white">Como a localização funciona</h3>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-400"><li className="flex gap-2"><MapPin className="mt-1 size-4 shrink-0 text-[#d6b94f]" />O ponto representa a cidade, não a casa ou posição da pessoa.</li><li className="flex gap-2"><Users className="mt-1 size-4 shrink-0 text-[#d6b94f]" />Os marcadores agrupam líderes e embaixadores por cidade.</li><li className="flex gap-2"><BadgeCheck className="mt-1 size-4 shrink-0 text-[#d6b94f]" />Telefone, e-mail e dados de leads não são exibidos.</li></ul>
        {selectedReference && <p className="mt-5 rounded-xl border border-white/8 bg-white/[0.025] p-3 text-xs leading-5 text-zinc-500">Referência de {selectedCity?.name}: código municipal {selectedReference.municipalityCode}. <a href={selectedReference.sourceUrl} target="_blank" rel="noreferrer" className="text-[#d6b94f] underline-offset-4 hover:underline">{selectedReference.sourceLabel}</a>.</p>}
        {missingLocations.length > 0 && <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100"><strong>{missingLocations.length} cidade(s) sem ponto validado:</strong> {missingLocations.map((city) => city.name).join(", ")}. Elas permanecem na lista e não recebem posição inventada.</div>}
      </article>
    </section>
  </div>;
}
