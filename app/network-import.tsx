"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { parseBusinessFile } from "@/lib/commercial-import";
import type { DashboardData } from "@/lib/expansion-types";
import { nameKey } from "@/lib/places";
import { batches, buildNetworkRows, describeRow, mapColumns, NETWORK_TEMPLATE, orderByReferrer, summarize, type NetworkOutcome, type NetworkRow, type RowProblem } from "@/lib/network-import";
import { tenantFetch } from "@/lib/tenant-request";

type Stage = "file" | "preview" | "saving" | "done";

/**
 * Importa a rede inteira por planilha: uma linha por pessoa, com quem indicou, contato e venda.
 * Prévia sem gravar; depois grava em lotes de 50, na ordem em que quem indica vem antes de quem foi indicado.
 */
export function NetworkImport({ data, onSaved, onMap, onNetwork }: { data: DashboardData; onSaved: () => Promise<void>; onMap?: () => void; onNetwork?: () => void }) {
  const [grid, setGrid] = useState<string[][]>([]);
  const [defaultCity, setDefaultCity] = useState("");
  const [consent, setConsent] = useState(false);
  const [rows, setRows] = useState<NetworkRow[]>([]);
  const [problems, setProblems] = useState<RowProblem[]>([]);
  const [outcomes, setOutcomes] = useState<Map<number, NetworkOutcome>>(new Map());
  const [stage, setStage] = useState<Stage>("file");
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  const columns = mapColumns(grid[0] ?? []);
  const hasName = columns.name !== undefined;
  const hasCity = columns.city !== undefined;

  async function send(list: NetworkRow[], commit: boolean, fileKeys: string[]) {
    const response = await tenantFetch("/api/territory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "import_network", data: { rows: list, commit, consent: true, fileKeys } }) });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || "Não foi possível importar. Confira a planilha e a conexão e tente de novo.");
    return body.result.rows as NetworkOutcome[];
  }
  async function run(commit: boolean, list: NetworkRow[]) {
    const fileKeys = list.map((row) => row.cityId + "|" + nameKey(row.name));
    const result = new Map<number, NetworkOutcome>(commit ? outcomes : []);
    const parts = batches(list);
    for (const [index, part] of parts.entries()) {
      setProgress(`${commit ? "Importando" : "Conferindo"} ${index * 50 + 1}–${index * 50 + part.length} de ${list.length}…`);
      for (const outcome of await send(part, commit, fileKeys)) result.set(outcome.line, outcome);
      setOutcomes(new Map(result));
    }
    setProgress("");
    return result;
  }
  async function preview() {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const built = buildNetworkRows(grid, data.cities, defaultCity ? Number(defaultCity) : null);
      const ordered = orderByReferrer(built.rows);
      setRows(ordered); setProblems(built.problems);
      if (ordered.length) await run(false, ordered); else setOutcomes(new Map());
      setStage("preview");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha na prévia."); setProgress(""); }
    finally { lock.current = false; setBusy(false); }
  }
  async function commit() {
    if (lock.current) return; lock.current = true; setBusy(true); setError(""); setStage("saving");
    try {
      const valid = rows.filter((row) => outcomes.get(row.line)?.ok);
      await run(true, valid);
      setStage("done");
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível importar. Confira a planilha e a conexão e tente de novo."); setStage("preview"); setProgress(""); }
    finally { lock.current = false; setBusy(false); }
  }
  function restart() { setGrid([]); setRows([]); setProblems([]); setOutcomes(new Map()); setStage("file"); setConsent(false); setError(""); setProgress(""); }

  const summary = summarize([...outcomes.values()]);
  const okRows = rows.filter((row) => outcomes.get(row.line)?.ok);
  const failedRows = rows.filter((row) => outcomes.get(row.line) && !outcomes.get(row.line)!.ok);
  const lineOf = (row: NetworkRow) => outcomes.get(row.line);

  return <details className="elite-card mb-4 p-4" data-testid="network-import"><summary className="cursor-pointer font-semibold">Importar a rede por planilha (mentorados, vendas e indicações)</summary><div className="mt-4 space-y-3 text-sm">
    <p className="text-zinc-400">Uma linha por pessoa. Só o <strong className="text-zinc-200">Nome</strong> é obrigatório. <strong className="text-zinc-200">Bairro</strong> coloca a pessoa no centro do bairro no mapa (bairros novos são cadastrados e a gestão confere o ponto em Território → Cidades). <strong className="text-zinc-200">Quem indicou</strong> é o nome de outra pessoa (da planilha ou já no mapa). Com <strong className="text-zinc-200">WhatsApp</strong> ou <strong className="text-zinc-200">E-mail</strong> a pessoa ganha atendimento; com <strong className="text-zinc-200">Valor</strong> e <strong className="text-zinc-200">Data do pagamento</strong> a venda entra como paga e ela fica dourada no mapa. Quem já está no mapa é reaproveitado, nada é duplicado. Papel: Mentorado, Mentor, Equipe, Parceiro, Vendedor, Cliente assinante ou Network. Nunca inclua endereço de residência.</p>
    <a className="text-amber-200 underline" download="modelo-rede.csv" href={"data:text/csv;charset=utf-8," + encodeURIComponent(NETWORK_TEMPLATE)}>Baixar modelo CSV (as linhas EXEMPLO só mostram o formato: troque pelos dados reais)</a>
    {stage === "file" && <>
      <label className="grid gap-1">Arquivo (CSV ou XLSX, até 1 MB)<input disabled={busy} type="file" accept=".csv,.xlsx" onChange={async (e) => { setError(""); try { const file = e.target.files?.[0]; if (file) setGrid(await parseBusinessFile(file)); } catch (err) { setGrid([]); setError(err instanceof Error ? err.message : "Arquivo inválido."); } }} /></label>
      {grid.length > 0 && !hasName && <p role="alert" className="text-red-300">A primeira linha precisa ter a coluna &ldquo;Nome&rdquo;. Use o modelo.</p>}
      {grid.length > 0 && hasName && <p className="text-zinc-400">Colunas reconhecidas: {Object.keys(columns).length} de {grid[0].length}. {!hasCity && "Sem coluna Cidade: escolha a cidade de todas as pessoas abaixo."}</p>}
      {grid.length > 0 && !hasCity && <label className="grid gap-1">Cidade de todas as pessoas<select className="commercial-input" value={defaultCity} onChange={(e) => setDefaultCity(e.target.value)}><option value="">Selecione</option>{data.cities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {grid.length > 0 && <label className="flex items-start gap-2 text-zinc-300"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />Confirmo que estas pessoas autorizaram o contato (WhatsApp ou e-mail) para atendimento e mentoria, e que posso registrá-las com nome e cidade.</label>}
      <Button disabled={busy || grid.length < 2 || !hasName || !consent || (!hasCity && !defaultCity)} onClick={preview}>{busy ? progress || "Conferindo…" : `Conferir ${Math.max(grid.length - 1, 0)} linha(s)`}</Button>
    </>}
    {stage !== "file" && <>
      {stage === "preview" && <p className="text-zinc-200">{summary.ok} linha(s) prontas: {summary.newPeople} pessoa(s) nova(s) no mapa, {summary.existing} já no mapa, {summary.referrals} indicação(ões), {summary.leads} atendimento(s) novo(s), {summary.sales} venda(s). {summary.failed + problems.length > 0 && `${summary.failed + problems.length} linha(s) com problema ficam de fora.`}</p>}
      {(stage === "saving" || stage === "done") && <p role="status" className="text-zinc-200">{stage === "saving" ? progress || "Importando…" : `Importação concluída: ${summary.ok} linha(s) salvas, ${summary.newPeople} pessoa(s) nova(s), ${summary.referrals} indicação(ões), ${summary.leads} atendimento(s), ${summary.sales} venda(s).`}</p>}
      {(failedRows.length > 0 || problems.length > 0) && <div><p className="font-semibold text-red-200">Linhas com problema (corrija na planilha e importe de novo só elas)</p><ul className="max-h-48 space-y-1 overflow-y-auto" aria-label="Linhas com problema">{[...problems, ...failedRows.map((row) => ({ line: row.line, status: `${row.name}: ${lineOf(row)!.status}` }))].sort((a, b) => a.line - b.line).map((p) => <li key={p.line} className="text-red-300">Linha {p.line}: {p.status}</li>)}</ul></div>}
      {okRows.length > 0 && <div className="overflow-x-auto"><table className="followup-table w-full text-left" aria-label="O que vai acontecer com cada linha"><thead><tr><th className="pr-3">Linha</th><th className="pr-3">Pessoa</th><th className="pr-3">Cidade</th><th>O que acontece</th></tr></thead><tbody>{okRows.slice(0, 200).map((row) => <tr key={row.line} className={stage === "done" ? "text-emerald-200" : ""}><td className="pr-3">{row.line}</td><td className="pr-3">{row.name}</td><td className="pr-3">{data.cities.find((c) => c.id === row.cityId)?.name}</td><td>{describeRow(row, lineOf(row))}</td></tr>)}</tbody></table>{okRows.length > 200 && <p className="text-zinc-400">Mostrando 200 de {okRows.length} linhas.</p>}</div>}
      {stage === "preview" && <div className="flex flex-wrap gap-2"><Button disabled={busy || !summary.ok} onClick={commit}>{`Importar ${summary.ok} linha(s)`}</Button><Button variant="ghost" disabled={busy} onClick={restart}>Escolher outro arquivo</Button></div>}
      {stage === "done" && <div className="flex flex-wrap gap-2">{onMap && <Button onClick={onMap}>Ver no mapa</Button>}{onNetwork && <Button variant="outline" onClick={onNetwork}>Ver a rede</Button>}<Button variant="ghost" onClick={restart}>Importar outra planilha</Button></div>}
    </>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </div></details>;
}
