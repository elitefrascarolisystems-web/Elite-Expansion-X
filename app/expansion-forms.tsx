"use client";

import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { TerritoryPersonPicker } from '@/app/territory-person-picker';
import { RegionSelect } from '@/app/region-select';
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionName } from "@/lib/expansion-permissions";
import { defaultOwnerEmail, eligibleOwners } from "@/lib/owners";
import { OLD_SALE_STATUSES, SALE_STEPS, saleStatusLabel } from "@/lib/commercial";
import type { AmbassadorRecord, CityRecord, DashboardData } from "@/lib/expansion-types";

export type DialogName =
  | "city"
  | "city-edit"
  | "city-result"
  | "ambassador"
  | "ambassador-edit"
  | "ambassador-activity"
  | "lead"
  | "lead-status"
  | "sale"
  | "cost"
  | "partner"
  | "event"
  | "content"
  | "task"
  | "settings"
  | "user";

export type DialogState = { name: DialogName; entityId?: number } | null;

type Save = (action: ActionName, payload: Record<string, unknown>) => void;

const monthNow = new Date().toISOString().slice(0, 7);
const dateNow = new Date().toISOString().slice(0, 10);
const selectClass = "w-full border-white/12 bg-white/5";
const inputClass = "border-white/12 bg-white/5";
const cents = (value: FormDataEntryValue | null) => Math.round(Number(value || 0) * 100);

function Field({ label, hint, children, wide = false }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`grid gap-2 text-sm font-medium text-zinc-200 ${wide ? "sm:col-span-2" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <span className="text-xs font-normal leading-5 text-subtle">{hint}</span>}
    </label>
  );
}

function FormShell({
  title,
  description,
  saving,
  children,
  onSubmit,
}: {
  title: string;
  description: string;
  saving: boolean;
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="leading-6 text-zinc-400">{description}</DialogDescription>
      </DialogHeader>
      <div className="my-6 grid gap-4 sm:grid-cols-2">{children}</div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="outline" className="border-white/12 bg-transparent text-white">Cancelar</Button></DialogClose>
        <Button type="submit" disabled={saving} aria-busy={saving} className="bg-gold text-black hover:bg-gold-hover">
          {saving && <LoaderCircle className="animate-spin" />}{saving ? "Salvando" : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CityFields({ city, saving, onSave, mode }: { city?: CityRecord; saving: boolean; onSave: Save; mode: "create" | "edit" }) {
  const [phase] = useState(city?.phase ?? "Ativa");
  const [status, setStatus] = useState(city?.status ?? "Planejada");
  const [trackingMode, setTrackingMode] = useState(city?.trackingMode ?? "Detalhado");
  return (
    <FormShell
      title={mode === "create" ? "Cadastrar cidade" : `Configurar ${city?.name}`}
      description="Metas e limites ficam visíveis. O modo detalhado usa cada atendimento, pagamento e custo; o consolidado usa fechamentos por período."
      saving={saving}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave(mode === "create" ? "create_city" : "update_city", {
          ...(city ? { cityId: city.id } : {}),
          name: form.get("name"),
          state: form.get("state"),
          phase,
          leaderName: form.get("leaderName"),
          targetCacCents: cents(form.get("targetCac")),
          ambassadorGoal: Number(form.get("ambassadorGoal") || 1),
          // "Meta de vendas" saiu do cadastro (a meta fica em Resultados → Calculadora); a coluna antiga só é mantida.
          salesGoal: city?.salesGoal ?? 100,
          status,
          budgetCents: cents(form.get("budget")),
          trackingMode,
          notes: form.get("notes"),
        });
      }}
    >
      {mode === "create" && <><Field label="Cidade"><Input name="name" required placeholder="Ex.: Sete Lagoas" className={inputClass} /></Field><Field label="Estado"><Input name="state" required defaultValue="MG" maxLength={2} className={inputClass} /></Field></>}
      <Field label="Líder local"><Input name="leaderName" defaultValue={city?.leaderName} placeholder="Nome do responsável" className={inputClass} /></Field>
      
      <Field label="Situação"><Select value={status} onValueChange={setStatus}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Planejada", "Ativa", "Pausada"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Fonte dos indicadores" hint="Não misture lançamentos consolidados e detalhados no mesmo período."><Select value={trackingMode} onValueChange={setTrackingMode}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Detalhado">Detalhado — atendimento a atendimento</SelectItem><SelectItem value="Consolidado">Consolidado — fechamento</SelectItem></SelectContent></Select></Field>
      <Field label="CAC máximo (R$)" hint="Custo máximo por cliente pago."><Input name="targetCac" type="number" min="0" step="0.01" defaultValue={(city?.targetCacCents ?? 0) / 100} className={inputClass} /></Field>
      <Field label="Orçamento da cidade (R$)"><Input name="budget" type="number" min="0" step="0.01" defaultValue={(city?.budgetCents ?? 0) / 100} className={inputClass} /></Field>
      <Field label="Meta de embaixadores"><Input name="ambassadorGoal" type="number" min="1" defaultValue={city?.ambassadorGoal ?? 10} className={inputClass} /></Field>
      <p className="self-end pb-2 text-xs text-subtle">A meta fica em Resultados → Calculadora.</p>
      <Field label="Observações" wide><Textarea name="notes" defaultValue={city?.notes} placeholder="Capacidade, restrições e próximos passos" className={inputClass} /></Field>
    </FormShell>
  );
}

function AmbassadorFields({ data, ambassador, saving, onSave, mode }: { data: DashboardData; ambassador?: AmbassadorRecord; saving: boolean; onSave: Save; mode: "create" | "edit" }) {
  const [cityId, setCityId] = useState(String(ambassador?.cityId ?? data.cities[0]?.id ?? ""));
  const [level, setLevel] = useState(ambassador?.level ?? "Indicador");
  const [status, setStatus] = useState(ambassador?.status ?? "Convidado");
  const [onboarding, setOnboarding] = useState(ambassador?.onboardingStatus ?? "Pendente");
  const [whatsappAuthorized, setWhatsappAuthorized] = useState(Boolean(ambassador?.whatsappAuthorizedAt));
  return (
    <FormShell
      title={mode === "create" ? "Cadastrar embaixador" : `Acompanhar ${ambassador?.name}`}
      description={mode === "create" ? "O cadastro não torna a pessoa ativa. Ativação exige treinamento, regras aceitas e atividade real." : "Atualize a etapa sem registrar aceite das regras em nome da pessoa."}
      saving={saving}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (mode === "create") {
          onSave("create_ambassador", { cityId: Number(cityId), personId: form.get("personId") || undefined, name: form.get("name"), code: form.get("code"), email: form.get("email"), whatsapp: form.get("whatsapp"), whatsappAuthorized, level, status });
        } else {
          onSave("update_ambassador", { ambassadorId: ambassador?.id, level, status, onboardingStatus: onboarding, trainingProgress: Number(form.get("trainingProgress") || 0), whatsappAuthorized, pauseReason: form.get("pauseReason") });
        }
      }}
    >
      {mode === "create" ? <>
        <Field label="Cidade"><Select value={cityId} onValueChange={setCityId}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{data.cities.map((city) => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}</SelectContent></Select></Field>
        <PersonPicker data={data} cityId={Number(cityId)} taken="ambassador" /><Field label="Nome"><Input name="name" required className={inputClass} /></Field>
        <Field label="Código único" hint="Sem espaços: letras, números, hífen ou sublinhado (ex.: EMB001)."><Input name="code" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_\-]+" title="Sem espaços: letras, números, hífen ou sublinhado." placeholder="EMB001" className={`${inputClass} uppercase`} /></Field>
        <Field label="E-mail do perfil"><Input name="email" type="email" placeholder="Opcional" className={inputClass} /></Field>
        <Field label="WhatsApp"><Input name="whatsapp" inputMode="tel" maxLength={30} placeholder="(31) 99999-9999" className={inputClass} /></Field>
        <div className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-4"><Checkbox id="ambassador-whatsapp" checked={whatsappAuthorized} onCheckedChange={(value) => setWhatsappAuthorized(value === true)} /><label htmlFor="ambassador-whatsapp" className="text-sm leading-6 text-zinc-300">Confirmo que esta pessoa autorizou o contato por WhatsApp. Sem esta confirmação, o número não será salvo.</label></div>
      </> : <>
        <Field label="Treinamento concluído (%)"><Input name="trainingProgress" type="number" min="0" max="100" defaultValue={ambassador?.trainingProgress ?? 0} className={inputClass} /></Field>
        <Field label="Onboarding"><Select value={onboarding} onValueChange={setOnboarding}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Pendente", "Em andamento", "Concluído"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
        <div className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-4"><Checkbox id="ambassador-whatsapp-edit" checked={whatsappAuthorized} onCheckedChange={(value) => setWhatsappAuthorized(value === true)} /><label htmlFor="ambassador-whatsapp-edit" className="text-sm leading-6 text-zinc-300">WhatsApp autorizado {ambassador?.whatsappAuthorizedAt ? `desde ${ambassador.whatsappAuthorizedAt.slice(0, 10).split("-").reverse().join("/")}` : "— autorização pendente"}. Desmarque para registrar a revogação.</label></div>
        <Field label="Motivo de pausa" wide><Input name="pauseReason" defaultValue={ambassador?.pauseReason} placeholder="Preencha somente quando necessário" className={inputClass} /></Field>
      </>}
      <Field label="Nível"><Select value={level} onValueChange={setLevel}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Indicador", "Embaixador ativo", "Referência", "Líder local"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Situação"><Select value={status} onValueChange={setStatus}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Convidado", "Em análise", "Aprovado", "Em treinamento", "Ativo", "Inativo", "Pausado", "Desligado"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
    </FormShell>
  );
}

function CityResultForm({ data, saving, onSave }: { data: DashboardData; saving: boolean; onSave: Save }) {
  const consolidated = data.cities.filter((city) => city.trackingMode === "Consolidado");
  const [cityId, setCityId] = useState(String(consolidated[0]?.id ?? ""));
  const [phase] = useState("Ativa");
  const [status, setStatus] = useState("Ativa");
  if (!consolidated.length) return <DialogHeader><DialogTitle>Sem cidades no modo consolidado</DialogTitle><DialogDescription>Use Atendimentos, Vendas e Custos nas cidades configuradas como detalhadas.</DialogDescription></DialogHeader>;
  return <FormShell title="Fechamento consolidado" description="Informe somente pagamentos confirmados. Esse modo não permite rastrear cada origem." saving={saving} onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave("record_city", { cityId: Number(cityId), period: f.get("period"), reach: Number(f.get("reach") || 0), leads: Number(f.get("leads") || 0), organicLeads: Number(f.get("organicLeads") || 0), sales: Number(f.get("sales") || 0), revenueCents: cents(f.get("revenue")), costCents: cents(f.get("cost")), mediaCostCents: cents(f.get("mediaCost")), refunds: Number(f.get("refunds") || 0), satisfaction: Number(f.get("satisfaction") || 0), partners: Number(f.get("partners") || 0), events: Number(f.get("events") || 0), note: f.get("note"), phase, status }); }}>
    <Field label="Cidade"><Select value={cityId} onValueChange={setCityId}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{consolidated.map((city) => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Período"><Input name="period" type="month" defaultValue={monthNow} required className={inputClass} /></Field>
    <Field label="Alcance"><Input name="reach" type="number" min="0" defaultValue="0" className={inputClass} /></Field><Field label="Atendimentos"><Input name="leads" type="number" min="0" defaultValue="0" className={inputClass} /></Field>
    <Field label="Atendimentos sem mídia paga"><Input name="organicLeads" type="number" min="0" defaultValue="0" className={inputClass} /></Field><Field label="Pagamentos confirmados"><Input name="sales" type="number" min="0" defaultValue="0" className={inputClass} /></Field>
    <Field label="Receita confirmada (R$)"><Input name="revenue" type="number" min="0" step="0.01" defaultValue="0" className={inputClass} /></Field><Field label="Custo total (R$)"><Input name="cost" type="number" min="0" step="0.01" defaultValue="0" className={inputClass} /></Field>
    <Field label="Custo de mídia (R$)"><Input name="mediaCost" type="number" min="0" step="0.01" defaultValue="0" className={inputClass} /></Field><Field label="Reembolsos"><Input name="refunds" type="number" min="0" defaultValue="0" className={inputClass} /></Field>
    <Field label="Satisfação (0 a 10)"><Input name="satisfaction" type="number" min="0" max="10" defaultValue="0" className={inputClass} /></Field><Field label="Parceiros ativos"><Input name="partners" type="number" min="0" defaultValue="0" className={inputClass} /></Field>
    <Field label="Eventos realizados"><Input name="events" type="number" min="0" defaultValue="0" className={inputClass} /></Field>
    
    <Field label="Situação"><Select value={status} onValueChange={setStatus}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Planejada", "Ativa", "Pausada"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Observação" wide><Textarea name="note" className={inputClass} /></Field>
  </FormShell>;
}

function ActivityForm({ data, saving, onSave }: { data: DashboardData; saving: boolean; onSave: Save }) {
  const fixedId = data.access.role === "Embaixador" ? data.access.ambassadorId : null;
  const [ambassadorId, setAmbassadorId] = useState(String(fixedId ?? data.ambassadors[0]?.id ?? ""));
  return <FormShell title="Registrar atividade" description="Atividade real, conteúdo publicado e evento realizado ajudam a medir quem está ativo." saving={saving} onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave("record_ambassador", { ambassadorId: Number(ambassadorId), period: f.get("period"), leads: Number(f.get("leads") || 0), sales: Number(f.get("sales") || 0), actions: Number(f.get("actions") || 0), contents: Number(f.get("contents") || 0), events: Number(f.get("events") || 0), costCents: cents(f.get("cost")), note: f.get("note") }); }}>
    {data.access.role !== "Embaixador" && <Field label="Embaixador"><Select value={ambassadorId} onValueChange={setAmbassadorId}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{data.ambassadors.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name} · {item.cityName}</SelectItem>)}</SelectContent></Select></Field>}
    <Field label="Período"><Input name="period" type="month" defaultValue={monthNow} required className={inputClass} /></Field>
    <Field label="Ações realizadas"><Input name="actions" type="number" min="0" defaultValue="0" className={inputClass} /></Field><Field label="Conteúdos publicados"><Input name="contents" type="number" min="0" defaultValue="0" className={inputClass} /></Field>
    <Field label="Eventos"><Input name="events" type="number" min="0" defaultValue="0" className={inputClass} /></Field><Field label="Leads indicados"><Input name="leads" type="number" min="0" defaultValue="0" className={inputClass} /></Field>
    <Field label="Pagamentos atribuídos"><Input name="sales" type="number" min="0" defaultValue="0" className={inputClass} /></Field><Field label="Custo de apoio (R$)"><Input name="cost" type="number" min="0" step="0.01" defaultValue="0" className={inputClass} /></Field>
    <Field label="Resumo da atividade" wide><Textarea name="note" required className={inputClass} /></Field>
  </FormShell>;
}

function LeadForm({ data, saving, onSave }: { data: DashboardData; saving: boolean; onSave: Save }) {
  // Simplificação (S1): 6 campos visíveis; o resto com padrão, em "Mais detalhes". UTM e campanha saíram (T2);
  // embaixador, parceiro, evento e conteúdo só aparecem conforme o canal (T3).
  const ambassadorRole = data.access.role === "Embaixador";
  const fixedCityId = ambassadorRole ? data.access.cityId : null;
  const [cityId, setCityId] = useState(String(fixedCityId ?? data.cities[0]?.id ?? ""));
  const [ambassadorId] = useState(String(ambassadorRole ? data.access.ambassadorId ?? "none" : "none"));
  const [originId, setOriginId] = useState("none");
  const [channel, setChannel] = useState(ambassadorRole ? "Embaixador" : "Orgânico"); const [consent, setConsent] = useState(false);
  const selectedCity = Number(cityId);
  const owners = eligibleOwners(data, selectedCity);
  const [owner, setOwner] = useState(ambassadorRole ? "" : defaultOwnerEmail(data, selectedCity));
  const origins = channel === "Embaixador" ? data.ambassadors.filter((item) => item.cityId === selectedCity).map((item) => ({ id: item.id, name: item.name }))
    : channel === "Parceiro" ? data.partners.filter((item) => item.cityId === selectedCity).map((item) => ({ id: item.id, name: item.name }))
    : channel === "Evento" ? data.events.filter((item) => item.cityId === selectedCity).map((item) => ({ id: item.id, name: item.name }))
    : channel === "Conteúdo" ? data.contents.filter((item) => item.cityId === null || item.cityId === selectedCity).map((item) => ({ id: item.id, name: item.title }))
    : [];
  const originLabel: Record<string, string> = { Embaixador: "Qual embaixador", Parceiro: "Qual parceiro", Evento: "Qual evento", Conteúdo: "Qual material" };
  const picked = (kind: string) => (channel === kind && originId !== "none" ? Number(originId) : null);
  return <FormShell title="Novo atendimento" description="Para quem ainda não está no mapa e autorizou o contato. Telefone ou e-mail repetidos são bloqueados." saving={saving} onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave("create_lead", {
      referrerId: f.get("referrerId") || null, regionId: f.get("regionId") || null, cityId: Number(cityId),
      ambassadorId: ambassadorRole ? (ambassadorId === "none" ? null : Number(ambassadorId)) : picked("Embaixador"), partnerId: picked("Parceiro"), eventId: picked("Evento"), contentId: picked("Conteúdo"),
      personId: f.get("personId") || undefined, name: f.get("name"), email: f.get("email"), whatsapp: f.get("whatsapp"),
      status: ambassadorRole ? "Lead informado" : "Lead válido", channel: f.get("referrerId") && channel === "Orgânico" ? "Indicação" : channel,
      sourceLabel: f.get("sourceLabel") ?? "", campaign: "", utmSource: "", utmMedium: "", utmCampaign: "",
      consentAccepted: consent, consentSource: f.get("consentSource") || "Conversa direta com a pessoa", consentPurpose: f.get("consentPurpose") || `Atendimento comercial da ${data.access.organizationName}`, assignedToEmail: owner,
    }); }}>
    {!ambassadorRole && <Field label="Cidade"><Select value={cityId} onValueChange={(value) => { setCityId(value); setOriginId("none"); setOwner(defaultOwnerEmail(data, Number(value))); }}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{data.cities.map((city) => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}</SelectContent></Select></Field>}
    <Field label="Nome"><Input name="name" required className={inputClass} /></Field>
    <Field label="WhatsApp" hint="Informe o WhatsApp ou o e-mail (pelo menos um)."><Input name="whatsapp" inputMode="tel" maxLength={30} placeholder="(31) 99999-0000" className={inputClass} /></Field><Field label="E-mail"><Input name="email" type="email" className={inputClass} /></Field>
    <Field label="Quem indicou (opcional)" hint="Pessoa do mapa na mesma cidade. Com indicador, o canal vira Indicação."><TerritoryPersonPicker key={`ref-${cityId}`} cityId={Number(cityId)} name="referrerId" /></Field>
    {!ambassadorRole && <Field label="Como chegou"><Select value={channel} onValueChange={(value) => { setChannel(value); setOriginId("none"); }}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Orgânico", "Indicação", "Embaixador", "Parceiro", "Evento", "Conteúdo", "Mídia paga", "Outro"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>}
    {!ambassadorRole && originLabel[channel] && <Field label={`${originLabel[channel]} (opcional)`}><Select value={originId} onValueChange={setOriginId}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Não informar</SelectItem>{origins.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></Field>}
    {!ambassadorRole && <Field label="Responsável"><Select value={owner} onValueChange={setOwner}><SelectTrigger className={selectClass}><SelectValue placeholder="Escolha quem atende" /></SelectTrigger><SelectContent>{owners.map((u) => <SelectItem key={u.email} value={u.email.toLowerCase()}>{u.name}</SelectItem>)}</SelectContent></Select></Field>}
    {ambassadorRole && <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4 text-sm leading-6 text-zinc-400 sm:col-span-2">O contato entra para a equipe validar e atender.</div>}
    <details className="sm:col-span-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-sm text-zinc-300 [&>summary]:cursor-pointer"><summary>Mais detalhes (opcional): pessoa já no mapa, bairro, origem e a autorização</summary><div className="mt-3 grid gap-4 sm:grid-cols-2">
      <PersonPicker data={data} cityId={Number(cityId)} taken="lead" />
      <Field label="Bairro" hint="A pessoa aparece no centro do bairro no mapa, nunca na residência."><RegionSelect key={`reg-${cityId}`} regions={data.regions ?? []} cityId={Number(cityId)} name="regionId" canAdd /></Field>
      <Field label="Origem em poucas palavras"><Input name="sourceLabel" maxLength={160} placeholder="Ex.: conversa no encontro de sábado" className={inputClass} /></Field>
      <Field label="Como a autorização foi recebida"><Input name="consentSource" placeholder="Conversa direta com a pessoa" className={inputClass} /></Field>
      <Field label="Para quê" wide><Input name="consentPurpose" placeholder={`Atendimento comercial da ${data.access.organizationName}`} className={inputClass} /></Field>
    </div></details>
    <div className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-gold/20 bg-gold/5 p-4"><Checkbox id="consent" checked={consent} onCheckedChange={(value) => setConsent(value === true)} /><label htmlFor="consent" className="text-sm leading-6 text-zinc-300">A pessoa autorizou o contato da {data.access.organizationName} para o atendimento.</label></div>
  </FormShell>;
}

function LeadStatusForm({ data, leadId, saving, onSave }: { data: DashboardData; leadId?: number; saving: boolean; onSave: Save }) {
  const lead = data.leads.find((item) => item.id === leadId); const status = lead?.status ?? "Lead válido";
  const [consentRevoked, setConsentRevoked] = useState(Boolean(lead?.consentRevokedAt));
  return <FormShell title={`Responsável e autorização · ${lead?.name ?? ""}`} description="Quem cuida do atendimento e a autorização de contato. A etapa fica em “Etapa e próximo passo”; a venda, em “Venda e pagamento”." saving={saving} onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave("update_lead", { leadId: lead?.id, status, assignedToEmail: f.get("assignedToEmail") ?? "", consentRevoked, consentRevocationReason: f.get("consentRevocationReason") ?? "" }); }}>
    <Field label="Responsável comercial"><Input name="assignedToEmail" type="email" defaultValue={lead?.assignedToEmail} className={inputClass} /></Field>
    <div className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-4"><Checkbox id="lead-consent-revoked" checked={consentRevoked} disabled={Boolean(lead?.consentRevokedAt)} onCheckedChange={(value) => setConsentRevoked(value === true)} /><label htmlFor="lead-consent-revoked" className="text-sm leading-6 text-zinc-300">O contato revogou a autorização. Essa ação cancela o atendimento e não pode ser desfeita neste registro.</label></div>
    {consentRevoked && <Field label="Motivo da revogação" wide><Input name="consentRevocationReason" required defaultValue={lead?.consentRevocationReason} className={inputClass} /></Field>}
  </FormShell>;
}

function SaleForm({ data, leadId, saving, onSave }: { data: DashboardData; leadId?: number; saving: boolean; onSave: Save }) {
  const eligibleLeads = data.leads.filter((lead) => lead.status !== "Cancelado" && !lead.consentRevokedAt);
  const [selectedLead, setSelectedLead] = useState(String(leadId ?? eligibleLeads[0]?.id ?? ""));
  const selectedSale = data.sales.find((item) => item.leadId === Number(selectedLead));
  const [status, setStatus] = useState(selectedSale?.status ?? "Pagamento confirmado");
  const [product, setProduct] = useState(selectedSale?.product ?? "");
  const [amount, setAmount] = useState(String((selectedSale?.amountCents ?? 0) / 100));

  if (!eligibleLeads.length) return <><DialogHeader><DialogTitle>Nenhum atendimento disponível</DialogTitle><DialogDescription className="leading-6 text-zinc-400">Comece um atendimento antes de registrar a venda. Contatos cancelados ou com autorização revogada não podem receber vendas.</DialogDescription></DialogHeader><DialogFooter className="mt-6"><DialogClose asChild><Button type="button" variant="outline" className="border-white/12 bg-transparent text-white">Fechar</Button></DialogClose></DialogFooter></>;

  return <FormShell title="Registrar venda e pagamento" description="Registre aqui só o que foi pago (ou cancelar e reembolsar uma venda). Enquanto a pessoa decide, a etapa do atendimento é que mostra o andamento." saving={saving} onSubmit={(event) => { event.preventDefault(); onSave("record_sale", { leadId: Number(selectedLead), product, amountCents: cents(amount), status }); }}>
    <Field label="Atendimento"><Select value={selectedLead} onValueChange={(value) => { const sale = data.sales.find((item) => item.leadId === Number(value)); setSelectedLead(value); setStatus(sale?.status ?? "Pagamento confirmado"); setProduct(sale?.product ?? ""); setAmount(String((sale?.amountCents ?? 0) / 100)); }}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{eligibleLeads.map((lead) => <SelectItem key={lead.id} value={String(lead.id)}>#{lead.id} · {lead.name} · {lead.cityName}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Produto"><Input name="product" required value={product} onChange={(event) => setProduct(event.target.value)} placeholder="Ex.: Mentoria anual" className={inputClass} /></Field><Field label="Valor (R$)"><Input name="amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} /></Field>
    <Field label="Situação"><Select value={status} onValueChange={setStatus}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{[...(OLD_SALE_STATUSES as readonly string[]).filter((item) => item === selectedSale?.status), ...SALE_STEPS].map((item) => <SelectItem key={item} value={item}>{saleStatusLabel(item)}</SelectItem>)}</SelectContent></Select></Field>
  </FormShell>;
}

function CostForm({ data, saving, onSave }: { data: DashboardData; saving: boolean; onSave: Save }) {
  const [cityId, setCityId] = useState(String(data.cities[0]?.id ?? "")); const [category, setCategory] = useState("Mídia paga"); const [channel, setChannel] = useState("Mídia paga"); const [ambassadorId, setAmbassadorId] = useState("none");
  return <FormShell title="Registrar custo" description="Registre cada custo uma única vez, com cidade, período e canal." saving={saving} onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave("create_cost", { cityId: Number(cityId), ambassadorId: ambassadorId === "none" ? null : Number(ambassadorId), partnerId: null, eventId: null, category, channel, period: f.get("period"), amountCents: cents(f.get("amount")), note: f.get("note") }); }}>
    <Field label="Cidade"><Select value={cityId} onValueChange={(value) => { setCityId(value); setAmbassadorId("none"); }}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{data.cities.map((city) => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Período"><Input name="period" type="month" defaultValue={monthNow} required className={inputClass} /></Field><Field label="Categoria"><Select value={category} onValueChange={setCategory}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Mídia paga", "Evento", "Material", "Ferramenta", "Recompensa autorizada", "Outro"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Canal relacionado"><Select value={channel} onValueChange={setChannel}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Mídia paga", "Embaixador", "Parceiro", "Evento", "Conteúdo", "Orgânico", "Indicação", "Outro"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Embaixador relacionado"><Select value={ambassadorId} onValueChange={setAmbassadorId}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{data.ambassadors.filter((item) => item.cityId === Number(cityId)).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Valor (R$)"><Input name="amount" type="number" min="0.01" step="0.01" required className={inputClass} /></Field><Field label="Observação" wide><Textarea name="note" required className={inputClass} /></Field>
  </FormShell>;
}

function PartnerForm({ data, saving, onSave }: { data: DashboardData; saving: boolean; onSave: Save }) {
  const [cityId, setCityId] = useState(String(data.cities[0]?.id ?? "")); const [status, setStatus] = useState("Em conversa");
  return <FormShell title="Cadastrar parceiro" description="Registre o responsável e a próxima ação para a parceria não parar." saving={saving} onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave("create_partner", { cityId: Number(cityId), name: f.get("name"), type: f.get("type"), contactName: f.get("contactName"), whatsapp: f.get("whatsapp"), status, nextAction: f.get("nextAction") }); }}>
    <Field label="Cidade"><Select value={cityId} onValueChange={setCityId}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{data.cities.map((city) => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Parceiro"><Input name="name" required className={inputClass} /></Field>
    <Field label="Tipo"><Input name="type" required defaultValue="Parceiro local" className={inputClass} /></Field><Field label="Contato"><Input name="contactName" className={inputClass} /></Field><Field label="WhatsApp"><Input name="whatsapp" inputMode="tel" maxLength={30} placeholder="(31) 99999-9999" className={inputClass} /></Field>
    <Field label="Situação"><Select value={status} onValueChange={setStatus}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Em conversa", "Ativo", "Pausado", "Encerrado"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="Próxima ação" wide><Input name="nextAction" required placeholder="Ação, responsável e prazo" className={inputClass} /></Field>
  </FormShell>;
}

function EventForm({ data, saving, onSave }: { data: DashboardData; saving: boolean; onSave: Save }) {
  const [cityId, setCityId] = useState(String(data.cities[0]?.id ?? "")); const [partnerId, setPartnerId] = useState("none"); const [status, setStatus] = useState("Planejado");
  return <FormShell title="Cadastrar evento" description="O custo informado será lançado automaticamente na categoria Evento. Para entrar nos indicadores detalhados, cada pessoa do evento precisa virar um atendimento em Vendas." saving={saving} onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave("create_event", { cityId: Number(cityId), partnerId: partnerId === "none" ? null : Number(partnerId), name: f.get("name"), eventDate: f.get("date"), status, ownerName: f.get("ownerName"), costCents: cents(f.get("cost")), reach: Number(f.get("reach") || 0), leads: Number(f.get("leads") || 0), sales: Number(f.get("sales") || 0) }); }}>
    <Field label="Cidade"><Select value={cityId} onValueChange={(value) => { setCityId(value); setPartnerId("none"); }}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{data.cities.map((city) => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Nome do evento"><Input name="name" required className={inputClass} /></Field><Field label="Data"><Input name="date" type="date" required defaultValue={dateNow} className={inputClass} /></Field>
    <Field label="Parceiro"><Select value={partnerId} onValueChange={setPartnerId}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem parceiro</SelectItem>{data.partners.filter((item) => item.cityId === Number(cityId)).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Responsável"><Input name="ownerName" className={inputClass} /></Field><Field label="Situação"><Select value={status} onValueChange={setStatus}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Planejado", "Confirmado", "Realizado", "Cancelado"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Custo (R$)"><Input name="cost" type="number" min="0" step="0.01" defaultValue="0" className={inputClass} /></Field>
  </FormShell>;
}

function ContentForm({ data, saving, onSave }: { data: DashboardData; saving: boolean; onSave: Save }) {
  // Simplificação (S8): título, tipo, para quem, link e instruções; o resto com padrão em "Mais detalhes".
  const approver = data.access.role === "Administrador" || data.access.role === "Coordenação";
  const [cityId, setCityId] = useState("all"); const [type, setType] = useState("Mensagem"); const [channel, setChannel] = useState("Geral"); const [status, setStatus] = useState(approver ? "Aprovado" : "Em revisão"); const [audience, setAudience] = useState("Todos");
  return <FormShell title="Adicionar material" description={approver ? "Mensagens, vídeos e roteiros que a equipe pode usar. Já entra aprovado; mude em Mais detalhes se quiser revisar antes." : "O material vai para revisão; só os aprovados aparecem para embaixadores e mentorados."} saving={saving} onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave("create_content", { audience, cityId: cityId === "all" ? null : Number(cityId), title: f.get("title"), type, channel, version: "1.0", status, url: f.get("url"), instructions: f.get("instructions"), expiresAt: f.get("expiresAt") }); }}>
    <Field label="Título"><Input name="title" required className={inputClass} /></Field>
    <Field label="Tipo"><Select value={type} onValueChange={setType}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Mensagem", "Vídeo", "Arte", "Roteiro", "Treinamento"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Para quem" hint="Mentorados veem o material no portal deles."><Select value={audience} onValueChange={setAudience}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Todos", "Embaixadores", "Mentorados"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Link do material"><Input name="url" type="url" placeholder="https://" className={inputClass} /></Field>
    <Field label="Instruções" wide><Textarea name="instructions" required placeholder="Quando e como usar" className={inputClass} /></Field>
    <details className="sm:col-span-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-sm text-zinc-300 [&>summary]:cursor-pointer"><summary>Mais detalhes (opcional): cidade, canal, situação e validade</summary><div className="mt-3 grid gap-4 sm:grid-cols-2">
      <Field label="Cidade"><Select value={cityId} onValueChange={setCityId}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as cidades</SelectItem>{data.cities.map((city) => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Canal"><Select value={channel} onValueChange={setChannel}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Geral", "WhatsApp", "Instagram", "Presencial", "E-mail"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Situação"><Select value={status} onValueChange={setStatus}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{(approver ? ["Aprovado", "Em revisão", "Retirado"] : ["Em revisão"]).map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Validade"><Input name="expiresAt" type="date" className={inputClass} /></Field>
    </div></details>
  </FormShell>;
}

function TaskForm({ data, saving, onSave }: { data: DashboardData; saving: boolean; onSave: Save }) {
  const [cityId, setCityId] = useState(String(data.cities[0]?.id ?? "none")); const [ambassadorId, setAmbassadorId] = useState("none"); const [category, setCategory] = useState("Missão");
  return <FormShell title="Criar tarefa" description="A tarefa pode ser da cidade ou de um embaixador específico." saving={saving} onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave("create_task", { cityId: cityId === "none" ? null : Number(cityId), ambassadorId: ambassadorId === "none" ? null : Number(ambassadorId), title: f.get("title"), category, dueDate: f.get("dueDate") }); }}>
    <Field label="Cidade"><Select value={cityId} onValueChange={(value) => { setCityId(value); setAmbassadorId("none"); }}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Todas</SelectItem>{data.cities.map((city) => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Embaixador"><Select value={ambassadorId} onValueChange={setAmbassadorId}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Equipe da cidade</SelectItem>{data.ambassadors.filter((item) => cityId === "none" || item.cityId === Number(cityId)).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Tarefa" wide><Input name="title" required className={inputClass} /></Field><Field label="Categoria"><Select value={category} onValueChange={setCategory}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Missão", "Treinamento", "Evento", "Conteúdo", "Atendimento"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="Prazo"><Input name="dueDate" type="date" className={inputClass} /></Field>
  </FormShell>;
}

function SettingsForm({ data, saving, onSave }: { data: DashboardData; saving: boolean; onSave: Save }) {
  const settings = data.settings;
  return <FormShell title="Critérios da expansão" description="Nenhum limite fica escondido no código. Use 0 somente quando a regra não deve ser exigida; embaixadores, pagamentos e períodos precisam ser definidos para gerar decisão." saving={saving} onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave("update_settings", { referralBaseUrl: f.get("referralBaseUrl"), attributionModel: "Origem principal declarada", minActiveAmbassadors: Number(f.get("minActiveAmbassadors") || 0), minConfirmedPayments: Number(f.get("minConfirmedPayments") || 0), minActivePartners: Number(f.get("minActivePartners") || 0), minDataPeriods: Number(f.get("minDataPeriods") || 0), inactivityDays: Number(f.get("inactivityDays") || 0), organicGoalPercent: Number(f.get("organicGoalPercent") || 0) }); }}>
    <Field label="Link-base de indicação" wide hint="Pode ser uma landing page ou link do WhatsApp. O código do embaixador será acrescentado."><Input name="referralBaseUrl" type="url" defaultValue={settings.referralBaseUrl} placeholder="https://" className={inputClass} /></Field>
    <Field label="Regra de atribuição" hint="Primeiro e último contato exigem histórico de atribuição e permanecem fora desta versão."><Input value="Origem principal declarada" readOnly className={inputClass} /></Field>
    <Field label="Embaixadores ativos mínimos"><Input name="minActiveAmbassadors" type="number" min="0" defaultValue={settings.minActiveAmbassadors} className={inputClass} /></Field><Field label="Pagamentos mínimos"><Input name="minConfirmedPayments" type="number" min="0" defaultValue={settings.minConfirmedPayments} className={inputClass} /></Field><Field label="Parceiros ativos mínimos"><Input name="minActivePartners" type="number" min="0" defaultValue={settings.minActivePartners} className={inputClass} /></Field>
    <Field label="Períodos mínimos"><Input name="minDataPeriods" type="number" min="0" defaultValue={settings.minDataPeriods} className={inputClass} /></Field><Field label="Dias sem atividade"><Input name="inactivityDays" type="number" min="0" defaultValue={settings.inactivityDays} className={inputClass} /></Field><Field label="Meta orgânica (%)"><Input name="organicGoalPercent" type="number" min="0" max="100" defaultValue={settings.organicGoalPercent} className={inputClass} /></Field>
  </FormShell>;
}

const CITY_REQUIRED = ["Coordenação", "Líder", "Embaixador"];
const ROLE_HELP: Record<string, string> = {
  Administrador: "Vê e altera tudo da organização, cadastra a equipe e gera links de acesso.",
  Coordenação: "Coordena uma cidade: registra pessoas, locais, embaixadores, atendimentos, vendas, custos e tarefas dela.",
  Líder: "Líder local de uma cidade: acompanha a equipe e os resultados dela.",
  Embaixador: "Vê só o próprio portal: treinamento, link de indicação e tarefas.",
  Comercial: "Executivo(a) de vendas: mapeia pessoas e locais, cuida dos próprios atendimentos, agenda e metas.",
  Mentorado: "Mentorado(a): entra só no portal de mentoria (jornada, próximo encontro, materiais e indicações). Não vê nada da equipe.",
};
const TITLE_SUGGESTIONS = ["Executivo de Vendas", "Executiva de Vendas", "Assessor Executivo", "Assessora Executiva", "Coordenador Regional", "Mapeador", "Líder Local", "Mentorado Exclusivo", "Mentorada Exclusiva"];

function UserForm({ data, userId, saving, onSave }: { data: DashboardData; userId?: number; saving: boolean; onSave: Save }) {
  const user = data.users.find((item) => item.id === userId);
  const [role, setRole] = useState<string>(user?.role ?? "Comercial"); const [cityId, setCityId] = useState(user?.cityId ? String(user.cityId) : "none"); const [ambassadorId, setAmbassadorId] = useState(user?.ambassadorId ? String(user.ambassadorId) : "none");
  const [mentorship, setMentorship] = useState(String(user?.mentorshipCycle ?? 0));
  return <FormShell title={user ? "Editar pessoa da equipe" : "Adicionar pessoa à equipe"} description={user ? "Altere cargo, função, cidade ou mentoria. O e-mail é o login e não muda." : "Define o que a pessoa pode ver e fazer. Depois de salvar, use \u201cGerar link\u201d na lista da equipe para ela criar a própria senha."} saving={saving} onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave("create_user", { email: user?.email ?? f.get("email"), name: f.get("name"), role, cityId: cityId === "none" || cityId === "" ? null : Number(cityId), ambassadorId: ambassadorId === "none" ? null : Number(ambassadorId), title: f.get("title") ?? "", mentorshipCycle: Number(mentorship) }); }}>
    <Field label="Nome"><Input name="name" required defaultValue={user?.name} placeholder="Nome e sobrenome" className={inputClass} /></Field><Field label="E-mail (login)"><Input name="email" type="email" required={!user} disabled={Boolean(user)} defaultValue={user?.email} placeholder="nome@exemplo.com" className={inputClass} /></Field>
    <Field label="Cargo na equipe" hint="Só descreve a pessoa. O que ela acessa vem da função."><Input name="title" list="team-title-suggestions" maxLength={80} defaultValue={user?.title} placeholder="Ex.: Executiva de Vendas" className={inputClass} /><datalist id="team-title-suggestions">{TITLE_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist></Field>
    <Field label="Mentoria"><Select value={mentorship} onValueChange={setMentorship}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Não é mentorado(a)</SelectItem>{[1, 2, 3, 4, 5].map((cycle) => <SelectItem key={cycle} value={String(cycle)}>Mentorado(a) · {cycle}º ciclo</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Função (o que pode acessar)"><Select value={role} onValueChange={(value) => { setRole(value); if (CITY_REQUIRED.includes(value) && cityId === "none") setCityId(""); if (!CITY_REQUIRED.includes(value) && cityId === "") setCityId("none"); }}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{["Administrador", "Coordenação", "Líder", "Embaixador", "Comercial", "Mentorado"].map((item) => <SelectItem key={item} value={item}>{item === "Comercial" ? "Comercial (Executivo de Vendas)" : item === "Mentorado" ? "Mentorado (portal)" : item}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Cidade"><Select value={cityId} onValueChange={(value) => { setCityId(value); setAmbassadorId("none"); }}><SelectTrigger className={selectClass}><SelectValue placeholder="Selecione a cidade" /></SelectTrigger><SelectContent>{!CITY_REQUIRED.includes(role) && <SelectItem value="none">Todas as cidades</SelectItem>}{data.cities.map((city) => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}</SelectContent></Select></Field>
    <p className="text-xs leading-5 text-zinc-400 sm:col-span-2">{ROLE_HELP[role]}</p>
    {role === "Embaixador" && <Field label="Embaixador"><Select value={ambassadorId} onValueChange={setAmbassadorId}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Não vinculado</SelectItem>{data.ambassadors.filter((item) => cityId !== "none" && item.cityId === Number(cityId)).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></Field>}
  </FormShell>;
}

export function ExpansionDialog({ dialog, data, saving, onClose, onSave }: { dialog: DialogState; data: DashboardData; saving: boolean; onClose: () => void; onSave: Save }) {
  const city = useMemo(() => data.cities.find((item) => item.id === dialog?.entityId), [data.cities, dialog]);
  const ambassador = useMemo(() => data.ambassadors.find((item) => item.id === dialog?.entityId), [data.ambassadors, dialog]);
  return <Dialog open={dialog !== null} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-surface-raised text-white sm:max-w-3xl">
    {dialog?.name === "city" && <CityFields mode="create" saving={saving} onSave={onSave} />}
    {dialog?.name === "city-edit" && city && <CityFields mode="edit" city={city} saving={saving} onSave={onSave} />}
    {dialog?.name === "city-result" && <CityResultForm data={data} saving={saving} onSave={onSave} />}
    {dialog?.name === "ambassador" && <AmbassadorFields mode="create" data={data} saving={saving} onSave={onSave} />}
    {dialog?.name === "ambassador-edit" && ambassador && <AmbassadorFields mode="edit" data={data} ambassador={ambassador} saving={saving} onSave={onSave} />}
    {dialog?.name === "ambassador-activity" && <ActivityForm data={data} saving={saving} onSave={onSave} />}
    {dialog?.name === "lead" && <LeadForm data={data} saving={saving} onSave={onSave} />}
    {dialog?.name === "lead-status" && <LeadStatusForm data={data} leadId={dialog.entityId} saving={saving} onSave={onSave} />}
    {dialog?.name === "sale" && <SaleForm data={data} leadId={dialog.entityId} saving={saving} onSave={onSave} />}
    {dialog?.name === "cost" && <CostForm data={data} saving={saving} onSave={onSave} />}
    {dialog?.name === "partner" && <PartnerForm data={data} saving={saving} onSave={onSave} />}
    {dialog?.name === "event" && <EventForm data={data} saving={saving} onSave={onSave} />}
    {dialog?.name === "content" && <ContentForm data={data} saving={saving} onSave={onSave} />}
    {dialog?.name === "task" && <TaskForm data={data} saving={saving} onSave={onSave} />}
    {dialog?.name === "settings" && <SettingsForm data={data} saving={saving} onSave={onSave} />}
    {dialog?.name === "user" && <UserForm key={dialog.entityId ?? "new"} data={data} userId={dialog.entityId} saving={saving} onSave={onSave} />}
  </DialogContent></Dialog>;
}

function PersonPicker({cityId,taken}:{data:DashboardData;cityId:number;taken:'ambassador'|'lead'}) {
 return <Field label="Pessoa já cadastrada" hint="Pesquise e selecione para manter uma única identidade. Sem seleção, será criada uma pessoa."><TerritoryPersonPicker key={cityId} cityId={cityId} copyName taken={taken}/></Field>;
}
