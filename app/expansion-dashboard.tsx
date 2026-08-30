"use client";

import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  CircleDollarSign,
  LogOut,
  MapPin,
  Megaphone,
  Plus,
  Radio,
  Target,
  TrendingDown,
  Trophy,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AmbassadorView, CityView, DashboardData } from "@/lib/expansion-types";

type DialogName = "city" | "ambassador" | "city-result" | "ambassador-result" | null;
type ActionName = "create_city" | "create_ambassador" | "record_city" | "record_ambassador";

const chartConfig = {
  cac: { label: "Custo por venda", color: "#c9a227" },
  cpl: { label: "Custo por lead", color: "#5b6575" },
} satisfies ChartConfig;

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
const decimalMoney = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(cents / 100);
const percent = (value: number) => `${Math.round(value)}%`;
const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const centsFromInput = (value: FormDataEntryValue | null) => Math.round(Number(value || 0) * 100);

function cityDecision(city: CityView) {
  if (city.leads === 0 && city.costCents === 0) return "Preparar";
  if (city.sales === 0 && city.costCents > 0) return "Corrigir";
  const cac = city.sales ? city.costCents / city.sales : 0;
  const targetOk = city.targetCacCents === 0 || cac <= city.targetCacCents;
  if (city.sales >= 3 && city.activeAmbassadors >= 3 && targetOk) return "Avançar";
  return "Ajustar";
}

function badgeClass(value: string) {
  if (["Ativa", "Ativo", "Líder local", "Avançar"].includes(value)) return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (["Corrigir", "Pausada", "Suspenso"].includes(value)) return "border-red-400/30 bg-red-400/10 text-red-300";
  if (["Preparar", "Planejada", "Preparação", "Em espera", "Candidato"].includes(value)) return "border-slate-400/30 bg-slate-400/10 text-slate-300";
  return "border-amber-300/30 bg-amber-300/10 text-amber-200";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium text-zinc-200"><span>{label}</span>{children}</label>;
}

function Kpi({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: typeof Users }) {
  return (
    <article className="elite-card group relative overflow-hidden p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
        <span className="rounded-xl border border-[#c9a227]/20 bg-[#c9a227]/10 p-2 text-[#d6b94f]"><Icon className="size-4" /></span>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{helper}</p>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/60 to-transparent opacity-0 transition group-hover:opacity-100" />
    </article>
  );
}

export function ExpansionDashboard({ initialData, userName, signOutPath }: { initialData: DashboardData; userName: string; signOutPath: string }) {
  const [data, setData] = useState(initialData);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [saving, setSaving] = useState(false);
  const summary = data.summary;
  const cac = summary.sales ? summary.costCents / summary.sales : 0;
  const cpl = summary.leads ? summary.costCents / summary.leads : 0;
  const organicShare = summary.leads ? (summary.organicLeads / summary.leads) * 100 : 0;

  const chartData = useMemo(() => data.cities.map((city) => ({
    city: city.name,
    cac: city.sales ? Math.round(city.costCents / city.sales) / 100 : 0,
    cpl: city.leads ? Math.round(city.costCents / city.leads) / 100 : 0,
  })), [data.cities]);

  const pilot = data.cities.find((city) => city.phase === "Piloto") ?? data.cities[0];
  const nextStep = !pilot
    ? "Cadastre a primeira cidade da expansão."
    : pilot.activeAmbassadors < 3
      ? `Ative pelo menos 3 embaixadores em ${pilot.name} antes de aumentar o investimento.`
      : pilot.leads === 0
        ? `Registre os primeiros resultados de ${pilot.name} para medir o custo real.`
        : cityDecision(pilot) === "Avançar"
          ? `${pilot.name} atingiu o nível mínimo. Prepare a próxima cidade mantendo o mesmo método.`
          : `Ajuste a operação de ${pilot.name} antes de abrir uma nova cidade.`;

  async function save(action: ActionName, payload: Record<string, unknown>) {
    setSaving(true);
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, data: payload }),
      });
      const result = await response.json() as { data?: DashboardData; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || "Não foi possível salvar.");
      setData(result.data);
      setDialog(null);
      toast.success("Registro salvo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="elite-grid min-h-screen bg-[#080807] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#080807]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-[#c9a227]/35 bg-gradient-to-br from-[#d7b747] to-[#7a5a00] text-sm font-black text-black">EF</div>
            <div><p className="font-semibold tracking-tight text-white">Elite Expansão</p><p className="text-xs text-zinc-500">Comando de cidades e embaixadores</p></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-52 truncate text-sm text-zinc-400 sm:block">{userName}</span>
            <Button asChild variant="ghost" size="icon" className="text-zinc-400 hover:bg-white/5 hover:text-white"><a href={signOutPath} aria-label="Sair"><LogOut /></a></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#c9a227]"><Radio className="size-3.5" /> operação em tempo real</p><h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Espalhar a mensagem.<br /><span className="text-zinc-500">Reduzir o custo a cada cidade.</span></h1></div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDialog("city-result")} className="bg-[#c9a227] text-black hover:bg-[#ddbd48]"><Activity /> Registrar resultado</Button>
            <Button onClick={() => setDialog("ambassador")} variant="outline" className="border-white/12 bg-white/4 text-white hover:bg-white/8"><Users /> Novo embaixador</Button>
            <Button onClick={() => setDialog("city")} variant="outline" className="border-white/12 bg-white/4 text-white hover:bg-white/8"><Plus /> Nova cidade</Button>
          </div>
        </section>

        <Tabs defaultValue="visao" className="gap-6">
          <TabsList variant="line" className="w-full justify-start gap-5 overflow-x-auto border-b border-white/8 pb-0">
            <TabsTrigger value="visao" className="px-0 pb-3 text-zinc-500 data-[state=active]:text-[#d6b94f]">Visão geral</TabsTrigger>
            <TabsTrigger value="cidades" className="px-0 pb-3 text-zinc-500 data-[state=active]:text-[#d6b94f]">Cidades</TabsTrigger>
            <TabsTrigger value="embaixadores" className="px-0 pb-3 text-zinc-500 data-[state=active]:text-[#d6b94f]">Embaixadores</TabsTrigger>
            <TabsTrigger value="custos" className="px-0 pb-3 text-zinc-500 data-[state=active]:text-[#d6b94f]">Custos e alcance</TabsTrigger>
          </TabsList>

          <TabsContent value="visao" className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Kpi label="Cidades ativas" value={`${summary.activeCities}/${summary.plannedCities}`} helper="Pilotos e núcleos em operação" icon={MapPin} />
              <Kpi label="Embaixadores" value={formatNumber(summary.activeAmbassadors)} helper="Ativos e líderes locais" icon={Users} />
              <Kpi label="Leads" value={formatNumber(summary.leads)} helper={`${percent(organicShare)} vieram sem mídia paga`} icon={Megaphone} />
              <Kpi label="Vendas" value={formatNumber(summary.sales)} helper={money(summary.revenueCents) + " em receita"} icon={Trophy} />
              <Kpi label="Investimento" value={money(summary.costCents)} helper={decimalMoney(cpl) + " por lead"} icon={CircleDollarSign} />
              <Kpi label="Custo por venda" value={decimalMoney(cac)} helper="Meta: cair a cada nova cidade" icon={TrendingDown} />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
              <article className="elite-card p-5 sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-4"><div><p className="section-kicker">Eficiência por cidade</p><h2 className="section-title">Onde cada real trabalha melhor</h2></div><Badge variant="outline" className="border-[#c9a227]/30 text-[#d6b94f]">CAC x CPL</Badge></div>
                <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto">
                  <BarChart data={chartData} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="4 4" />
                    <XAxis dataKey="city" tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis tickLine={false} axisLine={false} width={46} tickFormatter={(value) => `R$${value}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="cac" fill="var(--color-cac)" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="cpl" fill="var(--color-cpl)" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </article>
              <article className="relative overflow-hidden rounded-2xl border border-[#c9a227]/25 bg-gradient-to-br from-[#211d10] to-[#0f0e0a] p-6">
                <div className="absolute right-0 top-0 size-44 rounded-full bg-[#c9a227]/8 blur-3xl" />
                <p className="section-kicker">Próxima decisão</p><Target className="my-7 size-10 text-[#d6b94f]" /><h2 className="max-w-md text-2xl font-semibold leading-tight text-white">{nextStep}</h2><p className="mt-4 text-sm leading-6 text-zinc-400">Só avance quando a cidade atual provar resultado, liderança local e um custo que caiba na meta.</p>
              </article>
            </section>

            <CityTable cities={data.cities} compact />
          </TabsContent>

          <TabsContent value="cidades" className="space-y-5">
            <div className="flex items-center justify-between gap-4"><div><p className="section-kicker">Expansão controlada</p><h2 className="section-title">Cidade por cidade</h2></div><Button onClick={() => setDialog("city-result")} className="bg-[#c9a227] text-black hover:bg-[#ddbd48]"><Plus /> Registrar cidade</Button></div>
            <CityTable cities={data.cities} />
          </TabsContent>

          <TabsContent value="embaixadores" className="space-y-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="section-kicker">Força local</p><h2 className="section-title">Embaixadores e líderes</h2></div><div className="flex gap-2"><Button onClick={() => setDialog("ambassador-result")} variant="outline" className="border-white/12 bg-white/4 text-white hover:bg-white/8"><Activity /> Registrar produção</Button><Button onClick={() => setDialog("ambassador")} className="bg-[#c9a227] text-black hover:bg-[#ddbd48]"><Plus /> Cadastrar</Button></div></div>
            <AmbassadorTable ambassadors={data.ambassadors} />
          </TabsContent>

          <TabsContent value="custos" className="space-y-5">
            <div><p className="section-kicker">Menos dependência de anúncios</p><h2 className="section-title">Custos, alcance e indicação</h2></div>
            <section className="grid gap-4 lg:grid-cols-3">
              <article className="elite-card p-6 lg:col-span-2"><p className="section-kicker">Comparação</p><h3 className="mb-6 text-xl font-semibold text-white">Custo por cidade</h3><ChartContainer config={chartConfig} className="h-[330px] w-full aspect-auto"><BarChart data={chartData} layout="vertical" margin={{ left: 18 }}><CartesianGrid horizontal={false} strokeDasharray="4 4" /><XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} /><YAxis dataKey="city" type="category" tickLine={false} axisLine={false} width={105} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="cac" fill="var(--color-cac)" radius={[0, 6, 6, 0]} /></BarChart></ChartContainer></article>
              <article className="elite-card p-6"><p className="section-kicker">Últimos registros</p><h3 className="mb-5 text-xl font-semibold text-white">Movimento recente</h3>{data.recentUpdates.length ? <div className="grid gap-3">{data.recentUpdates.map((item) => <div key={item.id} className="rounded-xl border border-white/7 bg-black/20 p-4"><div className="flex items-center justify-between gap-3"><p className="font-medium text-white">{item.cityName}</p><span className="text-xs text-zinc-500">{item.period}</span></div><p className="mt-2 text-sm text-zinc-400">{item.leads} leads · {item.sales} vendas · {money(item.costCents)}</p></div>)}</div> : <EmptyState title="Nenhum resultado registrado" description="Registre o primeiro período para começar a comparar os custos." />}</article>
            </section>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#11110f] text-white sm:max-w-2xl">
          {dialog === "city" && <CityForm saving={saving} onSave={(payload) => save("create_city", payload)} />}
          {dialog === "ambassador" && <AmbassadorForm cities={data.cities} saving={saving} onSave={(payload) => save("create_ambassador", payload)} />}
          {dialog === "city-result" && <CityResultForm cities={data.cities} saving={saving} onSave={(payload) => save("record_city", payload)} />}
          {dialog === "ambassador-result" && <AmbassadorResultForm ambassadors={data.ambassadors} saving={saving} onSave={(payload) => save("record_ambassador", payload)} />}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function CityTable({ cities, compact = false }: { cities: CityView[]; compact?: boolean }) {
  return <article className="elite-card overflow-hidden"><div className="border-b border-white/8 px-5 py-4"><p className="section-kicker">Mapa de expansão</p><h2 className="text-lg font-semibold text-white">Saúde dos núcleos</h2></div><Table><TableHeader><TableRow className="border-white/8 hover:bg-transparent"><TableHead>Cidade</TableHead><TableHead>Fase</TableHead><TableHead>Embaixadores</TableHead><TableHead>Leads</TableHead><TableHead>Vendas</TableHead><TableHead>Investimento</TableHead><TableHead>CAC</TableHead>{!compact && <TableHead>Orgânico</TableHead>}<TableHead>Decisão</TableHead></TableRow></TableHeader><TableBody>{cities.map((city) => { const cac = city.sales ? city.costCents / city.sales : 0; const organic = city.leads ? (city.organicLeads / city.leads) * 100 : 0; const progress = city.salesGoal ? Math.min(100, (city.sales / city.salesGoal) * 100) : 0; const decision = cityDecision(city); return <TableRow key={city.id} className="border-white/7 hover:bg-white/[0.025]"><TableCell><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-white/5 text-[#d6b94f]"><MapPin className="size-4" /></span><div><p className="font-medium text-white">{city.name}</p><p className="text-xs text-zinc-500">{city.state} · {city.leaderName || "Sem líder"}</p></div></div></TableCell><TableCell><Badge variant="outline" className={badgeClass(city.phase)}>{city.phase}</Badge></TableCell><TableCell><div className="min-w-28"><div className="mb-2 flex justify-between text-xs"><span>{city.activeAmbassadors}</span><span className="text-zinc-500">meta {city.ambassadorGoal}</span></div><Progress value={city.ambassadorGoal ? Math.min(100, city.activeAmbassadors / city.ambassadorGoal * 100) : 0} className="bg-white/8 [&_[data-slot=progress-indicator]]:bg-[#c9a227]" /></div></TableCell><TableCell>{formatNumber(city.leads)}</TableCell><TableCell><div><p className="font-medium text-white">{formatNumber(city.sales)}</p><Progress value={progress} className="mt-2 w-20 bg-white/8 [&_[data-slot=progress-indicator]]:bg-emerald-400" /></div></TableCell><TableCell>{money(city.costCents)}</TableCell><TableCell>{decimalMoney(cac)}</TableCell>{!compact && <TableCell>{percent(organic)}</TableCell>}<TableCell><Badge variant="outline" className={badgeClass(decision)}>{decision}</Badge></TableCell></TableRow>; })}</TableBody></Table></article>;
}

function AmbassadorTable({ ambassadors }: { ambassadors: AmbassadorView[] }) {
  if (!ambassadors.length) return <article className="elite-card p-8"><EmptyState title="Nenhum embaixador cadastrado" description="Comece pela cidade-piloto e cadastre as primeiras pessoas que já acreditam na mensagem." /></article>;
  return <article className="elite-card overflow-hidden"><Table><TableHeader><TableRow className="border-white/8 hover:bg-transparent"><TableHead>Embaixador</TableHead><TableHead>Cidade</TableHead><TableHead>Nível</TableHead><TableHead>Status</TableHead><TableHead>Leads</TableHead><TableHead>Vendas</TableHead><TableHead>Conversão</TableHead><TableHead>Custo por venda</TableHead></TableRow></TableHeader><TableBody>{ambassadors.map((item) => <TableRow key={item.id} className="border-white/7 hover:bg-white/[0.025]"><TableCell><div><p className="font-medium text-white">{item.name}</p><p className="text-xs text-zinc-500">{item.code}{item.whatsapp ? ` · ${item.whatsapp}` : ""}</p></div></TableCell><TableCell>{item.cityName}</TableCell><TableCell>{item.level}</TableCell><TableCell><Badge variant="outline" className={badgeClass(item.status)}>{item.status}</Badge></TableCell><TableCell>{formatNumber(item.leads)}</TableCell><TableCell>{formatNumber(item.sales)}</TableCell><TableCell>{item.leads ? percent(item.sales / item.leads * 100) : "0%"}</TableCell><TableCell>{decimalMoney(item.sales ? item.costCents / item.sales : 0)}</TableCell></TableRow>)}</TableBody></Table></article>;
}

function EmptyState({ title, description }: { title: string; description: string }) { return <div className="grid min-h-40 place-items-center text-center"><div><Building2 className="mx-auto mb-4 size-8 text-[#c9a227]" /><h3 className="font-semibold text-white">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">{description}</p></div></div>; }

function FormShell({ title, description, saving, children, onSubmit }: { title: string; description: string; saving: boolean; children: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription className="text-zinc-400">{description}</DialogDescription></DialogHeader><div className="my-6 grid gap-4 sm:grid-cols-2">{children}</div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="border-white/12 bg-transparent text-white">Cancelar</Button></DialogClose><Button disabled={saving} className="bg-[#c9a227] text-black hover:bg-[#ddbd48]">{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter></form>;
}

function CityForm({ saving, onSave }: { saving: boolean; onSave: (payload: Record<string, unknown>) => void }) {
  const [phase, setPhase] = useState("Preparação"); const [status, setStatus] = useState("Planejada");
  return <FormShell title="Cadastrar cidade" description="Defina a meta e o limite de custo antes de abrir a operação." saving={saving} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSave({ name: form.get("name"), state: form.get("state"), leaderName: form.get("leader"), targetCacCents: centsFromInput(form.get("targetCac")), ambassadorGoal: Number(form.get("ambassadorGoal") || 10), salesGoal: Number(form.get("salesGoal") || 100), phase, status }); }}><Field label="Cidade"><Input name="name" required placeholder="Ex.: Sete Lagoas" className="border-white/12 bg-white/5" /></Field><Field label="Estado"><Input name="state" defaultValue="MG" required className="border-white/12 bg-white/5" /></Field><Field label="Fase"><Select value={phase} onValueChange={setPhase}><SelectTrigger className="w-full border-white/12 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Preparação">Preparação</SelectItem><SelectItem value="Piloto">Piloto</SelectItem><SelectItem value="Ativa">Ativa</SelectItem><SelectItem value="Em espera">Em espera</SelectItem></SelectContent></Select></Field><Field label="Situação"><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full border-white/12 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Planejada">Planejada</SelectItem><SelectItem value="Ativa">Ativa</SelectItem><SelectItem value="Pausada">Pausada</SelectItem></SelectContent></Select></Field><Field label="Líder local"><Input name="leader" placeholder="Nome do responsável" className="border-white/12 bg-white/5" /></Field><Field label="CAC máximo (R$)"><Input name="targetCac" type="number" min="0" step="0.01" placeholder="0,00" className="border-white/12 bg-white/5" /></Field><Field label="Meta de embaixadores"><Input name="ambassadorGoal" type="number" min="1" defaultValue="10" className="border-white/12 bg-white/5" /></Field><Field label="Meta de vendas"><Input name="salesGoal" type="number" min="1" defaultValue="100" className="border-white/12 bg-white/5" /></Field></FormShell>;
}

function AmbassadorForm({ cities, saving, onSave }: { cities: CityView[]; saving: boolean; onSave: (payload: Record<string, unknown>) => void }) {
  const [cityId, setCityId] = useState(String(cities[0]?.id ?? "")); const [level, setLevel] = useState("Indicador"); const [status, setStatus] = useState("Candidato");
  return <FormShell title="Cadastrar embaixador" description="Cada pessoa recebe um código próprio para medir sua força local." saving={saving} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSave({ cityId: Number(cityId), name: form.get("name"), code: form.get("code"), whatsapp: form.get("whatsapp"), level, status }); }}><Field label="Cidade"><Select value={cityId} onValueChange={setCityId}><SelectTrigger className="w-full border-white/12 bg-white/5"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{cities.map((city) => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Nome"><Input name="name" required className="border-white/12 bg-white/5" /></Field><Field label="Código"><Input name="code" required placeholder="EX.: ESM001" className="border-white/12 bg-white/5 uppercase" /></Field><Field label="WhatsApp"><Input name="whatsapp" placeholder="(31) 99999-9999" className="border-white/12 bg-white/5" /></Field><Field label="Nível"><Select value={level} onValueChange={setLevel}><SelectTrigger className="w-full border-white/12 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Indicador">Indicador</SelectItem><SelectItem value="Embaixador ativo">Embaixador ativo</SelectItem><SelectItem value="Referência">Referência</SelectItem><SelectItem value="Líder local">Líder local</SelectItem></SelectContent></Select></Field><Field label="Situação"><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full border-white/12 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Candidato">Candidato</SelectItem><SelectItem value="Experiência">Experiência</SelectItem><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Suspenso">Suspenso</SelectItem></SelectContent></Select></Field></FormShell>;
}

function CityResultForm({ cities, saving, onSave }: { cities: CityView[]; saving: boolean; onSave: (payload: Record<string, unknown>) => void }) {
  const [cityId, setCityId] = useState(String(cities[0]?.id ?? "")); const [phase, setPhase] = useState("Ativa"); const [status, setStatus] = useState("Ativa");
  return <FormShell title="Registrar resultado da cidade" description="Use sempre o mesmo período para comparar as cidades com justiça." saving={saving} onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave({ cityId: Number(cityId), period: f.get("period"), reach: Number(f.get("reach") || 0), leads: Number(f.get("leads") || 0), organicLeads: Number(f.get("organicLeads") || 0), sales: Number(f.get("sales") || 0), revenueCents: centsFromInput(f.get("revenue")), costCents: centsFromInput(f.get("cost")), partners: Number(f.get("partners") || 0), events: Number(f.get("events") || 0), note: f.get("note"), phase, status }); }}><Field label="Cidade"><Select value={cityId} onValueChange={setCityId}><SelectTrigger className="w-full border-white/12 bg-white/5"><SelectValue /></SelectTrigger><SelectContent>{cities.map((city) => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Período"><Input name="period" type="month" required className="border-white/12 bg-white/5" /></Field><Field label="Pessoas alcançadas"><Input name="reach" type="number" min="0" defaultValue="0" className="border-white/12 bg-white/5" /></Field><Field label="Leads"><Input name="leads" type="number" min="0" defaultValue="0" className="border-white/12 bg-white/5" /></Field><Field label="Leads sem mídia paga"><Input name="organicLeads" type="number" min="0" defaultValue="0" className="border-white/12 bg-white/5" /></Field><Field label="Vendas"><Input name="sales" type="number" min="0" defaultValue="0" className="border-white/12 bg-white/5" /></Field><Field label="Receita (R$)"><Input name="revenue" type="number" min="0" step="0.01" defaultValue="0" className="border-white/12 bg-white/5" /></Field><Field label="Investimento total (R$)"><Input name="cost" type="number" min="0" step="0.01" defaultValue="0" className="border-white/12 bg-white/5" /></Field><Field label="Parceiros ativos"><Input name="partners" type="number" min="0" defaultValue="0" className="border-white/12 bg-white/5" /></Field><Field label="Eventos realizados"><Input name="events" type="number" min="0" defaultValue="0" className="border-white/12 bg-white/5" /></Field><Field label="Fase"><Select value={phase} onValueChange={setPhase}><SelectTrigger className="w-full border-white/12 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Preparação">Preparação</SelectItem><SelectItem value="Piloto">Piloto</SelectItem><SelectItem value="Ativa">Ativa</SelectItem><SelectItem value="Em espera">Em espera</SelectItem></SelectContent></Select></Field><Field label="Situação"><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full border-white/12 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Planejada">Planejada</SelectItem><SelectItem value="Ativa">Ativa</SelectItem><SelectItem value="Pausada">Pausada</SelectItem></SelectContent></Select></Field><div className="sm:col-span-2"><Field label="Observação"><Input name="note" placeholder="O que funcionou ou precisa mudar?" className="border-white/12 bg-white/5" /></Field></div></FormShell>;
}

function AmbassadorResultForm({ ambassadors, saving, onSave }: { ambassadors: AmbassadorView[]; saving: boolean; onSave: (payload: Record<string, unknown>) => void }) {
  const [ambassadorId, setAmbassadorId] = useState(String(ambassadors[0]?.id ?? "")); const [level, setLevel] = useState("Embaixador ativo"); const [status, setStatus] = useState("Ativo");
  if (!ambassadors.length) return <><DialogHeader><DialogTitle>Registrar produção</DialogTitle><DialogDescription>Cadastre um embaixador antes de registrar resultados.</DialogDescription></DialogHeader><EmptyState title="Falta cadastrar o embaixador" description="Feche esta janela e use o botão Cadastrar." /></>;
  return <FormShell title="Registrar produção do embaixador" description="Acompanhe constância, indicação e venda sem depender somente de anúncios." saving={saving} onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave({ ambassadorId: Number(ambassadorId), period: f.get("period"), leads: Number(f.get("leads") || 0), sales: Number(f.get("sales") || 0), costCents: centsFromInput(f.get("cost")), note: f.get("note"), level, status }); }}><Field label="Embaixador"><Select value={ambassadorId} onValueChange={setAmbassadorId}><SelectTrigger className="w-full border-white/12 bg-white/5"><SelectValue /></SelectTrigger><SelectContent>{ambassadors.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name} · {item.cityName}</SelectItem>)}</SelectContent></Select></Field><Field label="Período"><Input name="period" type="month" required className="border-white/12 bg-white/5" /></Field><Field label="Leads indicados"><Input name="leads" type="number" min="0" defaultValue="0" className="border-white/12 bg-white/5" /></Field><Field label="Vendas"><Input name="sales" type="number" min="0" defaultValue="0" className="border-white/12 bg-white/5" /></Field><Field label="Custo de apoio (R$)"><Input name="cost" type="number" min="0" step="0.01" defaultValue="0" className="border-white/12 bg-white/5" /></Field><Field label="Nível"><Select value={level} onValueChange={setLevel}><SelectTrigger className="w-full border-white/12 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Indicador">Indicador</SelectItem><SelectItem value="Embaixador ativo">Embaixador ativo</SelectItem><SelectItem value="Referência">Referência</SelectItem><SelectItem value="Líder local">Líder local</SelectItem></SelectContent></Select></Field><Field label="Situação"><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full border-white/12 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Experiência">Experiência</SelectItem><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Suspenso">Suspenso</SelectItem></SelectContent></Select></Field><Field label="Observação"><Input name="note" placeholder="Ações, dificuldades e próximos passos" className="border-white/12 bg-white/5" /></Field></FormShell>;
}
