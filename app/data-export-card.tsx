"use client";
/** Cópia completa dos dados da empresa: um ZIP com uma planilha por assunto. Só para o administrador. */
import { useState } from "react";
import { Archive, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { tenantFetch } from "@/lib/tenant-request";

export function DataExportCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true); setError("");
    try {
      const response = await tenantFetch("/api/export", { method: "POST" });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || "Não foi possível montar a cópia agora."); }
      const blob = await response.blob();
      const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "elite-x-dados.zip";
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Cópia completa baixada.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível montar a cópia agora."); }
    finally { setBusy(false); }
  }
  return <article className="elite-card p-6">
    <p className="section-kicker">Seus dados</p>
    <h3 className="text-lg font-semibold text-white">Cópia completa dos dados</h3>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Baixe tudo o que a empresa tem na plataforma: cidades, locais, pessoas da rede, contatos, atendimentos, vendas, custos, metas e o histórico. Uma planilha para cada assunto, num arquivo ZIP. Os dados são da sua empresa: a cópia não depende do plano.</p>
    <ul className="mt-3 grid gap-1 text-sm text-zinc-300 sm:grid-cols-3">
      <li>· Abre no Excel, Google Planilhas ou LibreOffice</li>
      <li>· Sem senhas nem chaves de acesso</li>
      <li>· Fica registrada no Histórico</li>
    </ul>
    <p className="mt-3 text-xs leading-5 text-subtle">A cópia tem dados pessoais (equipe, contatos, pessoas da rede): guarde em lugar seguro e compartilhe só com quem precisa (LGPD).</p>
    {error && <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
    <Button className="mt-4 bg-gold text-black" disabled={busy} onClick={() => void download()}>{busy ? <><LoaderCircle className="animate-spin" /> Montando a cópia…</> : <><Archive /> Baixar cópia completa (.zip)</>}</Button>
  </article>;
}
