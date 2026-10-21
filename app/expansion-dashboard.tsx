"use client";
import {tenantFetch} from '@/lib/tenant-request';

import {TerritoryDecisions} from '@/app/territory-decisions';
import {FollowupWorkspace} from '@/app/followup-workspace';
import {CommercialWorkspace} from '@/app/commercial-workspace';
import { AppShell, type NewAction } from "@/app/app-shell";
import { AdvisorsPanel } from "@/app/advisors-panel";
import { copyText } from "@/lib/copy-text";
import { GettingStarted, WelcomeDialog } from "@/app/getting-started";
import { TeamPanel } from "@/app/team-panel";
import { MappingWizard } from "@/app/mapping-wizard";
import { MappingStatsPanel } from "@/app/mapping-stats";
import { PeopleImport } from "@/app/people-import";
import { AgendaBanner } from "@/app/agenda-banner";
import { PortalAdmin } from "@/app/portal-admin";
import { PlanCard, SubscriptionsPanel } from "@/app/subscriptions-panel";
/* eslint-disable @next/next/no-img-element -- QR remoto gerado somente após o administrador configurar o link-base. */

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Banknote,
  BookOpenCheck,
  Building2,
  CalendarDays,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Handshake,
  Library,
  LogOut,
  MapPin,
  Megaphone,
  Plus,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Target,
  TrendingDown,
  Trophy,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { ExpansionDialog, type DialogState } from "@/app/expansion-forms";
import { TerritorialMap } from "@/app/territorial-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { availablePeriods, buildDashboardView, EMPTY_FILTERS } from "@/lib/expansion-domain";
import { canPerform, type ActionName } from "@/lib/expansion-permissions";
import { navigationFor, parseTarget, resolveLocation, type NavLocation } from "@/lib/navigation";
import type {
  AlertMetric,
  AmbassadorMetric,
  ChannelMetric,
  CityMetric,
  DashboardData,
  DashboardFilters,
  DashboardView,
  SaleRecord,
} from "@/lib/expansion-types";

const money = (cents: number | null, compact = false) => cents === null
  ? "Sem dados suficientes"
  : new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: compact ? 0 : 2,
    }).format(cents / 100);
const ratio = (value: number | null) => value === null ? "Sem dados suficientes" : `${Math.round(value * 100)}%`;
const multiple = (value: number | null) => value === null ? "Sem dados suficientes" : `${value.toFixed(2).replace(".", ",")}x`;
const number = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const dateTime = (value: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value))
  : "Sem registro";
const dateOnly = (value: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(`${value.slice(0, 10)}T12:00:00-03:00`))
  : "Sem prazo";

const successMessage: Partial<Record<ActionName, string>> = {
  create_city: "Cidade cadastrada.",
  update_city: "Cidade atualizada.",
  create_ambassador: "Embaixador cadastrado. A ativação continua pendente.",
  update_ambassador: "Etapa do embaixador atualizada.",
  record_city: "Fechamento da cidade registrado.",
  record_ambassador: "Atividade registrada.",
  create_lead: "Atendimento registrado.",
  update_lead: "Etapa do lead atualizada.",
  record_sale: "Venda atualizada. A receita só entra após pagamento confirmado.",
  create_cost: "Custo registrado.",
  create_partner: "Parceiro cadastrado.",
  create_event: "Evento cadastrado.",
  create_content: "Material cadastrado.",
  create_task: "Tarefa criada.",
  complete_task: "Tarefa concluída.",
  complete_training: "Treinamento concluído.",
  accept_terms: "Regras aceitas.",
  update_settings: "Regras atualizadas.",
  create_user: "Perfil preparado. Gere o link de acesso para a pessoa criar a senha.",
};

const chartConfig = {
  revenue: { label: "Receita", color: "#c9a227" },
  cost: { label: "Custo", color: "#5b6575" },
  leads: { label: "Leads", color: "#c9a227" },
  payments: { label: "Pagamentos", color: "#6ee7b7" },
} satisfies ChartConfig;

function badgeClass(value: string) {
  if (["Ativa", "Ativo", "Aprovado", "Concluído", "Concluída", "Realizado", "Pagamento confirmado", "Avançar"].includes(value)) return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (["Corrigir", "Pausada", "Pausado", "Desligado", "Cancelado", "Cancelada", "Reembolsada", "Pausar"].includes(value)) return "border-red-400/30 bg-red-400/10 text-red-300";
  if (["Preparar", "Planejada", "Preparação", "Em espera", "Convidado", "Pendente", "Em análise"].includes(value)) return "border-slate-400/30 bg-slate-400/10 text-slate-300";
  return "border-amber-300/30 bg-amber-300/10 text-amber-200";
}

function Kpi({ label, value, helper, icon: Icon, emphasis = false }: { label: string; value: string; helper: string; icon: typeof Users; emphasis?: boolean }) {
  return <article className={`elite-card group relative overflow-hidden p-5 ${emphasis ? "border-[#c9a227]/25" : ""}`}>
    <div className="mb-4 flex items-start justify-between gap-3"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p><span className="rounded-xl border border-[#c9a227]/20 bg-[#c9a227]/10 p-2 text-[#d6b94f]"><Icon className="size-4" /></span></div>
    <p className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{value}</p><p className="mt-2 min-h-8 text-xs leading-5 text-zinc-500">{helper}</p>
    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/60 to-transparent opacity-0 transition group-hover:opacity-100" />
  </article>;
}

function EmptyState({ title, description, icon: Icon = Building2 }: { title: string; description: string; icon?: typeof Building2 }) {
  return <div className="grid min-h-40 place-items-center px-5 text-center"><div><Icon className="mx-auto mb-4 size-8 text-[#c9a227]" /><h3 className="font-semibold text-white">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">{description}</p></div></div>;
}

/** Linha de ações de uma seção: o que ela mostra (à esquerda) e os botões (à direita). */
function ActionBar({ hint, children }: { hint: string; children?: ReactNode }) {
  return <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><p className="max-w-2xl text-sm leading-6 text-zinc-400">{hint}</p>{children && <div className="flex flex-wrap gap-2">{children}</div>}</div>;
}

function FilterBar({ data, filters, onChange }: { data: DashboardData; filters: DashboardFilters; onChange: (filters: DashboardFilters) => void }) {
  const periods = availablePeriods(data);
  const leaders = [...new Set(data.cities.map((city) => city.leaderName).filter(Boolean))].sort();
  const ambassadors = data.ambassadors.filter((item) => filters.cityId === null || item.cityId === filters.cityId);
  const activeCount = [filters.cityId !== null, filters.period, filters.channel, filters.leader, filters.ambassadorId !== null].filter(Boolean).length;
  // No celular os filtros ficam recolhidos para não empurrar o conteúdo para baixo.
  const [open, setOpen] = useState(false);
  return <section className="elite-card p-3 sm:p-4"><Button variant="ghost" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="w-full justify-between text-zinc-300 sm:hidden"><span className="flex items-center gap-2"><Filter /> Filtros{activeCount ? ` (${activeCount})` : ""}</span><span className="text-xs text-zinc-500">{open ? "Esconder" : "Mostrar"}</span></Button><div className={`${open ? "mt-2 grid" : "hidden"} gap-2 sm:mt-0 sm:grid sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]`}>
    <Select value={filters.cityId === null ? "all" : String(filters.cityId)} onValueChange={(value) => onChange({ ...filters, cityId: value === "all" ? null : Number(value), ambassadorId: null })}><SelectTrigger className="w-full border-white/10 bg-white/[0.035]"><SelectValue placeholder="Todas as cidades" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as cidades</SelectItem>{data.cities.map((city) => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}</SelectContent></Select>
    <Select value={filters.period || "all"} onValueChange={(value) => onChange({ ...filters, period: value === "all" ? "" : value })}><SelectTrigger className="w-full border-white/10 bg-white/[0.035]"><SelectValue placeholder="Todos os períodos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os períodos</SelectItem>{periods.map((period) => <SelectItem key={period} value={period}>{period.split("-").reverse().join("/")}</SelectItem>)}</SelectContent></Select>
    <Select value={filters.channel || "all"} onValueChange={(value) => onChange({ ...filters, channel: value === "all" ? "" : value })}><SelectTrigger className="w-full border-white/10 bg-white/[0.035]"><SelectValue placeholder="Todos os canais" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os canais</SelectItem>{["Mídia paga", "Embaixador", "Parceiro", "Evento", "Conteúdo", "Orgânico", "Indicação", "Outro"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
    <Select value={filters.leader || "all"} onValueChange={(value) => onChange({ ...filters, leader: value === "all" ? "" : value })}><SelectTrigger className="w-full border-white/10 bg-white/[0.035]"><SelectValue placeholder="Todos os líderes" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os líderes</SelectItem>{leaders.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
    <Select value={filters.ambassadorId === null ? "all" : String(filters.ambassadorId)} onValueChange={(value) => onChange({ ...filters, ambassadorId: value === "all" ? null : Number(value) })}><SelectTrigger className="w-full border-white/10 bg-white/[0.035]"><SelectValue placeholder="Todos os embaixadores" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os embaixadores</SelectItem>{ambassadors.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select>
    <Button variant="ghost" onClick={() => onChange({ ...EMPTY_FILTERS })} disabled={!activeCount} className="text-zinc-400 hover:bg-white/5 hover:text-white"><RefreshCcw /> Limpar {activeCount ? `(${activeCount})` : ""}</Button>
  </div></section>;
}

function Alerts({ items }: { items: AlertMetric[] }) {
  if (!items.length) return <article className="elite-card flex items-center gap-4 p-5"><span className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300"><ShieldCheck /></span><div><p className="font-semibold text-white">Nenhum alerta aberto</p><p className="mt-1 text-sm text-zinc-500">Os dados atuais não geraram avisos pelas regras configuradas.</p></div></article>;
  return <article className="elite-card overflow-hidden"><div className="border-b border-white/8 px-5 py-4"><p className="section-kicker">Ações necessárias</p><h3 className="text-lg font-semibold text-white">Alertas da operação</h3></div><div className="divide-y divide-white/7">{items.slice(0, 8).map((item) => <div key={item.id} className="flex gap-3 p-4"><AlertTriangle className={`mt-0.5 size-4 shrink-0 ${item.severity === "Alta" ? "text-red-300" : "text-amber-300"}`} /><div><p className="text-sm font-medium text-white">{item.title}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{item.description}</p></div></div>)}</div></article>;
}

function TodayPanel({ data, view, onGo, onFollowup }: { data: DashboardData; view: DashboardView; onGo: (target: string) => void; onFollowup: (leadId: number) => void }) {
  const summary = view.summary, agenda = data.agenda;
  const manage = ["Administrador", "Coordenação", "Líder"].includes(data.access.role);
  return <div className="space-y-5">
    {agenda && (agenda.late || agenda.today) ? <AgendaBanner agenda={agenda} onAll={() => onGo("vendas/agenda")} onOpen={onFollowup} />
      : <article className="elite-card flex flex-wrap items-center gap-4 p-5"><span className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300"><Check /></span><div className="mr-auto"><p className="font-semibold text-white">Nenhum retorno atrasado ou para hoje</p><p className="mt-1 text-sm text-zinc-500">Quando houver, eles aparecem aqui primeiro.</p></div><Button variant="outline" onClick={() => onGo("vendas/agenda")} className="border-white/10 bg-white/5 text-white">Abrir a agenda</Button></article>}
    {manage && <GettingStarted data={data} onGo={onGo} />}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Leads válidos" value={number(summary.validLeads)} helper={`${ratio(summary.organicShare)} sem mídia paga`} icon={Megaphone} />
      <Kpi label="Clientes pagos" value={number(summary.confirmedPayments)} helper="Pagamentos confirmados" icon={BadgeCheck} />
      <Kpi label="Conversão" value={ratio(summary.conversion)} helper="Pagamentos ÷ leads válidos" icon={Target} />
      <Kpi label="Receita confirmada" value={money(summary.revenueCents, true)} helper="Somente pagamentos confirmados" icon={Banknote} emphasis />
    </section>
    {manage && <Alerts items={view.alerts} />}
  </div>;
}

function ResultsOverview({ view, canExport }: { view: DashboardView; canExport: boolean }) {
  const summary = view.summary;
  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Cidades ativas" value={`${summary.activeCities}/${summary.plannedCities}`} helper="Operação autorizada" icon={MapPin} />
      <Kpi label="Embaixadores ativos" value={number(summary.activeAmbassadors)} helper={`${ratio(summary.activation)} de ${summary.eligibleAmbassadors} aprovados elegíveis`} icon={Users} />
      <Kpi label="Leads válidos" value={number(summary.validLeads)} helper={`${ratio(summary.organicShare)} sem mídia paga`} icon={Megaphone} />
      <Kpi label="Clientes pagos" value={number(summary.confirmedPayments)} helper={`${ratio(summary.conversion)} dos leads válidos`} icon={BadgeCheck} />
      <Kpi label="Receita confirmada" value={money(summary.revenueCents, true)} helper="Somente pagamentos confirmados" icon={Banknote} />
      <Kpi label="Custo total" value={money(summary.costCents, true)} helper={`${money(summary.cplCents)} por lead`} icon={CircleDollarSign} />
      <Kpi label="CAC" value={money(summary.cacCents)} helper="Custo por cliente pago" icon={TrendingDown} emphasis />
      <Kpi label="ROAS de mídia" value={multiple(summary.roas)} helper={`ROI total: ${ratio(summary.roi)}`} icon={Target} />
    </section>
    <article className="elite-card p-5 sm:p-6"><div className="mb-5"><p className="section-kicker">Evolução por período</p><h3 className="text-xl font-semibold text-white">Receita confirmada e custo</h3></div>{view.timeline.length ? <ChartContainer config={chartConfig} className="h-[290px] w-full aspect-auto"><BarChart data={view.timeline} margin={{ left: 0, right: 8, top: 10 }}><CartesianGrid vertical={false} strokeDasharray="4 4" /><XAxis dataKey="period" tickLine={false} axisLine={false} tickFormatter={(value) => String(value).slice(5)} /><YAxis tickLine={false} axisLine={false} width={54} tickFormatter={(value) => `R$${Math.round(value / 1000)}k`} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="revenue" fill="var(--color-revenue)" radius={[5, 5, 0, 0]} /><Bar dataKey="cost" fill="var(--color-cost)" radius={[5, 5, 0, 0]} /></BarChart></ChartContainer> : <EmptyState title="Ainda não há evolução" description="Registre leads, pagamentos e custos no mesmo período para criar a comparação." icon={Activity} />}</article>
    {canExport && <div className="flex justify-end"><Button onClick={() => { try { exportCsv(view); toast.success("Relatório exportado."); } catch { toast.error("Não foi possível exportar o relatório."); } }} variant="outline" className="border-white/10 bg-white/5 text-white"><Download /> Exportar cidades (CSV)</Button></div>}
    <CityTable cities={view.cities} />
  </div>;
}

function CityTable({ cities, compact = false, onEdit }: { cities: CityMetric[]; compact?: boolean; onEdit?: (id: number) => void }) {
  if (!cities.length) return <article className="elite-card"><EmptyState title="Nenhuma cidade neste filtro" description="Limpe os filtros ou cadastre uma cidade autorizada." /></article>;
  return <article className="elite-card overflow-hidden"><div className="border-b border-white/8 px-5 py-4"><p className="section-kicker">Mapa de expansão</p><h3 className="text-lg font-semibold text-white">Saúde das cidades</h3></div><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-white/8 hover:bg-transparent"><TableHead>Cidade</TableHead><TableHead>Fonte</TableHead><TableHead>Ativos</TableHead><TableHead>Leads</TableHead><TableHead>Pagos</TableHead><TableHead>Custo</TableHead><TableHead>CAC</TableHead>{!compact && <><TableHead>Orgânico</TableHead><TableHead>Parceiros</TableHead></>}<TableHead>Decisão</TableHead>{onEdit && <TableHead />}</TableRow></TableHeader><TableBody>{cities.map((city) => <TableRow key={city.id} className="border-white/7 hover:bg-white/[0.025]"><TableCell><div className="min-w-40"><p className="font-medium text-white">{city.name}</p><p className="text-xs text-zinc-500">{city.state} · {city.leaderName || "Sem líder"}</p></div></TableCell><TableCell><Badge variant="outline" className="border-white/10 text-zinc-400">{city.dataSource}</Badge></TableCell><TableCell><div className="min-w-24"><div className="mb-2 flex justify-between text-xs"><span>{city.activeAmbassadors}</span><span className="text-zinc-500">meta {city.ambassadorGoal}</span></div><Progress value={city.ambassadorGoal ? Math.min(100, city.activeAmbassadors / city.ambassadorGoal * 100) : 0} className="bg-white/8 [&_[data-slot=progress-indicator]]:bg-[#c9a227]" /></div></TableCell><TableCell>{number(city.validLeads)}</TableCell><TableCell>{number(city.confirmedPayments)}</TableCell><TableCell>{money(city.costCents, true)}</TableCell><TableCell>{money(city.cacCents)}</TableCell>{!compact && <><TableCell>{ratio(city.organicShare)}</TableCell><TableCell>{city.activePartners}</TableCell></>}<TableCell><Badge variant="outline" className={badgeClass(city.decision)} title={city.decisionReason}>{city.decision}</Badge><p className="mt-1 max-w-48 text-[11px] leading-4 text-zinc-500">{city.decisionReason}</p></TableCell>{onEdit && <TableCell><Button size="sm" variant="ghost" onClick={() => onEdit(city.id)} className="text-zinc-400 hover:text-white"><Settings /> Configurar</Button></TableCell>}</TableRow>)}</TableBody></Table></div></article>;
}

function AmbassadorTable({ ambassadors, onEdit }: { ambassadors: AmbassadorMetric[]; onEdit?: (id: number) => void }) {
  if (!ambassadors.length) return <article className="elite-card"><EmptyState title="Nenhum embaixador cadastrado" description="Cadastre as primeiras pessoas da cidade-piloto e acompanhe cada etapa." icon={Users} /></article>;
  return <article className="elite-card overflow-hidden"><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-white/8 hover:bg-transparent"><TableHead>Embaixador</TableHead><TableHead>Cidade</TableHead><TableHead>Etapa</TableHead><TableHead>Treinamento</TableHead><TableHead>Atividade</TableHead><TableHead>Leads</TableHead><TableHead>Pagos</TableHead><TableHead>Conversão</TableHead>{onEdit && <TableHead />}</TableRow></TableHeader><TableBody>{ambassadors.map((item) => <TableRow key={item.id} className="border-white/7 hover:bg-white/[0.025]"><TableCell><div className="min-w-44"><div className="flex items-center gap-2"><p className="font-medium text-white">{item.name}</p>{item.isActive && <BadgeCheck className="size-4 text-emerald-300" />}</div><p className="text-xs text-zinc-500">{item.code} · {item.level}</p></div></TableCell><TableCell>{item.cityName}</TableCell><TableCell><Badge variant="outline" className={badgeClass(item.status)}>{item.status}</Badge><p className="mt-1 text-[11px] text-zinc-500">{item.onboardingStatus}</p></TableCell><TableCell><div className="min-w-24"><p className="mb-2 text-xs">{item.trainingProgress}%</p><Progress value={item.trainingProgress} className="bg-white/8 [&_[data-slot=progress-indicator]]:bg-[#c9a227]" /></div></TableCell><TableCell><p className={item.isActive ? "text-emerald-300" : "text-zinc-500"}>{item.isActive ? "Ativo" : "Ainda não ativo"}</p><p className="text-[11px] text-zinc-600">{dateTime(item.lastActivity)}</p></TableCell><TableCell>{item.validLeads}</TableCell><TableCell>{item.confirmedPayments}</TableCell><TableCell>{ratio(item.conversion)}</TableCell>{onEdit && <TableCell><Button size="sm" variant="ghost" onClick={() => onEdit(item.id)} className="text-zinc-400 hover:text-white"><UserCog /> Acompanhar</Button></TableCell>}</TableRow>)}</TableBody></Table></div></article>;
}

function saleForLead(sales: SaleRecord[], leadId: number) { return sales.find((sale) => sale.leadId === leadId); }

function Pipeline({ view, onLead, onSale, onMap, canEdit }: { view: DashboardView; onLead: (id: number) => void; onSale: (id: number) => void; onMap?: (id: number) => void; canEdit: boolean }) {
  if (!view.filteredLeads.length) return <article className="elite-card"><EmptyState title="Nenhum lead neste filtro" description="Registre o primeiro contato autorizado ou altere os filtros." icon={Megaphone} /></article>;
  return <article className="elite-card overflow-hidden"><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-white/8 hover:bg-transparent"><TableHead>Lead</TableHead><TableHead>Origem</TableHead><TableHead>Etapa</TableHead><TableHead>Venda</TableHead><TableHead>Valor</TableHead><TableHead>Responsável</TableHead>{canEdit && <TableHead />}</TableRow></TableHeader><TableBody>{view.filteredLeads.map((lead) => { const sale = saleForLead(view.filteredSales, lead.id); return <TableRow key={lead.id} className="border-white/7 hover:bg-white/[0.025]"><TableCell><div className="min-w-44"><p className="font-medium text-white">{lead.name}</p><p className="text-xs text-zinc-500">#{lead.id} · {lead.cityName}</p></div></TableCell><TableCell><p>{lead.channel}</p><p className="text-xs text-zinc-500">{lead.ambassadorName || lead.sourceLabel || "Origem registrada"}</p></TableCell><TableCell><Badge variant="outline" className={badgeClass(lead.status)}>{lead.status}</Badge></TableCell><TableCell><Badge variant="outline" className={badgeClass(sale?.status ?? "Sem venda")}>{sale?.status ?? "Sem venda"}</Badge></TableCell><TableCell>{sale ? money(sale.amountCents) : "—"}</TableCell><TableCell><span className="max-w-44 truncate text-xs text-zinc-400">{lead.assignedToEmail || "Não definido"}</span></TableCell>{canEdit && <TableCell><div className="flex gap-1">{onMap && <Button size="sm" variant="ghost" onClick={() => onMap(lead.id)}>Ver no mapa</Button>}<Button size="sm" variant="ghost" onClick={() => onLead(lead.id)} className="text-zinc-400 hover:text-white">Etapa</Button><Button size="sm" variant="ghost" onClick={() => onSale(lead.id)} className="text-[#d6b94f]">Venda</Button></div></TableCell>}</TableRow>; })}</TableBody></Table></div></article>;
}

function ChannelTable({ channels }: { channels: ChannelMetric[] }) {
  if (!channels.length) return <article className="elite-card"><EmptyState title="Sem dados por canal" description="O detalhamento por origem aparece quando cidades usam o modo Detalhado." icon={Filter} /></article>;
  return <article className="elite-card overflow-hidden"><div className="border-b border-white/8 px-5 py-4"><p className="section-kicker">Origem dos resultados</p><h3 className="text-lg font-semibold text-white">Eficiência por canal</h3></div><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-white/8 hover:bg-transparent"><TableHead>Canal</TableHead><TableHead>Leads</TableHead><TableHead>Pagamentos</TableHead><TableHead>Receita</TableHead><TableHead>Custo</TableHead><TableHead>CPL</TableHead><TableHead>CAC</TableHead></TableRow></TableHeader><TableBody>{channels.map((item) => <TableRow key={item.channel} className="border-white/7"><TableCell className="font-medium text-white">{item.channel}</TableCell><TableCell>{item.leads}</TableCell><TableCell>{item.payments}</TableCell><TableCell>{money(item.revenueCents)}</TableCell><TableCell>{money(item.costCents)}</TableCell><TableCell>{money(item.leads ? item.costCents / item.leads : null)}</TableCell><TableCell>{money(item.payments ? item.costCents / item.payments : null)}</TableCell></TableRow>)}</TableBody></Table></div></article>;
}

function PartnersEvents({ data }: { data: DashboardData }) {
  return <div className="grid gap-4 xl:grid-cols-2">
    <article className="elite-card overflow-hidden"><div className="border-b border-white/8 p-5"><p className="section-kicker">Presença local</p><h3 className="text-lg font-semibold text-white">Parceiros</h3></div>{data.partners.length ? <div className="divide-y divide-white/7">{data.partners.slice(0, 12).map((item) => <div key={item.id} className="flex items-start justify-between gap-4 p-4"><div><p className="font-medium text-white">{item.name}</p><p className="mt-1 text-xs text-zinc-500">{item.cityName} · {item.type} · {item.contactName || "Sem contato"}</p><p className="mt-2 text-sm text-zinc-400">{item.nextAction || "Defina a próxima ação"}</p></div><Badge variant="outline" className={badgeClass(item.status)}>{item.status}</Badge></div>)}</div> : <EmptyState title="Nenhum parceiro" description="Cadastre quem pode abrir portas e espaços na cidade." icon={Handshake} />}</article>
    <article className="elite-card overflow-hidden"><div className="border-b border-white/8 p-5"><p className="section-kicker">Agenda local</p><h3 className="text-lg font-semibold text-white">Eventos</h3></div>{data.events.length ? <div className="divide-y divide-white/7">{data.events.slice(0, 12).map((item) => <div key={item.id} className="flex items-start justify-between gap-4 p-4"><div><p className="font-medium text-white">{item.name}</p><p className="mt-1 text-xs text-zinc-500">{item.cityName} · {dateOnly(item.eventDate)} · {item.ownerName || "Sem responsável"}</p><p className="mt-2 text-sm text-zinc-400">{item.reach} alcançados · {money(item.costCents)}</p></div><Badge variant="outline" className={badgeClass(item.status)}>{item.status}</Badge></div>)}</div> : <EmptyState title="Nenhum evento" description="Planeje uma ação local e registre seu responsável e custo." icon={CalendarDays} />}</article>
  </div>;
}

function Materials({ data }: { data: DashboardData }) {
  return <article className="elite-card overflow-hidden">{data.contents.length ? <div className="divide-y divide-white/7">{data.contents.slice(0, 50).map((item) => <div key={item.id} className="flex items-start justify-between gap-4 p-4"><div><p className="font-medium text-white">{item.title}</p><p className="mt-1 text-xs text-zinc-500">{item.cityName} · {item.type} · v{item.version}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-[#d6b94f]">Abrir material <ExternalLink className="size-3" /></a>}</div><Badge variant="outline" className={badgeClass(item.status)}>{item.status}</Badge></div>)}</div> : <EmptyState title="Nenhum material" description="Cadastre mensagens, vídeos, artes e roteiros antes da divulgação." icon={Library} />}</article>;
}

function Missions({ data, onCompleteTask, saving }: { data: DashboardData; onCompleteTask: (id: number) => void; saving: boolean }) {
  return <article className="elite-card overflow-hidden"><div className="border-b border-white/8 p-5"><p className="section-kicker">Execução da semana</p><h3 className="text-lg font-semibold text-white">Tarefas e missões</h3></div>{data.tasks.length ? <div className="divide-y divide-white/7">{data.tasks.slice(0, 20).map((item) => <div key={item.id} className="flex items-start justify-between gap-4 p-4"><div><p className="font-medium text-white">{item.title}</p><p className="mt-1 text-xs text-zinc-500">{item.ambassadorName} · {item.category} · {dateOnly(item.dueDate)}</p></div>{item.status === "Pendente" ? <Button size="sm" disabled={saving} onClick={() => onCompleteTask(item.id)} variant="outline" className="border-white/10 bg-white/5 text-white"><Check /> Concluir</Button> : <Badge variant="outline" className={badgeClass(item.status)}>{item.status}</Badge>}</div>)}</div> : <EmptyState title="Nenhuma tarefa" description="Crie missões simples com responsável e prazo." icon={ClipboardCheck} />}</article>;
}

function CostsPanel({ data, view }: { data: DashboardData; view: DashboardView }) {
  return <div className="space-y-5"><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Custo total" value={money(view.summary.costCents, true)} helper="Todas as categorias" icon={CircleDollarSign} /><Kpi label="Mídia paga" value={money(view.summary.mediaCostCents, true)} helper="Parcela usada no ROAS" icon={Megaphone} /><Kpi label="CAC" value={money(view.summary.cacCents)} helper="Custo ÷ clientes pagos" icon={TrendingDown} /><Kpi label="ROAS" value={multiple(view.summary.roas)} helper="Receita de mídia ÷ custo de mídia" icon={Target} /></section><ChannelTable channels={view.channels} />{view.filteredCosts.length > 0 && <article className="elite-card overflow-hidden"><div className="border-b border-white/8 p-5"><p className="section-kicker">Lançamentos</p><h3 className="text-lg font-semibold text-white">Custos registrados</h3></div><div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-white/8"><TableHead>Período</TableHead><TableHead>Cidade</TableHead><TableHead>Categoria</TableHead><TableHead>Canal</TableHead><TableHead>Valor</TableHead><TableHead>Observação</TableHead></TableRow></TableHeader><TableBody>{view.filteredCosts.slice(0, 100).map((item) => <TableRow key={item.id} className="border-white/7"><TableCell>{item.period}</TableCell><TableCell>{data.cities.find((city) => city.id === item.cityId)?.name}</TableCell><TableCell>{item.category}</TableCell><TableCell>{item.channel}</TableCell><TableCell>{money(item.amountCents)}</TableCell><TableCell>{item.note}</TableCell></TableRow>)}</TableBody></Table></div></article>}</div>;
}

function RulesPanel({ data, view, open }: { data: DashboardData; view: DashboardView; open: (dialog: DialogState) => void }) {
  return <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
    <article className="elite-card p-6"><div className="flex items-start justify-between gap-4"><div><p className="section-kicker">Regras visíveis</p><h3 className="text-xl font-semibold text-white">Critérios de decisão</h3></div><Button size="sm" onClick={() => open({ name: "settings" })} className="bg-[#c9a227] text-black"><Settings /> Editar</Button></div><dl className="mt-6 grid gap-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-zinc-500">Embaixadores ativos</dt><dd className="text-white">{data.settings.minActiveAmbassadors || "Não definido"}</dd></div><div className="flex justify-between gap-4"><dt className="text-zinc-500">Pagamentos mínimos</dt><dd className="text-white">{data.settings.minConfirmedPayments || "Não definido"}</dd></div><div className="flex justify-between gap-4"><dt className="text-zinc-500">Períodos mínimos</dt><dd className="text-white">{data.settings.minDataPeriods || "Não definido"}</dd></div><div className="flex justify-between gap-4"><dt className="text-zinc-500">Meta orgânica</dt><dd className="text-white">{data.settings.organicGoalPercent ? `${data.settings.organicGoalPercent}%` : "Sem exigência"}</dd></div><div className="flex justify-between gap-4"><dt className="text-zinc-500">Inatividade</dt><dd className="text-white">{data.settings.inactivityDays ? `${data.settings.inactivityDays} dias` : "Qualquer atividade registrada"}</dd></div><div className="flex justify-between gap-4"><dt className="text-zinc-500">Atribuição</dt><dd className="text-right text-white">{data.settings.attributionModel}</dd></div></dl><div className="mt-6 rounded-xl border border-white/8 bg-white/[0.025] p-4 text-sm leading-6 text-zinc-400">Custo por embaixador ativo: <strong className="text-white">{money(view.summary.costPerActiveAmbassadorCents)}</strong><p className="mt-1 text-xs text-zinc-500">Custos ligados ao canal, ao embaixador ou a recompensa autorizada ÷ embaixadores ativos.</p></div></article>
    <article className="elite-card p-6"><p className="section-kicker">Transparência</p><h3 className="text-xl font-semibold text-white">Como os indicadores são calculados</h3><dl className="mt-5 grid gap-3 text-sm leading-5 text-zinc-400 sm:grid-cols-2"><div><dt className="text-white">Conversão</dt><dd>Pagamentos confirmados ÷ leads válidos.</dd></div><div><dt className="text-white">CPL</dt><dd>Custos atribuíveis ÷ leads válidos.</dd></div><div><dt className="text-white">CAC</dt><dd>Custos atribuíveis ÷ clientes com pagamento confirmado.</dd></div><div><dt className="text-white">Participação orgânica</dt><dd>Leads válidos sem mídia paga ÷ total de leads válidos.</dd></div><div><dt className="text-white">ROAS</dt><dd>Receita atribuída à mídia ÷ investimento em mídia.</dd></div><div><dt className="text-white">ROI</dt><dd>(Receita atribuída − custo atribuível) ÷ custo atribuível.</dd></div><div><dt className="text-white">Ativação</dt><dd>Embaixadores ativos ÷ aprovados elegíveis.</dd></div><div><dt className="text-white">Sem base confiável</dt><dd>O painel mostra “Sem dados suficientes” e não divide por zero.</dd></div></dl></article>
  </div>;
}

function HistoryPanel({ data }: { data: DashboardData }) {
  return <article className="elite-card overflow-hidden">{data.auditLogs.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-white/8"><TableHead>Data</TableHead><TableHead>Responsável</TableHead><TableHead>Ação</TableHead><TableHead>Registro</TableHead><TableHead>Resumo</TableHead></TableRow></TableHeader><TableBody>{data.auditLogs.slice(0, 50).map((item) => <TableRow key={item.id} className="border-white/7"><TableCell>{dateTime(item.createdAt)}</TableCell><TableCell>{item.actorEmail}{item.advisory && <Badge variant="outline" className="ml-2 border-[#c9a227]/50 text-[#e8c766]">Assessoria Elite</Badge>}</TableCell><TableCell>{item.action}</TableCell><TableCell>{item.entityType} {item.entityId ? `#${item.entityId}` : ""}</TableCell><TableCell>{item.summary}</TableCell></TableRow>)}</TableBody></Table></div> : <EmptyState title="Nenhuma alteração registrada" description="As próximas ações importantes aparecerão aqui." icon={ShieldCheck} />}</article>;
}

function AdvisoryPanel({ data }: { data: DashboardData }) {
  return <article className="elite-card p-6"><p className="section-kicker">Acompanhamento</p><h3 className="text-lg font-semibold text-white">Quem da Elite acompanha a sua empresa</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">A equipe de assessoria da Elite Frascaroli Academy pode ver e editar os dados desta organização para mentorar e dar suporte à operação. Esse acesso faz parte do serviço contratado, e cada alteração feita pela assessoria aparece marcada no Histórico.</p><ul className="mt-4 flex flex-wrap gap-2">{data.advisors.map((advisor) => <li key={advisor.email} className="rounded-lg border border-[#c9a227]/30 bg-[#c9a227]/5 px-3 py-2 text-sm"><span className="font-medium text-white">{advisor.name}</span><span className="block text-xs text-zinc-500">{advisor.email}</span></li>)}</ul></article>;
}

function referralLink(base: string, code: string) {
  if (!base) return "";
  try { const url = new URL(base); url.searchParams.set("ref", code); return url.toString(); } catch { return ""; }
}

function AmbassadorPortal({ data, view, open, saving, save }: { data: DashboardData; view: DashboardView; open: (dialog: DialogState) => void; saving: boolean; save: (action: ActionName, payload: Record<string, unknown>) => void }) {
  const ambassador = view.ambassadors.find((item) => item.id === data.access.ambassadorId);
  if (!ambassador) return <main className="elite-grid grid min-h-screen place-items-center bg-[#080807] px-5"><section className="elite-card max-w-xl p-8 text-center"><h1 className="text-2xl font-semibold text-white">Perfil de embaixador incompleto</h1><p className="mt-3 text-zinc-400">Peça à coordenação para vincular seu e-mail a um embaixador.</p></section></main>;
  const link = referralLink(data.settings.referralBaseUrl, ambassador.code);
  const approvedContents = data.contents.filter((item) => item.status === "Aprovado");
  const pendingTasks = data.tasks.filter((item) => item.status === "Pendente");
  const qrUrl = link ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(link)}` : "";
  return <main className="elite-grid min-h-screen bg-[#080807] text-zinc-100"><header className="border-b border-white/8 bg-[#080807]/95"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><div className="flex items-center gap-3"><img src="/elite-emblem.png" alt="Elite Frascaroli Academy — logo oficial" width={541} height={541} className="elite-brand-logo" /><div><p className="font-semibold text-white">Portal do Embaixador</p><p className="text-xs text-zinc-500">{ambassador.cityName} · {ambassador.code}</p></div></div><Button asChild variant="ghost" size="icon" className="text-zinc-400"><a href="/api/auth/logout" aria-label="Sair"><LogOut /></a></Button></div></header><div className="mx-auto max-w-6xl space-y-6 px-4 py-7">
    <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="section-kicker">Olá, {ambassador.name}</p><h1 className="text-3xl font-semibold tracking-tight text-white">Sua missão e seus resultados</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Use somente os materiais aprovados e registre contatos que autorizaram o atendimento.</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => open({ name: "lead" })} className="bg-[#c9a227] text-black"><Plus /> Registrar lead</Button><Button onClick={() => open({ name: "ambassador-activity" })} variant="outline" className="border-white/10 bg-white/5 text-white"><Activity /> Registrar atividade</Button></div></section>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Situação" value={ambassador.isActive ? "Ativo" : "Em preparação"} helper={ambassador.isActive ? "Todos os critérios de ativação foram atendidos" : "Conclua as etapas abaixo"} icon={BadgeCheck} /><Kpi label="Leads válidos" value={String(ambassador.validLeads)} helper="Contatos autorizados atribuídos a você" icon={Megaphone} /><Kpi label="Clientes pagos" value={String(ambassador.confirmedPayments)} helper={`${ratio(ambassador.conversion)} de conversão`} icon={Trophy} /><Kpi label="Receita atribuída" value={money(ambassador.revenueCents, true)} helper="Pagamentos confirmados" icon={Banknote} /></section>
    <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]"><article className="elite-card p-6"><p className="section-kicker">Ativação</p><h2 className="text-xl font-semibold text-white">Seu progresso</h2><div className="mt-6 space-y-5"><div><div className="mb-2 flex justify-between text-sm"><span>Treinamento</span><span>{ambassador.trainingProgress}%</span></div><Progress value={ambassador.trainingProgress} className="bg-white/8 [&_[data-slot=progress-indicator]]:bg-[#c9a227]" /></div><div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 p-4"><div><p className="font-medium text-white">Regras do programa</p><p className="mt-1 text-xs text-zinc-500">{ambassador.termsAcceptedAt ? `Aceitas em ${dateOnly(ambassador.termsAcceptedAt)}` : "Aceite pendente"}</p></div>{ambassador.termsAcceptedAt ? <BadgeCheck className="text-emerald-300" /> : <Button size="sm" disabled={saving} onClick={() => save("accept_terms", { ambassadorId: ambassador.id, accepted: true })} className="bg-[#c9a227] text-black">Li e aceito</Button>}</div>{ambassador.trainingProgress < 100 && <Button disabled={saving} onClick={() => save("complete_training", { ambassadorId: ambassador.id })} variant="outline" className="w-full border-white/10 bg-white/5 text-white"><BookOpenCheck /> Concluir treinamento</Button>}</div></article><article className="elite-card p-6"><p className="section-kicker">Seu link</p><h2 className="text-xl font-semibold text-white">Indicação rastreada</h2>{link ? <div className="mt-5 flex flex-col gap-5 sm:flex-row"><img src={qrUrl} alt={`QR Code de ${ambassador.name}`} referrerPolicy="no-referrer" className="size-40 rounded-xl bg-white p-2" /><div className="min-w-0 flex-1"><p className="break-all rounded-xl border border-white/8 bg-black/20 p-3 text-xs leading-5 text-zinc-400">{link}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={async () => { const copied = await copyText(link); if (copied) toast.success("Link copiado."); else toast.error("Não foi possível copiar. Selecione o link manualmente."); }} className="bg-[#c9a227] text-black"><Copy /> Copiar link</Button><Button asChild size="sm" variant="outline" className="border-white/10 bg-white/5 text-white"><a href={qrUrl} target="_blank" rel="noreferrer"><ExternalLink /> Abrir QR</a></Button></div><p className="mt-4 text-xs leading-5 text-zinc-500">O QR contém somente o link e seu código. Não contém dados de leads.</p></div></div> : <EmptyState title="Link-base ainda não configurado" description="A coordenação precisa definir a página ou o WhatsApp de destino antes de divulgar." icon={Target} />}</article></section>
    <section className="grid gap-4 lg:grid-cols-2"><article className="elite-card overflow-hidden"><div className="border-b border-white/8 p-5"><p className="section-kicker">Semana atual</p><h2 className="text-lg font-semibold text-white">Missões pendentes</h2></div>{pendingTasks.length ? <div className="divide-y divide-white/7">{pendingTasks.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium text-white">{item.title}</p><p className="mt-1 text-xs text-zinc-500">{item.category} · {dateOnly(item.dueDate)}</p></div><Button size="sm" disabled={saving} onClick={() => save("complete_task", { taskId: item.id })} variant="outline" className="border-white/10 bg-white/5 text-white"><Check /> Concluir</Button></div>)}</div> : <EmptyState title="Nenhuma missão pendente" description="As novas tarefas aparecerão aqui." icon={ClipboardCheck} />}</article><article className="elite-card overflow-hidden"><div className="border-b border-white/8 p-5"><p className="section-kicker">Biblioteca aprovada</p><h2 className="text-lg font-semibold text-white">Materiais para divulgar</h2></div>{approvedContents.length ? <div className="divide-y divide-white/7">{approvedContents.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium text-white">{item.title}</p><p className="mt-1 text-xs text-zinc-500">{item.type} · {item.channel} · v{item.version}</p></div>{item.url && <Button asChild size="sm" variant="ghost" className="text-[#d6b94f]"><a href={item.url} target="_blank" rel="noreferrer">Abrir <ExternalLink /></a></Button>}</div>)}</div> : <EmptyState title="Nenhum material aprovado" description="Não publique materiais que ainda estejam em revisão." icon={Library} />}</article></section>
  </div></main>;
}

function exportCsv(view: DashboardView) {
  const rows = [
    ["Cidade", "Fonte", "Leads válidos", "Pagamentos", "Receita", "Custo", "CAC", "Orgânico", "Decisão"],
    ...view.cities.map((city) => [city.name, city.dataSource, city.validLeads, city.confirmedPayments, city.revenueCents / 100, city.costCents / 100, city.cacCents === null ? "" : city.cacCents / 100, city.organicShare === null ? "" : city.organicShare, city.decision]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `elite-expansao-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

const MANAGEMENT_ROLES = ["Administrador", "Coordenação", "Líder"];
/** Sub-abas de Vendas que são visões do acompanhamento (a de Pagamentos é outra tela). */
const FOLLOWUP_VIEWS = { agenda: "agenda", atendimentos: "table", fecha: "fecha", posvenda: "aftercare" } as const;
/** Onde a barra de filtros (cidade, período, canal, líder, embaixador) vale. */
const FILTERED = ["territorio/cidades", "rede/embaixadores", "vendas/pagamentos", "resultados/visao", "resultados/custos"];

export function ExpansionDashboard({ initialData, userName, signOutPath, initialArea, initialView }: { initialData: DashboardData; userName: string; signOutPath: string; initialArea?: string | null; initialView?: string | null }) {
  const [data, setData] = useState(initialData);
  const [filters, setFilters] = useState<DashboardFilters>({ ...EMPTY_FILTERS });
  const [dialog, setDialog] = useState<DialogState>(null);
  const [saving, setSaving] = useState(false);
  const [mapPersonId, setMapPersonId] = useState<string | undefined>();
  const [followupLeadId, setFollowupLeadId] = useState<number | undefined>();
  const [mapLeadId, setMapLeadId] = useState<number | undefined>();
  const [mappingOpen, setMappingOpen] = useState(false);
  // Atendimentos: lista de acompanhamento ou dados das oportunidades (etapa, temperatura, empresa).
  const [salesMode, setSalesMode] = useState<"lista" | "dados">("lista");
  // Muda a cada "+ Novo → Convidar pessoa": reabre Time e acessos com o convite aberto.
  const [inviteRequest, setInviteRequest] = useState(0);
  const areas = useMemo(() => navigationFor(data.access, { hasAdvisors: data.advisors.length > 0 }), [data.access, data.advisors.length]);
  const [location, setLocation] = useState<NavLocation>(() => resolveLocation(areas, initialData.access, initialArea, initialView));
  const view = useMemo(() => buildDashboardView(data, filters), [data, filters]);
  const fullView = useMemo(() => buildDashboardView(data, EMPTY_FILTERS), [data]);
  const areasRef = useRef(areas);
  areasRef.current = areas;

  // Área e sub-aba ficam no endereço: links diretos e o botão voltar do navegador funcionam.
  useEffect(() => {
    const onPop = () => { const p = new URLSearchParams(window.location.search); setLocation(resolveLocation(areasRef.current, data.access, p.get("area"), p.get("ver"))); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [data.access]);

  function navigate(next: NavLocation, { invite = false }: { invite?: boolean } = {}) {
    setInviteRequest((value) => (invite ? value + 1 : 0));
    if (next.area === location.area && next.view === location.view) return;
    setLocation(next);
    const url = new URL(window.location.href);
    url.searchParams.set("area", next.area);
    if (next.view) url.searchParams.set("ver", next.view); else url.searchParams.delete("ver");
    window.history.pushState(null, "", url);
    window.scrollTo({ top: 0 });
  }
  /** "mapear" abre o mapeamento guiado; "area/sub-aba" leva até a tela. */
  const go = (target: string) => {
    if (target === "mapear") { setMappingOpen(true); return; }
    const { area, view: sub } = parseTarget(target);
    navigate(resolveLocation(areas, data.access, area, sub));
  };
  const openFollowup = (leadId: number) => { setFollowupLeadId(leadId); setSalesMode("lista"); navigate({ area: "vendas", view: "agenda" }); };
  const openMapPerson = (personId: string) => { setMapPersonId(personId); setMapLeadId(undefined); navigate({ area: "territorio", view: "mapa" }); };
  const openMapLead = (leadId: number) => { setMapPersonId(undefined); setMapLeadId(leadId); navigate({ area: "territorio", view: "mapa" }); };

  async function refreshDashboard(){const r=await tenantFetch("/api/dashboard");const v=await r.json();if(!r.ok)throw new Error(v.error);setData(v.data);}
  const savingLock = useRef(false);
  async function save(action: ActionName, payload: Record<string, unknown>) {
    if (savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    try {
      const response = await tenantFetch("/api/dashboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data: payload }) });
      const result = await response.json() as { data?: DashboardData; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || "Não foi possível salvar.");
      setData(result.data); setDialog(null); toast.success(successMessage[action] ?? "Registro salvo e indicadores atualizados.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { savingLock.current = false; setSaving(false); }
  }

  if (data.access.role === "Embaixador") {
    return <><AmbassadorPortal data={data} view={view} open={setDialog} saving={saving} save={save} /><WelcomeDialog access={data.access} onStart={() => undefined} /><ExpansionDialog dialog={dialog} data={data} saving={saving} onClose={() => setDialog(null)} onSave={save} /></>;
  }

  const manage = MANAGEMENT_ROLES.includes(data.access.role);
  const canMap = data.access.active && [...MANAGEMENT_ROLES, "Comercial"].includes(data.access.role);
  const canCity = canPerform(data.access, "create_city");
  const canAmbassador = canPerform(data.access, "create_ambassador");
  const canPipeline = canPerform(data.access, "create_lead");
  const canSale = canPerform(data.access, "record_sale");
  const canCost = canPerform(data.access, "create_cost");
  const canOperation = canPerform(data.access, "create_partner");
  const canContent = canPerform(data.access, "create_content");
  const canTask = canPerform(data.access, "create_task");
  const canImport = canMap && data.plan?.imports !== false;
  const eligibleLeads = data.leads.filter((lead) => lead.status !== "Cancelado" && !lead.consentRevokedAt);
  const pending = (data.agenda?.late ?? 0) + (data.agenda?.today ?? 0);
  const noCity = !data.cities.length ? "sem cidade" : undefined;

  const when = (condition: boolean, ...items: NewAction[]) => (condition ? items : []);
  const actions: NewAction[] = [
    ...when(canMap, { id: "mapear", label: "Mapear local e pessoas", icon: MapPin, group: "dia", disabled: noCity, run: () => setMappingOpen(true) }),
    ...when(canMap, { id: "atendimento-mapa", label: "Atendimento · pessoa do mapa", icon: Users, group: "dia", run: () => { navigate({ area: "territorio", view: "mapa" }); toast.info("Clique na pessoa no mapa e use “Iniciar atendimento”."); } }),
    ...when(canPipeline, { id: "atendimento-novo", label: "Atendimento · contato novo", icon: UserPlus, group: "dia", disabled: noCity, run: () => setDialog({ name: "lead" }) }),
    ...when(canSale, { id: "venda", label: "Venda e pagamento", icon: Banknote, group: "dia", disabled: !eligibleLeads.length ? "sem atendimento" : undefined, run: () => setDialog({ name: "sale" }) }),
    ...when(canCity, { id: "cidade", label: "Cidade", icon: MapPin, group: "cadastro", run: () => setDialog({ name: "city" }) }),
    ...when(canAmbassador, { id: "embaixador", label: "Embaixador", icon: Users, group: "cadastro", disabled: noCity, run: () => setDialog({ name: "ambassador" }) }),
    ...when(canOperation, { id: "parceiro", label: "Parceiro", icon: Handshake, group: "cadastro", disabled: noCity, run: () => setDialog({ name: "partner" }) }, { id: "evento", label: "Evento", icon: CalendarDays, group: "cadastro", disabled: noCity, run: () => setDialog({ name: "event" }) }),
    ...when(canContent, { id: "material", label: "Material", icon: Library, group: "cadastro", run: () => setDialog({ name: "content" }) }),
    ...when(canTask, { id: "tarefa", label: "Tarefa ou missão", icon: ClipboardCheck, group: "cadastro", disabled: !data.ambassadors.length ? "sem embaixador" : undefined, run: () => setDialog({ name: "task" }) }),
    ...when(canCost, { id: "custo", label: "Custo", icon: CircleDollarSign, group: "cadastro", disabled: noCity, run: () => setDialog({ name: "cost" }) }),
    ...when(data.access.role === "Administrador", { id: "convidar", label: "Convidar pessoa", icon: UserPlus, group: "cadastro", run: () => navigate({ area: "gestao", view: "time" }, { invite: true }) }),
  ];

  const here = `${location.area}/${location.view}`;
  const showFilters = data.access.role !== "Comercial" && FILTERED.includes(here);
  const attributionWarning = showFilters && (filters.channel || filters.ambassadorId !== null) && view.cities.some((city) => city.dataSource === "Consolidado");
  const followupView = location.area === "vendas" && !(location.view === "atendimentos" && salesMode === "dados") ? FOLLOWUP_VIEWS[location.view as keyof typeof FOLLOWUP_VIEWS] : undefined;
  const outline = "border-white/10 bg-white/5 text-white";

  return <>
    <AppShell access={data.access} userName={userName} signOutPath={signOutPath} areas={areas} location={location} badges={pending ? { vendas: pending } : {}} actions={actions} onNavigate={(next) => navigate(next)}>
      <div className="space-y-5">
        {showFilters && <FilterBar data={data} filters={filters} onChange={setFilters} />}
        {attributionWarning && <div className="flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100"><AlertTriangle className="mt-1 size-4 shrink-0" />Filtros por canal ou embaixador não usam fechamentos consolidados, pois eles não possuem atribuição individual. Cidades detalhadas continuam sendo calculadas normalmente.</div>}

        {location.area === "hoje" && <TodayPanel data={data} view={fullView} onGo={go} onFollowup={openFollowup} />}

        {here === "territorio/mapa" && <>{canMap && <ActionBar hint="Locais e pessoas de cada cidade. Pessoas aparecem no local ligado a elas, nunca na residência."><Button disabled={!data.cities.length} title={!data.cities.length ? "Cadastre uma cidade primeiro." : undefined} onClick={() => setMappingOpen(true)} className="bg-[#c9a227] text-black"><MapPin /> Mapear local e pessoas</Button></ActionBar>}<TerritorialMap key={mapPersonId || mapLeadId || "map"} focusPersonId={mapPersonId} focusLeadId={mapLeadId} onFollowup={openFollowup} view={fullView} data={data} onOpen={manage ? setDialog : undefined} onRefresh={refreshDashboard} onConfigureCity={canPerform(data.access, "update_city") ? (id) => setDialog({ name: "city-edit", entityId: id }) : undefined} />{canImport && <PeopleImport data={data} onSaved={refreshDashboard} />}</>}
        {here === "territorio/cidades" && <><ActionBar hint="Saúde de cada cidade, decisão registrada e fechamentos consolidados.">{canPerform(data.access, "record_city") && <Button onClick={() => setDialog({ name: "city-result" })} variant="outline" className={outline}><Activity /> Fechamento consolidado</Button>}{canCity && <Button onClick={() => setDialog({ name: "city" })} className="bg-[#c9a227] text-black">Nova cidade</Button>}</ActionBar><CityTable cities={view.cities} onEdit={canPerform(data.access, "update_city") ? (id) => setDialog({ name: "city-edit", entityId: id }) : undefined} /><TerritoryDecisions data={data} /></>}
        {here === "territorio/locais" && <CommercialWorkspace data={data} mode="businesses" onRefresh={refreshDashboard} />}

        {location.area === "vendas" && location.view === "atendimentos" && <div className="elite-segmented" role="group" aria-label="Como ver os atendimentos"><button type="button" aria-pressed={salesMode === "lista"} onClick={() => setSalesMode("lista")}>Acompanhamento</button><button type="button" aria-pressed={salesMode === "dados"} onClick={() => setSalesMode("dados")}>Dados das oportunidades</button></div>}
        {followupView && <FollowupWorkspace key={followupLeadId ?? "all"} view={followupView} data={data} focusLeadId={followupLeadId} onRefresh={refreshDashboard} onMap={openMapPerson} onLead={(id) => setDialog({ name: "lead-status", entityId: id })} onSale={(id) => setDialog({ name: "sale", entityId: id })} onNewLead={() => setDialog({ name: "lead" })} onCRM={() => { setSalesMode("dados"); navigate({ area: "vendas", view: "atendimentos" }); }} />}
        {here === "vendas/atendimentos" && salesMode === "dados" && <CommercialWorkspace data={data} mode="pipeline" onFollowup={openFollowup} onRefresh={refreshDashboard} />}
        {here === "vendas/pagamentos" && <><ActionBar hint="Cada atendimento com a etapa, a venda e o valor. A receita só conta depois do pagamento confirmado.">{canSale && <Button disabled={!eligibleLeads.length} title={!eligibleLeads.length ? "Comece um atendimento antes de registrar uma venda." : undefined} onClick={() => setDialog({ name: "sale" })} className="bg-[#c9a227] text-black"><Banknote /> Venda e pagamento</Button>}</ActionBar><Pipeline view={view} onMap={openMapLead} onLead={(id) => setDialog({ name: "lead-status", entityId: id })} onSale={(id) => setDialog({ name: "sale", entityId: id })} canEdit={canPerform(data.access, "update_lead") || canSale} /></>}

        {here === "rede/embaixadores" && <><ActionBar hint="Etapa, treinamento, atividade e resultado de cada embaixador, e as missões da semana.">{canPerform(data.access, "record_ambassador") && <Button disabled={!data.ambassadors.length} title={!data.ambassadors.length ? "Cadastre um embaixador antes de registrar atividade." : undefined} onClick={() => setDialog({ name: "ambassador-activity" })} variant="outline" className={outline}><Activity /> Atividade</Button>}{canTask && <Button disabled={!data.ambassadors.length} onClick={() => setDialog({ name: "task" })} variant="outline" className={outline}><ClipboardCheck /> Tarefa</Button>}{canAmbassador && <Button onClick={() => setDialog({ name: "ambassador" })} className="bg-[#c9a227] text-black">Cadastrar embaixador</Button>}</ActionBar><AmbassadorTable ambassadors={view.ambassadors} onEdit={canPerform(data.access, "update_ambassador") ? (id) => setDialog({ name: "ambassador-edit", entityId: id }) : undefined} /><Missions data={data} onCompleteTask={(id) => save("complete_task", { taskId: id })} saving={saving} /></>}
        {here === "rede/indicacoes" && <FollowupWorkspace view="network" data={data} onFocusLead={openFollowup} onRefresh={refreshDashboard} onMap={openMapPerson} onLead={(id) => setDialog({ name: "lead-status", entityId: id })} onSale={(id) => setDialog({ name: "sale", entityId: id })} onNewLead={() => setDialog({ name: "lead" })} onCRM={() => navigate({ area: "vendas", view: "atendimentos" })} />}
        {here === "rede/mentorados" && <PortalAdmin data={data} onGo={go} />}
        {here === "rede/parceiros" && <><ActionBar hint="Quem abre portas na cidade e as ações locais planejadas.">{canOperation && <><Button onClick={() => setDialog({ name: "partner" })} variant="outline" className={outline}><Handshake /> Parceiro</Button><Button onClick={() => setDialog({ name: "event" })} className="bg-[#c9a227] text-black"><CalendarDays /> Evento</Button></>}</ActionBar><PartnersEvents data={data} /></>}
        {here === "rede/materiais" && <><ActionBar hint="Mensagens, vídeos e roteiros aprovados. Escolha para quem: embaixadores, mentorados ou todos.">{canContent && <Button onClick={() => setDialog({ name: "content" })} className="bg-[#c9a227] text-black"><Library /> Material</Button>}</ActionBar><Materials data={data} /></>}

        {here === "resultados/visao" && <ResultsOverview view={view} canExport={data.plan?.exports !== false} />}
        {here === "resultados/metas" && <CommercialWorkspace data={data} mode="team" onRefresh={refreshDashboard} />}
        {here === "resultados/mapeamento" && (data.mappingStats ? <MappingStatsPanel stats={data.mappingStats} /> : <article className="elite-card"><EmptyState title="Sem dados de mapeamento" description="Os indicadores aparecem quando houver locais e pessoas no mapa." /></article>)}
        {here === "resultados/custos" && <><ActionBar hint="Quanto custa cada resultado, por origem.">{canCost && <Button onClick={() => setDialog({ name: "cost" })} className="bg-[#c9a227] text-black"><CircleDollarSign /> Registrar custo</Button>}</ActionBar><CostsPanel data={data} view={view} /></>}

        {here === "gestao/time" && <TeamPanel key={inviteRequest} startInvite={inviteRequest > 0} data={data} onData={setData} onRefresh={refreshDashboard} open={setDialog} />}
        {here === "gestao/regras" && <RulesPanel data={data} view={view} open={setDialog} />}
        {here === "gestao/plano" && data.plan && <PlanCard plan={data.plan} organization={data.access.organizationName} />}
        {here === "gestao/historico" && <HistoryPanel data={data} />}
        {here === "gestao/assessoria" && <AdvisoryPanel data={data} />}

        {here === "plataforma/assinaturas" && <SubscriptionsPanel />}
        {here === "plataforma/assessores" && <AdvisorsPanel />}
      </div>
    </AppShell>
    <ExpansionDialog dialog={dialog} data={data} saving={saving} onClose={() => setDialog(null)} onSave={save} />
    <WelcomeDialog access={data.access} onStart={go} />
    {canMap && <MappingWizard open={mappingOpen} data={data} onClose={() => setMappingOpen(false)} onSaved={refreshDashboard} />}
  </>;
}
