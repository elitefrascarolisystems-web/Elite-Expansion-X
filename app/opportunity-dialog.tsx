"use client";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ACTIVITY_KINDS, STAGES, TEMPERATURES } from "@/lib/commercial";
import type { DashboardData } from "@/lib/expansion-types";
import type { FollowupRow } from "@/lib/followup";
import { tenantFetch } from "@/lib/tenant-request";

export type OpportunityEdit = { mode: "dados" | "atividade"; row: FollowupRow };
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());

async function post(action: string, data: unknown) {
  const response = await tenantFetch("/api/commercial", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) throw new Error(body.error || "Não foi possível salvar. Confira a conexão e tente de novo.");
}

/**
 * Dados da oportunidade (etapa, temperatura, local, próximo passo, motivo da perda) e
 * registro de atividade, direto da ficha do atendimento.
 */
export function OpportunityDialog({ edit, data, onClose, onSaved }: { edit: OpportunityEdit | null; data: DashboardData; onClose: () => void; onSaved: () => void }) {
  return <Dialog open={edit !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto text-white sm:max-w-lg">
      {edit && <EditForm key={`${edit.mode}-${edit.row.id}`} edit={edit} data={data} onClose={onClose} onSaved={onSaved} />}
    </DialogContent>
  </Dialog>;
}

function EditForm({ edit, data, onClose, onSaved }: { edit: OpportunityEdit; data: DashboardData; onClose: () => void; onSaved: () => void }) {
  const { row, mode } = edit;
  const [stage, setStage] = useState(row.stage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const places = (data.places ?? []).filter((place) => place.cityId === row.city_id);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      if (mode === "dados") {
        await post("opportunity", {
          id: row.id, version: row.version, leadId: row.lead_id, ownerEmail: row.owner_email,
          businessId: String(f.get("businessId") || "") || null, temperature: f.get("temperature"), stage,
          nextAction: String(f.get("nextAction") ?? ""), dueDate: f.get("dueDate"), lostReason: String(f.get("lostReason") ?? ""),
        });
        toast.success("Dados da oportunidade salvos.");
      } else {
        await post("activity", { id: crypto.randomUUID(), opportunityId: row.id, kind: f.get("kind"), note: f.get("note"), day: f.get("day") });
        toast.success("Atividade registrada no atendimento.");
      }
      onSaved(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar. Confira a conexão e tente de novo."); }
    finally { setBusy(false); }
  }

  return <>
    <DialogHeader>
      <DialogTitle>{mode === "dados" ? `Dados da oportunidade · ${row.lead_name}` : `Registrar atividade · ${row.lead_name}`}</DialogTitle>
      <DialogDescription className="text-zinc-400">{mode === "dados" ? "Etapa, temperatura e local vinculado. “Ganho” não confirma pagamento: a receita só entra com o pagamento confirmado." : "Contato, reunião ou proposta feita com esta pessoa. Fica no histórico do atendimento."}</DialogDescription>
    </DialogHeader>
    <form onSubmit={submit} className="grid gap-3 text-sm">
      {mode === "dados" ? <>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">Etapa<select name="stage" value={stage} onChange={(e) => setStage(e.target.value)} className="commercial-input">{STAGES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="grid gap-1">Temperatura<select name="temperature" defaultValue={row.temperature ?? "Morno"} className="commercial-input">{TEMPERATURES.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <label className="grid gap-1">Local vinculado (opcional)<select name="businessId" defaultValue={row.business_id ?? ""} className="commercial-input"><option value="">Nenhum</option>{places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
        {!["Ganho", "Perdido"].includes(stage) && <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="grid gap-1">Próximo passo<input name="nextAction" required minLength={3} maxLength={500} defaultValue={row.next_action} className="commercial-input" /></label>
          <label className="grid gap-1">Quando<input name="dueDate" type="date" required defaultValue={(row.due_date || today()).slice(0, 10)} className="commercial-input" /></label>
        </div>}
        {["Ganho", "Perdido"].includes(stage) && <input type="hidden" name="dueDate" value={(row.due_date || today()).slice(0, 10)} />}
        {stage === "Perdido" && <label className="grid gap-1">Motivo da perda<input name="lostReason" required minLength={3} maxLength={500} defaultValue={row.lost_reason ?? ""} className="commercial-input" /></label>}
      </> : <>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">Tipo<select name="kind" defaultValue="Contato" className="commercial-input">{ACTIVITY_KINDS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="grid gap-1">Dia<input name="day" type="date" required max={today()} defaultValue={today()} className="commercial-input" /></label>
        </div>
        <label className="grid gap-1">O que foi feito<textarea name="note" required minLength={3} maxLength={1000} className="commercial-input min-h-24" /></label>
      </>}
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy} className="bg-gold text-black">{busy && <LoaderCircle className="animate-spin" />} {mode === "dados" ? "Salvar dados" : "Registrar atividade"}</Button></div>
    </form>
  </>;
}
