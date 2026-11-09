"use client";
/**
 * "+ Novo → Registrar visita" (simplificação, parte 4): escolhe o local e abre a mesma janela de visita da
 * ficha do local. Só locais já cadastrados na cidade; nunca residência nem horário da pessoa.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VisitDialog, type PlantPlace } from "@/app/plant-dialogs";
import type { DashboardData } from "@/lib/expansion-types";

export function VisitShortcut({ data, onClose, onSaved, onMapPeople }: { data: DashboardData; onClose: () => void; onSaved: () => void; onMapPeople: (businessId: string) => void }) {
  const cities = data.cities;
  const [cityId, setCityId] = useState(String(cities[0]?.id ?? ""));
  const [placeId, setPlaceId] = useState("");
  const [place, setPlace] = useState<PlantPlace | null>(null);
  const places = (data.places ?? []).filter((item) => String(item.cityId) === cityId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  if (place) return <VisitDialog place={place} onClose={onClose} onSaved={onSaved} onMapPeople={onMapPeople} />;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="bg-zinc-950 text-white">
      <DialogHeader><DialogTitle>Registrar visita</DialogTitle><DialogDescription>Escolha o local visitado. Local novo? Use “Mapear local e pessoas”.</DialogDescription></DialogHeader>
      <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); const found = places.find((item) => item.id === placeId); if (found) setPlace({ businessId: found.id, name: found.name, type: found.placeType, sector: found.sector ?? "" }); }}>
        {cities.length > 1 && <label className="grid gap-1 text-sm">Cidade<select className="commercial-input" value={cityId} onChange={(event) => { setCityId(event.target.value); setPlaceId(""); }}>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>}
        <label className="grid gap-1 text-sm">Local<select className="commercial-input" required value={placeId} onChange={(event) => setPlaceId(event.target.value)}><option value="">Selecione</option>{places.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {!places.length && <p className="text-sm text-zinc-400">Nenhum local cadastrado nesta cidade ainda.</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={!placeId} className="bg-gold text-black">Continuar</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
