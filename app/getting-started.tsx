"use client";
import { useState } from "react";
import { ArrowRight, BookOpen, Check, Compass, LoaderCircle, MapPin, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { AccessView, DashboardData } from "@/lib/expansion-types";
import { tenantFetch } from "@/lib/tenant-request";

export const GUIDE_PATH = "/guia";

type Step = { title: string; detail: string; done: boolean; action: string; tab: string };

/** Ordem de trabalho da plataforma, marcada sozinha a partir do que já foi cadastrado. */
export function setupSteps(data: DashboardData): Step[] {
  const others = data.users.filter((user) => user.email.toLowerCase() !== data.access.email.toLowerCase() && user.active);
  const entered = others.filter((user) => user.hasPassword).length;
  const places = data.places ?? [];
  const hubs = places.filter((place) => place.placeType !== "Empresa").length;
  const companies = places.length - hubs;
  const people = data.mapping?.people ?? 0, linked = data.mapping?.linked ?? 0;
  const ambassadors = data.ambassadors.filter((item) => item.status === "Ativo").length;
  const steps: Step[] = [
    { title: "Cidades", detail: data.cities.length ? `${data.cities.length} cidade(s) cadastrada(s).` : "Cadastre as cidades onde a Elite vai atuar.", done: data.cities.length > 0, action: "Abrir cidades", tab: "cidades" },
    { title: "Equipe com acesso", detail: others.length ? `${entered} de ${others.length} pessoa(s) já entraram.` : "Convide quem vai mapear e vender com você.", done: entered > 0, action: "Convidar equipe", tab: "time" },
    { title: "Escritórios e networks", detail: hubs ? `${hubs} local(is) de referência no mapa.` : "Marque os escritórios Elite, networks e pontos de encontro.", done: hubs > 0, action: "Cadastrar local", tab: "empresas" },
    { title: "Empresas", detail: companies ? `${companies} empresa(s) com tipo e setor.` : "Cadastre as empresas com o setor de cada uma.", done: companies > 0, action: "Cadastrar empresa", tab: "empresas" },
    { title: "Pessoas ligadas a locais", detail: people ? `${people} pessoa(s) no mapa, ${linked} ligada(s) a um local.` : "Cadastre mentorados, parceiros e contatos, cada um no seu local.", done: linked > 0, action: "Abrir mapa", tab: "mapa" },
    { title: "Embaixadores ativos", detail: ambassadors ? `${ambassadors} embaixador(es) ativo(s).` : "Ative os primeiros embaixadores de cada cidade.", done: ambassadors > 0, action: "Abrir embaixadores", tab: "embaixadores" },
    { title: "Leads e follow-up", detail: data.leads.length ? `${data.leads.length} lead(s) no acompanhamento.` : "Registre os primeiros leads e siga o Método F.E.C.H.A.", done: data.leads.length > 0, action: "Abrir vendas", tab: "followup" },
  ];
  // Só administradores convidam a equipe.
  return data.access.role === "Administrador" ? steps : steps.filter((step) => step.tab !== "time");
}

export function GettingStarted({ data, onGo }: { data: DashboardData; onGo: (tab: string) => void }) {
  const steps = setupSteps(data);
  const done = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done);
  const [open, setOpen] = useState(done < steps.length);
  return <section className="elite-card mb-5 overflow-hidden" aria-label="Primeiros passos">
    <div className="flex flex-wrap items-center gap-4 p-5"><div className="mr-auto"><p className="section-kicker">Primeiros passos</p><h2 className="text-xl font-semibold text-white">{next ? `Próximo passo: ${next.title.toLowerCase()}` : "Base pronta: siga mapeando e vendendo"}</h2><p className="mt-1 text-sm text-zinc-400">{done} de {steps.length} etapas concluídas. Siga nesta ordem: cada etapa usa o que foi cadastrado na anterior.</p></div>
      <div className="flex flex-wrap gap-2">{next && <Button onClick={() => onGo(next.tab)} className="bg-[#c9a227] text-black">{next.action} <ArrowRight /></Button>}<Button asChild variant="outline" className="border-white/10 bg-white/5 text-white"><a href={GUIDE_PATH} target="_blank" rel="noreferrer"><BookOpen /> Guia do mapeador</a></Button><Button variant="ghost" className="text-zinc-400" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? "Recolher" : "Ver etapas"}</Button></div>
      <Progress value={(done / steps.length) * 100} className="h-1.5 w-full bg-white/8" /></div>
    {open && <ol className="grid gap-px border-t border-white/8 bg-white/8 sm:grid-cols-2 xl:grid-cols-4">{steps.map((step, index) => <li key={step.title} className="flex flex-col gap-2 bg-[#0d0d0b] p-4">
      <div className="flex items-center gap-2"><span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${step.done ? "bg-emerald-400/15 text-emerald-300" : step === next ? "bg-[#c9a227] text-black" : "bg-white/8 text-zinc-400"}`}>{step.done ? <Check className="size-3.5" /> : index + 1}</span><h3 className="font-medium text-white">{step.title}</h3></div>
      <p className="flex-1 text-xs leading-5 text-zinc-400">{step.detail}</p>
      <Button size="sm" variant="ghost" onClick={() => onGo(step.tab)} className="h-7 justify-start px-0 text-xs text-[#d6b94f] hover:bg-transparent hover:text-[#e8c766]">{step.done ? "Ver" : step.action} <ArrowRight className="size-3" /></Button>
    </li>)}</ol>}
  </section>;
}

const ROLE_WELCOME: Record<AccessView["role"], { what: string; steps: string[]; tab: string; start: string }> = {
  Administrador: {
    what: "Você organiza a operação inteira: cidades, equipe, mapa, vendas e custos.",
    steps: ["Na aba Início, siga os Primeiros passos na ordem.", "Em Time e acessos, convide a equipe e envie o link de cada pessoa.", "Acompanhe quem já entrou e o que cada cidade produziu."],
    tab: "visao", start: "Ver os Primeiros passos",
  },
  Coordenação: {
    what: "Você coordena uma cidade: mapa, embaixadores, leads, vendas e tarefas dela.",
    steps: ["Cadastre os locais da cidade (escritórios, networks, empresas) em Empresas e locais.", "No Mapa, cadastre as pessoas ligadas a cada local.", "Ative os embaixadores e acompanhe os leads em Vendas e relacionamento."],
    tab: "visao", start: "Começar",
  },
  Líder: {
    what: "Você lidera uma cidade: acompanha a equipe local e os resultados dela.",
    steps: ["Confira o mapa da sua cidade.", "Cadastre pessoas e locais que você conhece.", "Acompanhe embaixadores e leads."],
    tab: "visao", start: "Começar",
  },
  Comercial: {
    what: "Você mapeia pessoas e locais e cuida dos seus leads até a venda.",
    steps: ["Em Empresas e locais, cadastre a empresa, escritório ou network com tipo e setor.", "No Mapa, use “+ Pessoa” e ligue cada pessoa ao local dela (sócio, colaborador, mentorado...).", "Em Vendas e relacionamento, siga cada lead com o roteiro do Método F.E.C.H.A."],
    tab: "empresas", start: "Cadastrar o primeiro local",
  },
  Embaixador: {
    what: "Você indica pessoas para a Elite e acompanha suas tarefas.",
    steps: ["Aceite as regras e conclua o treinamento.", "Use seu link de indicação.", "Cumpra as tarefas da semana."],
    tab: "visao", start: "Começar",
  },
};

/** Tela de boas-vindas na primeira entrada de cada pessoa (não aparece de novo depois de fechada). */
export function WelcomeDialog({ access, onStart }: { access: AccessView; onStart: (tab: string) => void }) {
  const [open, setOpen] = useState(access.welcomed === false);
  const [busy, setBusy] = useState(false);
  const content = ROLE_WELCOME[access.role];
  async function finish(tab?: string) {
    setBusy(true);
    // Mesmo se falhar, não prende a pessoa: ela pode seguir e a tela volta na próxima entrada.
    await tenantFetch("/api/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "welcome" }) }).catch(() => undefined);
    setBusy(false); setOpen(false);
    if (tab) onStart(tab);
  }
  return <Dialog open={open} onOpenChange={(value) => { if (!value && !busy) finish(); }}><DialogContent className="border-white/10 bg-[#11110f] text-white sm:max-w-lg">
    <DialogHeader><p className="section-kicker">Bem-vindo(a) à Elite Expansion X</p><DialogTitle className="text-2xl">Olá, {access.name.split(" ")[0]}!</DialogTitle><DialogDescription className="text-zinc-300">{access.title ? <><strong className="text-white">{access.title}</strong> · </> : null}{content.what}</DialogDescription></DialogHeader>
    <ol className="grid gap-2">{content.steps.map((step, index) => <li key={step} className="flex gap-3 rounded-lg border border-white/8 bg-white/[0.03] p-3 text-sm leading-6 text-zinc-300"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#c9a227] text-xs font-semibold text-black">{index + 1}</span>{step}</li>)}</ol>
    <div className="grid gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs leading-5 text-emerald-100"><p className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" /> Regras do mapeamento</p><p><MapPin className="mr-1 inline size-3.5" />Pessoas nunca são marcadas na casa delas: aparecem no local ligado (empresa, escritório, network) ou no centro da cidade.</p><p><Compass className="mr-1 inline size-3.5" />Cadastre como lead só quem autorizou o contato.</p></div>
    <div className="flex flex-wrap justify-end gap-2"><Button asChild variant="ghost" className="text-zinc-300"><a href={GUIDE_PATH} target="_blank" rel="noreferrer"><BookOpen /> Ler o guia</a></Button><Button disabled={busy} onClick={() => finish(content.tab)} className="bg-[#c9a227] text-black">{busy ? <LoaderCircle className="animate-spin" /> : null}{content.start} <ArrowRight /></Button></div>
  </DialogContent></Dialog>;
}
