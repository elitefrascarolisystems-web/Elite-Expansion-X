"use client";
import { useCallback, useEffect, useState } from "react";
import { MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardData } from "@/lib/expansion-types";
import { tenantFetch } from "@/lib/tenant-request";

type Region = { id: string; cityId: number; name: string; located: boolean; latitude: number | null; longitude: number | null; people: number };
type Found = { name: string; latitude: number; longitude: number };

/**
 * Bairros de cada cidade: a pessoa sem local aparece no centro do bairro (nunca na residência).
 * Aqui a gestão cadastra, confere o ponto pela busca de endereço e remove bairros sem pessoas.
 */
export function RegionPanel({ data, onChanged }: { data: DashboardData; onChanged?: () => void }) {
  const [cityId, setCityId] = useState(String(data.cities[0]?.id ?? ""));
  // `null` = carregando (a troca de cidade zera a lista antes de buscar).
  const [regions, setRegions] = useState<Region[] | null>(null);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState("");
  const [locating, setLocating] = useState<Region | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const manage = ["Administrador", "Coordenação", "Líder"].includes(data.access.role);

  const load = useCallback((city: string) => {
    if (!city) return Promise.resolve();
    return tenantFetch(`/api/territory?regions=${city}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar os bairros.");
      setRegions(body.regions);
    }).catch((e) => { setError(e instanceof Error ? e.message : "Não foi possível carregar os bairros."); setRegions([]); });
  }, []);
  useEffect(() => { void load(cityId); }, [cityId, load]);

  async function post(action: string, payload: Record<string, unknown>) {
    const response = await tenantFetch("/api/territory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data: payload }) });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || "Não foi possível salvar.");
    return body.result;
  }
  async function geocode(name: string): Promise<Found[]> {
    const response = await tenantFetch("/api/territory/geocode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cityId: Number(cityId), kind: "region", query: name }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Busca indisponível.");
    return body.results as Found[];
  }
  async function add() {
    const name = newName.trim(); if (name.length < 2) return;
    setBusy("add"); setError("");
    try {
      let point: Found | null = null;
      try { point = (await geocode(name))[0] ?? null; } catch { point = null; }
      await post("region", { cityId: Number(cityId), name, latitude: point?.latitude ?? null, longitude: point?.longitude ?? null, source: point ? "Busca do bairro pelo nome" : "" });
      setNewName(""); await load(cityId); onChanged?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível cadastrar o bairro."); }
    finally { setBusy(""); }
  }
  async function search() {
    if (!locating || query.trim().length < 3) return;
    setBusy("search"); setError("");
    try { setResults(await geocode(query.trim())); } catch (e) { setError(e instanceof Error ? e.message : "Busca indisponível."); }
    finally { setBusy(""); }
  }
  async function place(region: Region, found: Found) {
    setBusy(region.id); setError("");
    try { await post("region", { id: region.id, cityId: region.cityId, name: region.name, latitude: found.latitude, longitude: found.longitude, source: `Busca de endereço: ${found.name}`.slice(0, 200) }); setLocating(null); setResults([]); setQuery(""); await load(cityId); onChanged?.(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar o ponto."); }
    finally { setBusy(""); }
  }
  async function remove(region: Region) {
    if (!confirm(`Remover o bairro "${region.name}"?`)) return;
    setBusy(region.id); setError("");
    try { await post("region_delete", { id: region.id }); await load(cityId); onChanged?.(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível remover."); }
    finally { setBusy(""); }
  }

  const pending = (regions ?? []).filter((r) => !r.located).length;
  return <article className="elite-card mt-6 p-5" data-testid="region-panel">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="section-kicker">Bairros</p><h3 className="text-lg font-semibold text-white">Onde as pessoas aparecem no mapa</h3><p className="mt-1 max-w-2xl text-sm text-zinc-400">Quem não tem local ligado aparece no centro do bairro, nunca na residência. Cadastre os bairros da cidade e confira o ponto de cada um; o calor e a cobertura passam a mostrar bairros fortes e fracos.</p></div>
      <label className="grid gap-1 text-sm">Cidade<select className="commercial-input" value={cityId} onChange={(e) => { setCityId(e.target.value); setRegions(null); setLocating(null); }}>{data.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    </div>
    {cityId && <div className="mt-4 flex flex-wrap items-center gap-2"><input className="commercial-input sm:max-w-xs" aria-label="Novo bairro" placeholder="Nome do bairro" value={newName} maxLength={120} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }} /><Button disabled={busy === "add" || newName.trim().length < 2} onClick={add}>{busy === "add" ? "Buscando o ponto…" : "Cadastrar bairro"}</Button><span className="text-xs text-zinc-400">O ponto vem da busca pelo nome do bairro; confira no mapa.</span></div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {regions === null ? <p className="mt-4 text-sm text-zinc-400">Carregando bairros…</p> : regions.length === 0 ? <p className="mt-4 text-sm text-zinc-400">Nenhum bairro cadastrado nesta cidade. Cadastre os principais ou importe a rede com a coluna Bairro.</p> : <>
      <p className="mt-4 text-sm text-zinc-300">{regions.length} bairro(s){pending ? ` · ${pending} sem ponto no mapa` : " · todos com ponto no mapa"}</p>
      <ul className="mt-2 divide-y divide-white/6" aria-label="Bairros da cidade">{regions.map((r) => <li key={r.id} className="grid gap-2 py-3 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
        <div><p className="font-medium text-white">{r.name}</p><p className="text-xs text-zinc-400">{r.people} {r.people === 1 ? "pessoa" : "pessoas"}</p></div>
        <p className={`text-sm ${r.located ? "text-emerald-200" : "text-amber-200"}`}>{r.located ? "No mapa" : "Sem ponto no mapa"}</p>
        <div className="flex flex-wrap gap-2">{manage && <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => { setLocating(locating?.id === r.id ? null : r); setQuery(r.name); setResults([]); }}><MapPin />{r.located ? "Ajustar ponto" : "Localizar"}</Button>}{manage && r.people === 0 && <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => remove(r)} aria-label={`Remover ${r.name}`}><Trash2 /></Button>}</div>
        {locating?.id === r.id && <div className="sm:col-span-3 grid gap-2 rounded-lg border border-white/8 bg-white/[0.03] p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><input className="commercial-input sm:max-w-sm" aria-label="Buscar o bairro no mapa" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }} /><Button size="sm" disabled={busy === "search" || query.trim().length < 3} onClick={search}>{busy === "search" ? "Buscando…" : "Buscar"}</Button><Button size="sm" variant="ghost" onClick={() => setLocating(null)}>Fechar</Button></div>{results.length > 0 && <ul className="grid gap-1">{results.map((f, i) => <li key={i}><button type="button" className="text-left text-amber-200 underline" disabled={busy === r.id} onClick={() => place(r, f)}>{f.name}</button></li>)}</ul>}{results.length === 0 && busy !== "search" && <p className="text-xs text-zinc-400">Busque pelo nome do bairro e escolha o resultado certo. Só o nome do bairro e a cidade são enviados.</p>}</div>}
      </li>)}</ul>
    </>}
  </article>;
}
