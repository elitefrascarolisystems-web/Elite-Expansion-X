"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { tenantFetch } from "@/lib/tenant-request";

export type RegionOption = { id: string; cityId: number; name: string; located: boolean };

/**
 * Campo "Bairro": a pessoa sem local aparece no centro do bairro, nunca na residência.
 * Quem mapeia pode cadastrar o bairro na hora; o ponto vem da busca de endereço (sem dados pessoais) e pode ser conferido em Território → Cidades.
 */
export function RegionSelect({ regions, cityId, name = "regionId", initialValue = "", onChange, canAdd = false, onAdded, className = "commercial-input", label = "Sem bairro · centro da cidade" }: { regions: RegionOption[]; cityId: number; name?: string; initialValue?: string; onChange?: (id: string) => void; canAdd?: boolean; onAdded?: (region: RegionOption) => void; className?: string; label?: string }) {
  const [value, setValue] = useState(initialValue);
  const [extra, setExtra] = useState<RegionOption[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = [...regions, ...extra].filter((r) => r.cityId === cityId && !(extra.some((e) => e.id === r.id) && regions.some((g) => g.id === r.id))).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const choose = (id: string) => { setValue(id); onChange?.(id); };

  async function add() {
    const trimmed = newName.trim();
    if (trimmed.length < 2 || busy) return;
    setBusy(true); setError("");
    try {
      // Centro do bairro pela busca de endereço (só o nome do bairro e a cidade são enviados).
      let point: { latitude: number; longitude: number } | null = null;
      try {
        const found = await tenantFetch("/api/territory/geocode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cityId, kind: "region", query: trimmed }) });
        const body = await found.json();
        if (found.ok && body.results?.[0]) point = { latitude: body.results[0].latitude, longitude: body.results[0].longitude };
      } catch { point = null; }
      const response = await tenantFetch("/api/territory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "region", data: { cityId, name: trimmed, latitude: point?.latitude ?? null, longitude: point?.longitude ?? null, source: point ? "Busca do bairro pelo nome" : "" } }) });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Não foi possível cadastrar o bairro.");
      const region: RegionOption = { id: body.result.id, cityId, name: trimmed, located: Boolean(point) || Boolean(body.result.existing) };
      setExtra((list) => list.some((r) => r.id === region.id) ? list : [...list, region]);
      choose(region.id); setAdding(false); setNewName(""); onAdded?.(region);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível cadastrar o bairro."); }
    finally { setBusy(false); }
  }

  return <div className="grid gap-2">
    <select name={name} className={className} value={value} onChange={(e) => choose(e.target.value)} aria-label="Bairro">
      <option value="">{label}</option>
      {options.map((r) => <option key={r.id} value={r.id}>{r.name}{r.located ? "" : " (sem ponto no mapa)"}</option>)}
    </select>
    {canAdd && !adding && <button type="button" className="justify-self-start text-xs text-amber-200 underline" onClick={() => setAdding(true)}>+ Cadastrar bairro</button>}
    {canAdd && adding && <div className="flex flex-wrap items-center gap-2">
      <input className={className + " sm:max-w-xs"} aria-label="Nome do bairro" placeholder="Nome do bairro" value={newName} maxLength={120} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }} />
      <Button type="button" size="sm" disabled={busy || newName.trim().length < 2} onClick={add}>{busy ? "Buscando…" : "Salvar bairro"}</Button>
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setAdding(false); setNewName(""); setError(""); }}>Cancelar</Button>
    </div>}
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
  </div>;
}
