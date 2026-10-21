"use client";
import { useState } from "react";
import { HandCoins, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TEMPERATURES } from "@/lib/commercial";
import type { DashboardData } from "@/lib/expansion-types";
import { LEAD_CHANNELS } from "@/lib/journey";
import { tenantFetch } from "@/lib/tenant-request";

export type AttendancePerson = { id: string; name: string; cityId: number; cityName?: string; placeName?: string };

const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** Quem pode ser responsável pela oportunidade nesta cidade (mesma regra do servidor). */
function owners(data: DashboardData, cityId: number) {
  const list = data.users.filter((u) => u.active && ["Administrador", "Coordenação", "Líder", "Comercial"].includes(u.role) && (u.cityId === cityId || (u.cityId === null && ["Administrador", "Comercial"].includes(u.role))));
  const self = data.access.email.toLowerCase();
  if (!list.some((u) => u.email.toLowerCase() === self)) list.unshift({ ...(list[0] ?? {}), id: 0, email: self, name: data.access.name, role: data.access.role } as (typeof list)[number]);
  return list;
}

/**
 * Pessoa do mapa → lead e oportunidade de uma vez. Nome, cidade e local vêm do
 * mapa; aqui só entram o contato, a autorização e o primeiro retorno.
 */
export function StartAttendanceDialog({ person, data, onClose, onStarted }: { person: AttendancePerson | null; data: DashboardData; onClose: () => void; onStarted: (leadId: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; leadId?: number | null } | null>(null);
  const canChooseOwner = data.access.role !== "Comercial" && data.users.length > 0;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!person) return;
    const f = new FormData(event.currentTarget);
    setBusy(true); setError(null);
    try {
      const response = await tenantFetch("/api/journey", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", data: {
        personId: person.id, whatsapp: f.get("whatsapp"), email: f.get("email"), channel: f.get("channel"),
        consentAccepted: f.get("consent") === "on", consentSource: f.get("consentSource"), consentPurpose: f.get("consentPurpose"),
        ownerEmail: f.get("ownerEmail") || data.access.email, temperature: f.get("temperature"), nextAction: f.get("nextAction"), dueDate: f.get("dueDate"),
      } }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError({ message: result.error || "Não foi possível iniciar o atendimento.", leadId: result.leadId }); return; }
      toast.success(`Atendimento de ${person.name.split(" ")[0]} iniciado. O primeiro retorno já está na agenda.`);
      onStarted(Number(result.result.leadId));
    } catch { setError({ message: "Sem conexão. Tente de novo." }); }
    finally { setBusy(false); }
  }
  return <Dialog open={person !== null} onOpenChange={(value) => { if (!value && !busy) { setError(null); onClose(); } }}><DialogContent className="max-h-[92dvh] overflow-y-auto border-white/10 bg-surface-raised text-white sm:max-w-xl">
    <DialogHeader><DialogTitle>Iniciar atendimento</DialogTitle><DialogDescription className="text-zinc-400">A pessoa do mapa vira lead e oportunidade de uma vez, já com o primeiro retorno na agenda.</DialogDescription></DialogHeader>
    {person && <form onSubmit={submit} className="grid gap-3 text-sm">
      <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5"><p className="font-medium text-white">{person.name}</p><p className="text-xs text-subtle">{[person.cityName, person.placeName].filter(Boolean).join(" · ") || "Pessoa do mapa"}</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">WhatsApp<input name="whatsapp" inputMode="tel" maxLength={30} placeholder="(31) 9 9999-9999" className="commercial-input" /></label>
        <label className="grid gap-1">E-mail<input name="email" type="email" maxLength={254} placeholder="opcional se tiver WhatsApp" className="commercial-input" /></label>
        <label className="grid gap-1">Como chegou<select name="channel" defaultValue="Orgânico" className="commercial-input">{LEAD_CHANNELS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="grid gap-1">Temperatura<select name="temperature" defaultValue="Morno" className="commercial-input">{TEMPERATURES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="grid gap-1 sm:col-span-2">Próximo passo<input name="nextAction" required minLength={3} maxLength={500} defaultValue="Primeiro contato pelo WhatsApp" className="commercial-input" /></label>
        <label className="grid gap-1">Quando<input name="dueDate" type="date" required defaultValue={today()} className="commercial-input" /></label>
        <label className="grid gap-1">Responsável{canChooseOwner ? <select name="ownerEmail" defaultValue={data.access.email.toLowerCase()} className="commercial-input">{owners(data, person.cityId).map((u) => <option key={u.email} value={u.email.toLowerCase()}>{u.name || u.email}{u.title ? ` · ${u.title}` : ""}</option>)}</select> : <input readOnly value={data.access.name || data.access.email} className="commercial-input opacity-80" />}</label>
        <label className="grid gap-1">Onde autorizou<input name="consentSource" required minLength={3} maxLength={200} defaultValue="Conversa presencial no mapeamento" className="commercial-input" /></label>
        <label className="grid gap-1">Para quê<input name="consentPurpose" required minLength={3} maxLength={200} defaultValue={`Contato comercial da ${data.access.organizationName}`} className="commercial-input" /></label>
      </div>
      <label className="flex items-start gap-2 text-zinc-300"><input name="consent" type="checkbox" required className="mt-1" />A pessoa autorizou receber contato da {data.access.organizationName} por esse WhatsApp ou e-mail.</label>
      {error && <div role="alert" className="grid gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-red-200"><p>{error.message}</p>{error.leadId ? <Button type="button" size="sm" variant="outline" className="w-fit border-white/10 bg-white/5 text-white" onClick={() => onStarted(error.leadId!)}>Abrir acompanhamento</Button> : null}</div>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy} className="bg-gold text-black">{busy ? <LoaderCircle className="animate-spin" /> : <HandCoins />} Iniciar atendimento</Button></div>
    </form>}
  </DialogContent></Dialog>;
}
