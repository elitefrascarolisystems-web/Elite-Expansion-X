"use client";
import { useState, type ReactNode } from "react";
import { BarChart3, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ChartTableData = { columns: string[]; rows: (string | number)[][] };

/**
 * Moldura de todo gráfico: a pergunta que ele responde, a conclusão em uma frase
 * e o botão "Ver tabela" (os mesmos números, para quem prefere ler ou usa leitor de tela).
 */
export function ChartFrame({ kicker, title, takeaway, table, children }: { kicker?: string; title: string; takeaway?: string; table: ChartTableData; children: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return <article className="elite-card p-5 sm:p-6">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">{kicker && <p className="section-kicker">{kicker}</p>}<h3 className="text-xl font-semibold text-white">{title}</h3>{takeaway && <p className="mt-1 text-sm leading-6 text-zinc-400">{takeaway}</p>}</div>
      <Button type="button" size="sm" variant="outline" aria-pressed={asTable} onClick={() => setAsTable((value) => !value)} className="border-white/10 bg-white/5 text-zinc-200">{asTable ? <><BarChart3 /> Ver gráfico</> : <><Table2 /> Ver tabela</>}</Button>
    </div>
    {asTable ? <div className="elite-table-stack overflow-x-auto"><Table>
      <TableHeader><TableRow className="border-white/8">{table.columns.map((column, index) => <TableHead key={column} className={index ? "text-right" : ""}>{column}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{table.rows.map((row, rowIndex) => <TableRow key={rowIndex} className="border-white/7">{row.map((cell, index) => <TableCell key={index} data-label={table.columns[index]} className={index ? "text-right" : "font-medium text-white"}>{cell}</TableCell>)}</TableRow>)}</TableBody>
    </Table></div> : children}
  </article>;
}
