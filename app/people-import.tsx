"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { parseBusinessFile } from "@/lib/commercial-import";
import type { DashboardData } from "@/lib/expansion-types";
import { nameKey, PERSON_ROLES, PLACE_LINKS } from "@/lib/places";
import { tenantFetch } from "@/lib/tenant-request";

type Outcome = { line: number; ok: boolean; status: string };
type Row = { cityId: number; name: string; place: string; link: string; role: string };
const COLUMNS = [["name", "Nome"], ["city", "Cidade"], ["place", "Local"], ["link", "Vínculo"], ["role", "Papel"]] as const;
const TEMPLATE = "﻿Nome;Cidade;Local;Vínculo;Papel\r\nMaria Souza;Esmeraldas;Padaria Pão Dourado;Sócio / dono;Mentorado\r\n";

/** Importa pessoas de uma planilha, cada uma ligada ao local pelo nome (que já precisa estar cadastrado). */
export function PeopleImport({ data, onSaved }: { data: DashboardData; onSaved: () => Promise<void> }) {
  const [grid, setGrid] = useState<string[][]>([]);
  const [defaultCity, setDefaultCity] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState<(Row | null)[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [stage, setStage] = useState<"file" | "preview" | "done">("file");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  const header = grid[0]?.map((cell) => nameKey(cell)) ?? [];
  const column = (label: string) => header.indexOf(nameKey(label));
  const hasCityColumn = column("Cidade") >= 0;

  function build(): { rows: (Row | null)[]; problems: Outcome[] } {
    const problems: Outcome[] = [];
    const built = grid.slice(1).map((cells, index) => {
      const value = (label: string) => (column(label) >= 0 ? cells[column(label)] ?? "" : "").trim();
      const cityText = value("Cidade");
      const city = cityText ? data.cities.find((item) => nameKey(item.name) === nameKey(cityText)) : data.cities.find((item) => String(item.id) === defaultCity);
      if (!city) { problems.push({ line: index + 2, ok: false, status: cityText ? `Cidade "${cityText}" não cadastrada ou fora do seu acesso.` : "Escolha a cidade." }); return null; }
      return { cityId: city.id, name: value("Nome"), place: value("Local"), link: value("Vínculo"), role: value("Papel") };
    });
    return { rows: built, problems };
  }
  async function send(commit: boolean, list: Row[]) {
    const response = await tenantFetch("/api/territory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "import_people", data: { rows: list, commit } }) });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || "Falha na importação.");
    return body.result.rows as Outcome[];
  }
  async function preview() {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const { rows: built, problems } = build();
      const valid = built.filter((row): row is Row => row !== null);
      const server = valid.length ? await send(false, valid) : [];
      let k = 0;
      setOutcomes(built.map((row, index) => row ? { ...server[k++], line: index + 2 } : problems.find((p) => p.line === index + 2)!));
      setRows(built); setStage("preview");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha na prévia."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function commit() {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const indices = rows.map((_, i) => i).filter((i) => rows[i] && outcomes[i]?.ok);
      const saved = await send(true, indices.map((i) => rows[i]!));
      const next = [...outcomes];
      indices.forEach((index, i) => { next[index] = { ...saved[i], line: index + 2 }; });
      setOutcomes(next); setStage("done");
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha na importação."); }
    finally { lock.current = false; setBusy(false); }
  }
  function restart() { setGrid([]); setRows([]); setOutcomes([]); setStage("file"); setAuthorized(false); setError(""); }

  const okCount = outcomes.filter((o) => o.ok).length;
  return <details className="elite-card mt-4 p-4"><summary className="cursor-pointer font-semibold">Importar pessoas por planilha (CSV ou XLSX)</summary><div className="mt-4 space-y-3 text-sm">
    <p className="text-zinc-400">Até 50 pessoas por lote. Colunas: {COLUMNS.map(([, label]) => label).join(", ")}. Só o nome é obrigatório. O <strong className="text-zinc-200">Local</strong> precisa estar cadastrado na mesma cidade (escreva o nome igual). Vínculo: {PLACE_LINKS.join(", ")}. Papel: {PERSON_ROLES.join(", ")}. Nunca inclua endereço de residência.</p>
    <a className="text-amber-200 underline" download="modelo-pessoas.csv" href={"data:text/csv;charset=utf-8," + encodeURIComponent(TEMPLATE)}>Baixar modelo CSV</a>
    {stage === "file" && <>
      <label className="grid gap-1">Arquivo<input disabled={busy} type="file" accept=".csv,.xlsx" onChange={async (e) => { setError(""); try { const file = e.target.files?.[0]; if (file) setGrid(await parseBusinessFile(file)); } catch (err) { setGrid([]); setError(err instanceof Error ? err.message : "Arquivo inválido."); } }} /></label>
      {grid.length > 0 && column("Nome") < 0 && <p role="alert" className="text-red-300">A primeira linha precisa ter a coluna &ldquo;Nome&rdquo;. Use o modelo.</p>}
      {grid.length > 0 && !hasCityColumn && <label className="grid gap-1">Cidade de todas as pessoas<select className="commercial-input" value={defaultCity} onChange={(e) => setDefaultCity(e.target.value)}><option value="">Selecione</option>{data.cities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {grid.length > 0 && <label className="flex items-start gap-2 text-zinc-300"><input type="checkbox" className="mt-1" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />Confirmo que posso registrar estas pessoas só com nome, cidade e vínculo.</label>}
      <Button disabled={busy || grid.length < 2 || column("Nome") < 0 || !authorized || (!hasCityColumn && !defaultCity)} onClick={preview}>{busy ? "Conferindo…" : `Conferir ${Math.max(grid.length - 1, 0)} linha(s)`}</Button>
    </>}
    {stage !== "file" && <>
      <ul className="max-h-72 space-y-1 overflow-y-auto" aria-label="Resultado por linha">{outcomes.map((o) => <li key={o.line} className={o.ok ? "text-emerald-300" : "text-red-300"}>Linha {o.line}: {o.status}</li>)}</ul>
      {stage === "preview" && <div className="flex flex-wrap gap-2"><Button disabled={busy || !okCount} onClick={commit}>{busy ? "Importando…" : `Importar ${okCount} pessoa(s) válida(s)`}</Button><Button variant="ghost" disabled={busy} onClick={restart}>Escolher outro arquivo</Button></div>}
      {stage === "done" && <Button variant="outline" onClick={restart}>Importar outra planilha</Button>}
    </>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </div></details>;
}
