"use client";
/**
 * Em campo (mapa): tela cheia para usar com uma mão.
 * - "Perto de mim": locais a até 300 m, com a situação, check-in de visita e "Novo local aqui".
 * - "Rota do dia": locais escolhidos (ou os retornos de hoje com local), na ordem do mais perto, com
 *   Google Maps (várias paradas) ou Waze (próxima parada) e "Visitado" em cada um.
 * A posição do aparelho fica só aqui: centraliza, mede distâncias e ordena a rota, sem ir ao servidor e
 * sem histórico de deslocamento. Só em "Novo local aqui" o ponto vai ao servidor, como o ponto do local
 * (busca do endereço e cadastro), nunca como posição da pessoa.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, Check, Crosshair, ExternalLink, MapPin, Navigation, Plus, Route, Trash2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SituationBadge, VisitDialog, type PlantPlace } from "@/app/plant-dialogs";
import { useOfflineQueue, useOnline } from "@/app/offline-sync";
import type { InitialPoint } from "@/app/mapping-wizard";
import { formatDistance, googleMapsRoute, MAX_GOOGLE_STOPS, nearby, nearestCity, routeLength, routeOrder, wazeTo, type FieldSpot, type LatLng } from "@/lib/field";
import type { DashboardData } from "@/lib/expansion-types";
import { itemsFor } from "@/lib/offline-queue";
import type { PlaceSituation } from "@/lib/place-situation";
import { tenantFetch } from "@/lib/tenant-request";
import type { MapSpot } from "@/lib/territory-types";

type Situation = { businessId: string; situation: PlaceSituation; situationText: string; people: number; lastVisit: string; planned: boolean };
type Here = LatLng & { accuracy: number };
type RouteState = { day: string; stops: string[]; visited: string[] };

const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
const idOf = (key: string) => key.replace(/^business:/, "");
/** A rota do dia fica só neste aparelho (quais locais e quais já visitados); vale até o fim do dia. */
const routeKey = (data: DashboardData) => `elite-rota|${data.access.organizationId}|${data.access.email.toLowerCase()}`;
function readRoute(data: DashboardData): RouteState {
  try {
    const value = JSON.parse(localStorage.getItem(routeKey(data)) ?? "null") as RouteState | null;
    if (value && value.day === today() && Array.isArray(value.stops) && Array.isArray(value.visited)) return value;
  } catch { /* sem armazenamento: começa vazia */ }
  return { day: today(), stops: [], visited: [] };
}
function writeRoute(data: DashboardData, value: RouteState) { try { localStorage.setItem(routeKey(data), JSON.stringify(value)); } catch { /* segue só na memória */ } }

export function FieldMode({ data, onClose, onMapear, onMapKey, onSaved }: {
  data: DashboardData; onClose: () => void; onMapear: (point: InitialPoint) => void; onMapKey: (key: string) => void; onSaved: () => void;
}) {
  const [tab, setTab] = useState<"perto" | "rota">("perto");
  const [here, setHere] = useState<Here | null>(null);
  const [geoError, setGeoError] = useState(() => (typeof navigator !== "undefined" && !("geolocation" in navigator) ? "Este aparelho não informa a localização. Use a lista ou o mapa." : ""));
  const [spots, setSpots] = useState<FieldSpot[] | null>(null);
  const [cities, setCities] = useState<(LatLng & { cityId: number })[]>([]);
  const [loadError, setLoadError] = useState("");
  const [situations, setSituations] = useState<Map<string, Situation>>(new Map());
  const [visit, setVisit] = useState<PlantPlace | null>(null);
  const [route, setRoute] = useState<RouteState>(() => readRoute(data));
  const [preparing, setPreparing] = useState(false);
  const online = useOnline();
  const queue = useOfflineQueue();
  const waiting = itemsFor(queue, data.access.organizationId, data.access.email).filter((item) => item.status === "pendente").length;

  // Posição: só na memória desta tela; some ao fechar.
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => { setGeoError(""); setHere({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }); },
      (e) => setGeoError(e.code === 1 ? "Sem permissão de localização. Libere a localização para este site nas configurações do navegador." : "Não foi possível achar sua posição agora. Vá para um lugar aberto e tente de novo."),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Locais que você pode ver (os mesmos dos modos do mapa).
  const loadSpots = useCallback(() => {
    tenantFetch("/api/territory/places", { cache: "no-store" }).then(async (r) => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Não foi possível carregar os locais.");
      const all = (body.spots ?? []) as MapSpot[];
      setLoadError("");
      setSpots(all.filter((s) => s.kind === "business").map((s) => ({ key: s.key, name: s.name, cityId: s.cityId, type: s.type, sector: s.sector, latitude: s.latitude, longitude: s.longitude })));
      setCities(all.filter((s) => s.kind === "city").map((s) => ({ cityId: s.cityId, latitude: s.latitude, longitude: s.longitude })));
    }).catch((e) => setLoadError(navigator.onLine ? (e instanceof Error ? e.message : "Não foi possível carregar os locais.") : "Sem internet: os locais aparecem quando o sinal voltar. Cadastros feitos agora ficam guardados no aparelho."));
  }, []);
  useEffect(() => { loadSpots(); }, [loadSpots]);

  const near = useMemo(() => (here && spots ? nearby(spots, here, 300, 5) : null), [here, spots]);
  const byKey = useMemo(() => new Map((spots ?? []).map((s) => [s.key, s])), [spots]);
  const stops = useMemo(() => route.stops.map((k) => byKey.get(k)).filter((s): s is FieldSpot => !!s), [route.stops, byKey]);
  const pending = useMemo(() => routeOrder(stops.filter((s) => !route.visited.includes(s.key)), here), [stops, route.visited, here]);
  const done = stops.filter((s) => route.visited.includes(s.key));

  // Situação dos locais na tela (perto + rota), em uma consulta só com os ids.
  const shownIds = useMemo(() => [...new Set([...(near?.items ?? []).map((s) => idOf(s.key)), ...stops.map((s) => idOf(s.key))])].slice(0, 40), [near, stops]);
  const idsKey = shownIds.join(",");
  const [situationRevision, setSituationRevision] = useState(0);
  useEffect(() => {
    if (!idsKey) return;
    const c = new AbortController();
    tenantFetch(`/api/territory/place?view=nearby&ids=${encodeURIComponent(idsKey)}`, { signal: c.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).then((body) => { if (body?.data) setSituations(new Map((body.data as Situation[]).map((x) => [x.businessId, x]))); }).catch(() => {});
    return () => c.abort();
  }, [idsKey, situationRevision]);

  function save(next: RouteState) { setRoute(next); writeRoute(data, next); }
  const inRoute = (key: string) => route.stops.includes(key);
  const toggleRoute = (key: string) => save({ ...route, stops: inRoute(key) ? route.stops.filter((k) => k !== key) : [...route.stops, key], visited: route.visited.filter((k) => k !== key || inRoute(key)) });

  async function addTodayReturns() {
    // Retornos de hoje que têm local: as visitas planejadas para hoje.
    try {
      const r = await tenantFetch("/api/territory/place?view=today", { cache: "no-store" });
      const body = await r.json().catch(() => ({}));
      const keys = ((body.data ?? []) as { businessId: string }[]).map((x) => "business:" + x.businessId).filter((k) => byKey.has(k));
      if (!keys.length) { setGeoError(""); setLoadError("Nenhuma visita planejada para hoje com local no mapa."); return; }
      save({ ...route, stops: [...new Set([...route.stops, ...keys])] });
    } catch { setLoadError("Não foi possível buscar as visitas de hoje."); }
  }

  async function newPlaceHere() {
    if (!here) return;
    setPreparing(true);
    const cityId = data.cities.length === 1 ? data.cities[0].id : nearestCity(cities, here);
    let address = "", district = "";
    if (cityId && navigator.onLine) {
      // Endereço sugerido pelo ponto do local (busca reversa); a posição não fica guardada.
      try {
        const r = await tenantFetch("/api/territory/geocode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cityId, kind: "business", reverse: { latitude: here.latitude, longitude: here.longitude } }) });
        if (r.ok) { const body = await r.json(); address = body.address ?? ""; district = body.district ?? ""; }
      } catch { /* segue sem endereço sugerido */ }
    }
    setPreparing(false);
    onMapear({ latitude: here.latitude, longitude: here.longitude, cityId, address, district, source: "gps" });
  }

  function checkIn(spot: FieldSpot) { setVisit({ businessId: idOf(spot.key), name: spot.name, type: spot.type, sector: spot.sector }); }
  function afterVisit() {
    if (visit) {
      const key = "business:" + visit.businessId;
      if (inRoute(key) && !route.visited.includes(key)) save({ ...route, visited: [...route.visited, key] });
    }
    try { navigator.vibrate?.(40); } catch { /* sem vibração */ }
    setSituationRevision((v) => v + 1); onSaved();
  }

  const card = (spot: FieldSpot & { distance?: number }, index?: number) => {
    const s = situations.get(idOf(spot.key));
    return <article key={spot.key} className="field-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-white">{index !== undefined && <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-gold text-xs font-bold text-black">{index + 1}</span>}{spot.name}</p>
          <p className="text-xs text-zinc-400">{[spot.type, spot.sector, spot.distance !== undefined ? formatDistance(spot.distance) : here ? formatDistance(nearbyDistance(spot, here)) : ""].filter(Boolean).join(" · ")}</p>
        </div>
        {s && <SituationBadge situation={s.situation} text={s.situationText || s.situation} />}
      </div>
      {s && <p className="text-xs text-zinc-400">{s.people ? `${s.people} ${s.people === 1 ? "pessoa da rede" : "pessoas da rede"}` : "Ninguém da rede ainda"}{s.lastVisit ? ` · última visita ${s.lastVisit.split("-").reverse().join("/")}` : ""}{s.planned ? " · visita planejada" : ""}</p>}
      <div className="flex flex-wrap gap-2">
        <Button className="bg-gold text-black" onClick={() => checkIn(spot)}><Check /> Check-in</Button>
        <Button variant="outline" onClick={() => toggleRoute(spot.key)} aria-pressed={inRoute(spot.key)}>{inRoute(spot.key) ? <><Trash2 /> Tirar da rota</> : <><Route /> Pôr na rota</>}</Button>
        <Button variant="ghost" onClick={() => { onMapKey(spot.key); onClose(); }}><MapPin /> Ver no mapa</Button>
      </div>
    </article>;
  };

  const remaining = pending.slice(0, MAX_GOOGLE_STOPS);
  return <div className="field-mode" role="dialog" aria-modal="true" aria-label="Em campo">
    <header className="field-mode-head">
      <Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft /> Sair</Button>
      <h2 className="mr-auto text-lg font-semibold">Em campo</h2>
      <div className="flex rounded-full border border-white/10 p-1" role="tablist" aria-label="Em campo">
        {(["perto", "rota"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={`rounded-full px-3 py-1.5 text-sm ${tab === t ? "bg-gold text-black" : "text-zinc-300"}`} onClick={() => setTab(t)}>{t === "perto" ? "Perto de mim" : `Rota do dia${route.stops.length ? ` (${pending.length})` : ""}`}</button>)}
      </div>
    </header>
    <div className="field-mode-body">
      {(!online || waiting > 0) && <p role="status" className="flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100"><WifiOff className="size-4 shrink-0" />{!online ? "Sem internet. " : ""}{waiting ? `${waiting} ${waiting === 1 ? "cadastro esperando" : "cadastros esperando"} conexão.` : "Cadastros feitos agora ficam guardados no aparelho."}</p>}
      <p className="flex items-center gap-2 text-sm text-zinc-400"><Crosshair className="size-4 shrink-0 text-sky-400" />{here ? `Você está aqui (precisão de ${formatDistance(here.accuracy)}). Sua posição não é guardada; só o ponto de um local novo, quando você cadastra um.` : geoError || "Procurando sua posição…"}</p>
      {loadError && <p role="alert" className="rounded-xl border border-amber-300/30 p-3 text-sm text-amber-100">{loadError} <Button size="sm" variant="ghost" onClick={loadSpots}>Tentar de novo</Button></p>}

      {tab === "perto" && <>
        <Button className="h-14 bg-gold text-base text-black" disabled={!here || preparing} onClick={() => void newPlaceHere()}><Plus /> {preparing ? "Buscando o endereço…" : "Novo local aqui"}</Button>
        {!spots && !loadError && <p role="status" className="text-sm text-zinc-400">Carregando os locais…</p>}
        {near && <>
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">{near.within ? `${near.items.length} ${near.items.length === 1 ? "local" : "locais"} a até 300 m` : "Nenhum local a 300 m · os mais perto"}</h3>
          {near.items.map((spot) => card(spot))}
          {!near.items.length && <p className="text-sm text-zinc-400">Nenhum local com ponto no mapa ainda. Use “Novo local aqui”.</p>}
        </>}
      </>}

      {tab === "rota" && <>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void addTodayReturns()}><Plus /> Visitas planejadas para hoje</Button>
          {route.stops.length > 0 && <Button variant="ghost" onClick={() => save({ day: today(), stops: [], visited: [] })}><Trash2 /> Limpar rota</Button>}
        </div>
        {!route.stops.length && <p className="text-sm text-zinc-400">Toque em “Pôr na rota” nos locais de “Perto de mim” ou traga as visitas planejadas para hoje. A ordem sai do mais perto para o mais longe.</p>}
        {pending.length > 0 && <>
          <p className="text-sm text-zinc-300">{pending.length} {pending.length === 1 ? "parada" : "paradas"} · cerca de {formatDistance(routeLength(pending, here))}{here ? " a partir de onde você está" : ""}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-gold text-black"><a href={googleMapsRoute(remaining)} target="_blank" rel="noopener noreferrer"><Navigation /> Google Maps{pending.length > MAX_GOOGLE_STOPS ? ` (${MAX_GOOGLE_STOPS} primeiras)` : ""}<ExternalLink className="size-3" /></a></Button>
            <Button asChild variant="outline"><a href={wazeTo(pending[0])} target="_blank" rel="noopener noreferrer"><ArrowDown /> Waze até {pending[0].name}<ExternalLink className="size-3" /></a></Button>
          </div>
          {pending.map((spot, i) => card(spot, i))}
        </>}
        {done.length > 0 && <details className="field-card"><summary className="cursor-pointer text-sm text-zinc-300">Visitados hoje ({done.length})</summary><ul className="mt-2 grid gap-1 text-sm text-zinc-400">{done.map((s) => <li key={s.key}>✓ {s.name}</li>)}</ul></details>}
      </>}
    </div>
    {visit && <VisitDialog place={visit} onClose={() => setVisit(null)} onSaved={afterVisit} onMapPeople={(businessId) => { setVisit(null); onMapKey("business:" + businessId); onClose(); }} />}
  </div>;
}

function nearbyDistance(spot: LatLng, here: LatLng) { return nearby([spot], here, Infinity, 1).items[0]?.distance ?? 0; }
