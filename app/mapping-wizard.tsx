"use client";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CloudOff, LoaderCircle, MapPin, Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { enqueue, useOfflineQueue, useOnline } from "@/app/offline-sync";
import { StartAttendanceDialog, type AttendancePerson } from "@/app/start-attendance";
import type { DashboardData } from "@/lib/expansion-types";
import { defaultOwnerEmail } from "@/lib/owners";
import { nameKey, PERSON_ROLES, PLACE_LINKS, PLACE_TYPES, SECTORS } from "@/lib/places";
import { offlineError, type SendError } from "@/lib/offline-queue";
import { tenantFetch } from "@/lib/tenant-request";

/** `queued`: feito sem internet, guardado no aparelho até o envio (app/offline-sync.tsx). */
type Place = { id: string; name: string; placeType: string; queued?: boolean };
type Added = { id: string; name: string; link: string; role: string; attending?: boolean; queued?: boolean };
type Found = { name: string; latitude: number; longitude: number };

async function post(url: string, body: unknown) {
  if (!navigator.onLine) throw offlineError();
  const response = await tenantFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => { throw offlineError(); });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) throw Object.assign(new Error(result.error || "Não foi possível salvar. Confira a conexão e tente de novo."), { duplicate: Boolean(result.duplicate) });
  return result;
}

const STEPS = ["Cidade", "Local", "Pessoas"];

/**
 * Mapeamento guiado em 3 passos: cidade → local (escolhe ou cadastra e marca no mapa)
 * → pessoas ligadas ao local. Cada passo usa o que foi escolhido no anterior.
 */
export function MappingWizard({ open, data, onClose, onSaved }: { open: boolean; data: DashboardData; onClose: () => void; onSaved: () => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [cityId, setCityId] = useState<number | null>(data.cities.length === 1 ? data.cities[0].id : null);
  const [created, setCreated] = useState<(Place & { cityId: number })[]>([]);
  const [place, setPlace] = useState<Place | null>(null);
  const [mode, setMode] = useState<"existing" | "new" | "none">("existing");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locate, setLocate] = useState<{ place: Place; query: string; results: Found[] } | null>(null);
  const [added, setAdded] = useState<Added[]>([]);
  const [duplicate, setDuplicate] = useState<{ message: string; payload: Record<string, unknown>; role: string } | null>(null);
  const [form, setForm] = useState({ placeType: "Empresa", name: "", sector: "", segment: "", district: "", address: "", confirm: false });
  const [personForm, setPersonForm] = useState({ name: "", link: "", role: "" });
  const [authorized, setAuthorized] = useState(false);
  const [attend, setAttend] = useState<AttendancePerson | null>(null);
  const online = useOnline();
  const queue = useOfflineQueue();

  const city = data.cities.find((item) => item.id === cityId);
  // Locais guardados sem internet também aparecem para ligar pessoas a eles.
  const queuedPlaces = useMemo(() => queue.filter((item) => item.kind === "place" && item.organizationId === data.access.organizationId && item.email.toLowerCase() === data.access.email.toLowerCase())
    .map((item) => ({ id: item.id, name: item.label, placeType: item.kind === "place" ? item.placeType : "", cityId: item.cityId, queued: true })), [queue, data.access.organizationId, data.access.email]);
  const places = useMemo(() => {
    const known = [...(data.places ?? []), ...created.filter((item) => !data.places?.some((p) => p.id === item.id))];
    const all = [...known, ...queuedPlaces.filter((item) => !known.some((p) => p.id === item.id))];
    const key = nameKey(filter);
    return all.filter((item) => item.cityId === cityId && (!key || nameKey(item.name).includes(key))).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [data.places, created, queuedPlaces, cityId, filter]);
  const base = () => ({ organizationId: data.access.organizationId, email: data.access.email, createdAt: new Date().toISOString(), status: "pendente" as const });
  const noSignal = "Sem internet: a busca de endereço precisa de sinal. Use \u201cDeixar pendente e seguir\u201d e marque no mapa depois.";

  function reset() {
    setStep(0); setPlace(null); setMode("existing"); setFilter(""); setError(""); setLocate(null); setAdded([]); setDuplicate(null);
    setForm({ placeType: "Empresa", name: "", sector: "", segment: "", district: "", address: "", confirm: false }); setPersonForm({ name: "", link: "", role: "" });
  }
  async function close() {
    if (busy) return;
    const changed = added.length > 0 || created.length > 0;
    reset(); setCreated([]); onClose();
    // Sem sinal, o painel se atualiza quando os cadastros guardados forem enviados.
    if (changed && navigator.onLine) await onSaved().catch(() => toast.info("Cadastros salvos. Atualize o painel para rever os indicadores."));
  }

  async function savePlace() {
    if (!cityId) return;
    setBusy(true); setError("");
    const id = crypto.randomUUID();
    const segment = form.segment.trim() || form.sector || form.placeType;
    const body = { id, cityId, name: form.name.trim(), segment, district: form.district.trim(), address: form.address.trim(), source: "Mapeamento guiado", externalId: "", ownerEmail: defaultOwnerEmail(data, cityId), status: "Identificada", placeType: form.placeType, sector: form.placeType === "Empresa" ? form.sector : form.sector || "", nextAction: "", verified: false, publicBusiness: form.confirm };
    const saved = { id, name: form.name.trim(), placeType: form.placeType, cityId };
    try {
      await post("/api/commercial", { action: "business", data: body });
      setCreated((list) => [...list, saved]); setPlace(saved);
      toast.success("Local cadastrado. Agora marque o ponto no mapa.");
      setLocate({ place: saved, query: [form.address, form.district].filter(Boolean).join(", ") || form.name, results: [] });
    } catch (e) {
      if ((e as SendError).offline) {
        // Sem sinal não há busca de endereço: o local fica pendente de marcar no mapa.
        try { enqueue({ ...base(), kind: "place", id, cityId, label: saved.name, placeType: form.placeType, data: body }); }
        catch (stored) { setError(stored instanceof Error ? stored.message : "Não foi possível guardar neste aparelho."); return; }
        setPlace({ ...saved, queued: true }); setStep(2);
        toast.info("Sem internet: local guardado neste aparelho e enviado quando o sinal voltar. Marque o ponto no mapa depois.");
      } else setError(e instanceof Error ? e.message : "Não foi possível cadastrar o local.");
    }
    finally { setBusy(false); }
  }
  async function search() {
    if (!locate || !cityId) return;
    setBusy(true); setError("");
    try {
      const result = await post("/api/territory/geocode", { query: locate.query, cityId, kind: "business" });
      setLocate({ ...locate, results: result.results ?? [] });
      if (!result.results?.length) setError("Nenhum endereço encontrado. Ajuste a busca ou deixe o local pendente para validar depois no mapa.");
    } catch (e) { setError((e as SendError).offline ? noSignal : e instanceof Error ? e.message : "Busca indisponível."); }
    finally { setBusy(false); }
  }
  async function pin(found: Found) {
    if (!locate) return;
    setBusy(true); setError("");
    try {
      await post("/api/territory", { action: "location", data: { key: `business:${locate.place.id}`, latitude: found.latitude, longitude: found.longitude, region: form.district.trim(), precision: "Local comercial", source: "Busca de endereço conferida no mapeamento", validated: true, authorized: true, visibility: "Equipe" } });
      toast.success("Local marcado no mapa."); setLocate(null); setStep(2);
    } catch (e) { setError((e as SendError).offline ? noSignal : e instanceof Error ? e.message : "Não foi possível marcar o local."); }
    finally { setBusy(false); }
  }

  async function savePerson(confirmDuplicate = false, retry?: { payload: Record<string, unknown>; role: string }) {
    if (!cityId) return;
    const payload = retry?.payload ?? { requestId: crypto.randomUUID(), cityId, name: personForm.name.trim(), leader: false, referrerId: null, placeId: place?.id ?? null, placeLink: place ? personForm.link : "", authorized: true };
    const role = retry?.role ?? personForm.role;
    setBusy(true); setError(""); setDuplicate(null);
    const keep = () => {
      enqueue({ ...base(), kind: "person", id: String(payload.requestId), cityId, label: String(payload.name), placeId: place?.id ?? null, data: payload, role, responsible: data.access.name || data.access.email, confirmDuplicate });
      setAdded((list) => [...list, { id: String(payload.requestId), name: String(payload.name), link: String(payload.placeLink || ""), role, queued: true }]);
      setPersonForm({ name: "", link: personForm.link, role: personForm.role });
    };
    try {
      // Local ainda guardado no aparelho: a pessoa vai junto, depois dele.
      if (place?.queued) { keep(); return; }
      const result = await post("/api/territory", { action: "person", data: { ...payload, confirmDuplicate } });
      const id = String(result.result?.id ?? "");
      if (role && id) await post("/api/territory", { action: "role", data: { personId: id, role, status: "Ativo", responsible: data.access.name || data.access.email, source: "Mapeamento guiado", authorized: true } });
      setAdded((list) => [...list, { id, name: String(payload.name), link: String(payload.placeLink || ""), role }]);
      setPersonForm({ name: "", link: personForm.link, role: personForm.role });
    } catch (e) {
      const err = e as SendError;
      if (err.offline) { try { keep(); } catch (stored) { setError(stored instanceof Error ? stored.message : "Não foi possível guardar neste aparelho."); } }
      else if (err.duplicate) setDuplicate({ message: err.message, payload, role });
      else setError(err.message || "Não foi possível cadastrar a pessoa.");
    } finally { setBusy(false); }
  }

  const placeReady = form.name.trim().length >= 2 && form.confirm && (form.placeType !== "Empresa" || form.sector);
  const personReady = authorized && personForm.name.trim().length >= 2 && (!place || personForm.link);

  return <Dialog open={open} onOpenChange={(value) => { if (!value) close(); }}><DialogContent className="max-h-[92dvh] overflow-y-auto border-white/10 bg-surface-raised text-white sm:max-w-2xl">
    <DialogHeader><DialogTitle>Mapear local e pessoas</DialogTitle><DialogDescription className="text-zinc-400">Siga os 3 passos. Pessoas aparecem no local ligado a elas, nunca na residência.</DialogDescription></DialogHeader>
    <ol className="grid grid-cols-3 gap-2" aria-label="Passos do mapeamento">{STEPS.map((label, index) => <li key={label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${index === step ? "border-gold/60 bg-gold/10 text-white" : index < step ? "border-emerald-400/20 text-emerald-200" : "border-white/8 text-subtle"}`} aria-current={index === step ? "step" : undefined}><span className={`grid size-5 place-items-center rounded-full text-[11px] font-semibold ${index < step ? "bg-emerald-400/20" : index === step ? "bg-gold text-black" : "bg-white/8"}`}>{index < step ? <Check className="size-3" /> : index + 1}</span>{label}</li>)}</ol>
    {!online && <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm text-amber-50"><CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />Sem internet: pode seguir. Locais e pessoas ficam guardados neste aparelho e são enviados quando o sinal voltar.</p>}
    {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}

    {step === 0 && <div className="grid gap-3">
      <label className="grid gap-1 text-sm">Em qual cidade você está mapeando?<select className="commercial-input" value={cityId ?? ""} onChange={(e) => { setCityId(e.target.value ? Number(e.target.value) : null); setPlace(null); }}><option value="">Selecione a cidade</option>{data.cities.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.state}</option>)}</select></label>
      {!data.cities.length && <p className="text-sm text-amber-200">Nenhuma cidade disponível para você. Peça ao administrador para cadastrar a cidade.</p>}
      <div className="flex justify-end"><Button disabled={!cityId} onClick={() => setStep(1)} className="bg-gold text-black">Próximo: local <ArrowRight /></Button></div>
    </div>}

    {step === 1 && !locate && <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2 text-sm" role="radiogroup" aria-label="Como escolher o local">{([["existing", "Local já cadastrado"], ["new", "Cadastrar novo local"], ["none", "Sem local"]] as const).map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => { setMode(value); setError(""); }} className={`rounded-lg border px-3 py-2 ${mode === value ? "border-gold/60 bg-gold/10 text-white" : "border-white/10 text-zinc-400"}`}>{label}</button>)}</div>
      {mode === "existing" && <>
        <label className="relative"><Search className="absolute left-3 top-3.5 size-4 text-subtle" /><input aria-label="Procurar local" className="commercial-input pl-9" placeholder={`Procurar local em ${city?.name ?? "na cidade"}`} value={filter} onChange={(e) => setFilter(e.target.value)} /></label>
        <ul className="grid max-h-64 gap-1 overflow-y-auto" aria-label="Locais da cidade">{places.map((item) => <li key={item.id}><button type="button" onClick={() => setPlace(item)} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${place?.id === item.id ? "border-gold/60 bg-gold/10" : "border-white/8 hover:bg-white/5"}`}><span>{item.name}</span><span className="text-xs text-subtle">{"queued" in item && item.queued ? "Aguardando envio · " : ""}{item.placeType}</span></button></li>)}</ul>
        {!places.length && <p className="text-sm text-zinc-400">{filter ? "Nenhum local com esse nome." : "Nenhum local nesta cidade ainda."} Use &ldquo;Cadastrar novo local&rdquo;.</p>}
        <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft /> Cidade</Button><Button disabled={!place} onClick={() => setStep(2)} className="bg-gold text-black">Próximo: pessoas <ArrowRight /></Button></div>
      </>}
      {mode === "new" && <>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">Tipo de local<select className="commercial-input" value={form.placeType} onChange={(e) => setForm({ ...form, placeType: e.target.value })}>{PLACE_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="grid gap-1 text-sm">{form.placeType === "Empresa" ? "Setor (define o ícone)" : "Setor (opcional)"}<select className="commercial-input" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}><option value="">Selecione</option>{SECTORS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="grid gap-1 text-sm sm:col-span-2">Nome {form.placeType === "Empresa" ? "da empresa" : "do local"}<input className="commercial-input" value={form.name} maxLength={200} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Padaria Pão Dourado" /></label>
          <label className="grid gap-1 text-sm">Atividade (opcional)<input className="commercial-input" value={form.segment} maxLength={80} onChange={(e) => setForm({ ...form, segment: e.target.value })} placeholder="Ex.: padaria e café" /></label>
          <label className="grid gap-1 text-sm">Bairro<input className="commercial-input" value={form.district} maxLength={200} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label>
          <label className="grid gap-1 text-sm sm:col-span-2">Endereço comercial<input className="commercial-input" value={form.address} maxLength={400} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número" /></label>
        </div>
        <label className="flex items-start gap-2 text-sm text-zinc-300"><input type="checkbox" className="mt-1" checked={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.checked })} />São dados públicos de um estabelecimento ou local (nunca endereço de residência).</label>
        <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft /> Cidade</Button><Button disabled={busy || !placeReady} onClick={savePlace} className="bg-gold text-black">{busy ? <LoaderCircle className="animate-spin" /> : <Plus />} Cadastrar local</Button></div>
      </>}
      {mode === "none" && <>
        <p className="rounded-lg border border-white/8 bg-white/[0.03] p-3 text-sm text-zinc-300">As pessoas ficam no centro de {city?.name ?? "da cidade"}. Você pode ligá-las a um local depois, pelo mapa.</p>
        <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft /> Cidade</Button><Button onClick={() => { setPlace(null); setStep(2); }} className="bg-gold text-black">Próximo: pessoas <ArrowRight /></Button></div>
      </>}
    </div>}

    {step === 1 && locate && <div className="grid gap-3">
      <p className="text-sm text-zinc-300"><MapPin className="mr-1 inline size-4 text-gold-soft" />Marque <strong>{locate.place.name}</strong> no mapa: busque o endereço e escolha o resultado certo.</p>
      <div className="flex gap-2"><input aria-label="Endereço para buscar" className="commercial-input" value={locate.query} onChange={(e) => setLocate({ ...locate, query: e.target.value })} /><Button variant="outline" disabled={busy || locate.query.trim().length < 3} onClick={search} className="border-white/10 bg-white/5 text-white">{busy ? <LoaderCircle className="animate-spin" /> : <Search />} Buscar</Button></div>
      <ul className="grid gap-1">{locate.results.map((item, index) => <li key={index}><button type="button" disabled={busy} onClick={() => pin(item)} className="w-full rounded-lg border border-white/8 px-3 py-2 text-left text-sm hover:bg-white/5">{item.name}</button></li>)}</ul>
      <div className="flex justify-between"><Button variant="ghost" onClick={() => { setLocate(null); setStep(2); }}>Deixar pendente e seguir</Button><span className="self-center text-xs text-subtle">Pendente: valide depois em Mapa → local → Validar localização.</span></div>
    </div>}

    {step === 2 && <div className="grid gap-3">
      <p className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300">{city?.name} · {place ? <>ligadas a <strong className="text-white">{place.name}</strong></> : "sem local (centro da cidade)"}</p>
      <label className="flex items-start gap-2 text-sm text-zinc-300"><input type="checkbox" className="mt-1" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />Confirmo que posso registrar estas pessoas só com nome, cidade e vínculo (sem dados de residência).</label>
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
        <label className="grid gap-1 text-sm">Nome<input className="commercial-input" value={personForm.name} maxLength={200} onChange={(e) => setPersonForm({ ...personForm, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && personReady && !busy) { e.preventDefault(); savePerson(); } }} /></label>
        <label className="grid gap-1 text-sm">Vínculo{!place && " (sem local)"}<select className="commercial-input" disabled={!place} value={personForm.link} onChange={(e) => setPersonForm({ ...personForm, link: e.target.value })}><option value="">Selecione</option>{PLACE_LINKS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="grid gap-1 text-sm">Papel (opcional)<select className="commercial-input" value={personForm.role} onChange={(e) => setPersonForm({ ...personForm, role: e.target.value })}><option value="">Nenhum</option>{PERSON_ROLES.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      {duplicate && <div role="alert" className="grid gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100"><p>{duplicate.message}</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white" disabled={busy} onClick={() => savePerson(true, duplicate)}>É outra pessoa: salvar mesmo assim</Button><Button size="sm" variant="ghost" onClick={() => setDuplicate(null)}>Não salvar</Button></div></div>}
      <div className="flex justify-end"><Button disabled={busy || !personReady} onClick={() => savePerson()} className="bg-gold text-black">{busy ? <LoaderCircle className="animate-spin" /> : <UserPlus />} Adicionar pessoa</Button></div>
      {added.length > 0 && <ul className="grid gap-1 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm" aria-label="Pessoas cadastradas agora">{added.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-2">{item.queued ? <CloudOff className="size-4 text-amber-200" aria-label="Guardado no aparelho" /> : <Check className="size-4 text-emerald-300" />}{item.name}<span className="text-xs text-zinc-400">{[item.link, item.role].filter(Boolean).join(" · ")}</span>{item.queued ? <span className="ml-auto text-xs text-amber-200">Aguardando envio</span> : data.access.canManagePipeline && (item.attending ? <span className="ml-auto text-xs text-emerald-300">Em atendimento</span> : <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs text-gold-soft" onClick={() => setAttend({ id: item.id, name: item.name, cityId: cityId!, cityName: city?.name, placeName: place?.name })}>Iniciar atendimento</Button>)}</li>)}</ul>}
      <div className="flex flex-wrap justify-between gap-2 border-t border-white/8 pt-3"><Button variant="ghost" onClick={() => { setStep(1); setPlace(null); setMode("existing"); setAdded([]); }}><MapPin /> Mapear outro local</Button><Button onClick={close} className="bg-gold text-black">Concluir</Button></div>
    </div>}
    <StartAttendanceDialog person={attend} data={data} onClose={() => setAttend(null)} onStarted={() => { const id = attend?.id; setAttend(null); setAdded((list) => list.map((item) => item.id === id ? { ...item, attending: true } : item)); }} />
  </DialogContent></Dialog>;
}
