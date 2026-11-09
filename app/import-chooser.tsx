"use client";
/**
 * "+ Novo → Importar planilha" (simplificação, parte 4): um só lugar para importar. Dois modelos:
 * pessoas e rede (pessoa, local, vínculo, papel, quem indicou e venda opcional) e empresas e locais.
 */
import { Building2, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ImportChooser({ canPeople, onClose, onGo }: { canPeople: boolean; onClose: () => void; onGo: (target: string) => void }) {
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="bg-zinc-950 text-white">
      <DialogHeader><DialogTitle>Importar planilha</DialogTitle><DialogDescription>Escolha o que a planilha traz. Cada tela tem o modelo para baixar e mostra a prévia antes de gravar.</DialogDescription></DialogHeader>
      <div className="grid gap-3">
        {canPeople && <Button variant="outline" className="h-auto justify-start whitespace-normal p-4 text-left" onClick={() => { onGo("rede/indicacoes"); onClose(); }}><Network className="shrink-0" /><span><strong className="block">Pessoas e rede</strong><span className="text-xs text-zinc-400">Pessoa, cidade, bairro, local e vínculo, papel, quem indicou e, se houver, a venda.</span></span></Button>}
        <Button variant="outline" className="h-auto justify-start whitespace-normal p-4 text-left" onClick={() => { onGo("territorio/locais"); onClose(); }}><Building2 className="shrink-0" /><span><strong className="block">Empresas e locais</strong><span className="text-xs text-zinc-400">Estabelecimentos com nome, atividade, setor e fonte dos dados.</span></span></Button>
      </div>
    </DialogContent>
  </Dialog>;
}
