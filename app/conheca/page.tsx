import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BarChart3, Building2, CalendarCheck, Map, MessageSquareQuote, Network, Printer, ShieldCheck, Smartphone, Users } from "lucide-react";

import { OrbitalEmblem, Wordmark } from "@/app/brand-hero";
import { RequestForm } from "@/app/conheca/request-form";
import { PLAN_FEATURES } from "@/lib/subscriptions";

export const metadata: Metadata = {
  title: "Elite Expansion X — plataforma de expansão para a sua empresa",
  description: "Mapa territorial, rede de embaixadores, atendimento com o Método F.E.C.H.A. e resultados em um só lugar. Peça uma apresentação.",
};

const FEATURES = [
  { icon: Map, title: "Mapa territorial", text: "Cidades, empresas, escritórios e comunidades no mapa, com as pessoas ligadas a cada local — nunca no endereço de casa." },
  { icon: Smartphone, title: "Mapeamento em campo", text: "Instale no celular e cadastre locais e pessoas mesmo sem internet; tudo é enviado quando o sinal volta." },
  { icon: CalendarCheck, title: "Agenda e atendimentos", text: "Cada contato autorizado vira um atendimento com próximo passo e data, conduzido pelo Método F.E.C.H.A. até o pagamento." },
  { icon: MessageSquareQuote, title: "Banco de Ganchos", text: "As frases de abordagem da sua empresa, por situação e canal, prontas para usar com o nome da pessoa." },
  { icon: Network, title: "Rede que multiplica", text: "Embaixadores, indicações, parceiros, eventos e materiais organizados por cidade." },
  { icon: BarChart3, title: "Resultados e custos", text: "Metas, indicadores com variação, mapeamento por cidade, custos e canais em um painel só." },
  { icon: Printer, title: "Mapa impresso", text: "Folha A3 de cada cidade com os locais numerados e a lista de pessoas, para reunião ou campo." },
  { icon: Users, title: "Equipe com funções", text: "Administrador, coordenação, liderança e comercial: cada um vê só o que precisa, e tudo fica no histórico." },
  { icon: ShieldCheck, title: "LGPD desde o começo", text: "Contato só com autorização, sem endereço residencial e com a tela para atender pedidos de titulares no prazo." },
];

const STEPS = [
  ["Você pede a apresentação", "Preencha o formulário abaixo. A equipe da Elite entra em contato pelo WhatsApp ou e-mail informado."],
  ["Montamos o plano juntos", "O plano acompanha o tamanho da sua operação: quantas pessoas na equipe, quantas cidades e quais recursos."],
  ["Sua empresa ganha o próprio ambiente", "Um espaço só seu, separado das outras empresas, com o seu nome e a sua logo."],
  ["A Elite acompanha", "A Assessoria Elite ajuda a configurar e a colocar a equipe para usar. Sua empresa vê quem da Elite tem acesso."],
];

/** Página pública: apresenta a plataforma e recebe pedidos de empresas interessadas (Plataforma → Pedidos de assinatura). */
export default function ConhecaPage() {
  return (
    <main className="elite-grid min-h-screen bg-background text-zinc-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <div className="hidden sm:block"><Wordmark /></div>
        {/* No celular, o nome por extenso quebraria em três linhas ao lado do botão. */}
        <div className="flex min-w-0 items-center gap-2 sm:hidden"><Image src="/elite-emblem-sm.png" alt="" width={128} height={128} className="size-9 shrink-0" /><p className="truncate text-base font-semibold tracking-[0.08em] text-gold-light">ELITE EXPANSION <span className="text-gold">X</span></p></div>
        <Link href="/entrar" className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"><span className="sm:hidden">Entrar</span><span className="hidden sm:inline">Já sou cliente</span></Link>
      </header>

      <section className="relative mx-auto grid max-w-6xl items-center gap-8 overflow-hidden px-4 pb-12 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:pb-20">
        <div className="relative z-10">
          <p className="section-kicker">Plataforma de expansão estratégica</p>
          <h1 className="text-[2.3rem] font-semibold leading-[1.05] tracking-[-0.035em] text-white sm:text-5xl lg:text-[3.6rem]">Expansão com estratégia.<br /><span className="elite-gold-text">Cidade por cidade.</span></h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-zinc-300">A Elite Expansion X reúne o território, a rede de embaixadores, o atendimento comercial e os resultados da sua empresa em um só lugar — do primeiro contato à venda, com a mesma metodologia que a Elite Frascaroli Academy usa na própria expansão.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#pedido" className="rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-black hover:bg-gold-hover">Pedir uma apresentação</a>
            <a href="#recursos" className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white hover:bg-white/10">Ver os recursos</a>
          </div>
        </div>
        <div className="relative mx-auto hidden w-full max-w-md sm:block" aria-hidden><OrbitalEmblem size="sm" /></div>
      </section>

      <section id="recursos" className="mx-auto max-w-6xl scroll-mt-6 px-4 pb-14 sm:px-6">
        <p className="section-kicker">O que vem na plataforma</p>
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Tudo o que a operação de expansão precisa</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => <li key={title} className="elite-card p-5">
            <span className="mb-3 grid size-10 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold-light"><Icon className="size-5" aria-hidden /></span>
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-zinc-400">{text}</p>
          </li>)}
        </ul>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-14 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="section-kicker">Como funciona</p>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Da conversa ao ambiente pronto</h2>
          <ol className="mt-6 grid gap-4">
            {STEPS.map(([title, text], index) => <li key={title} className="flex gap-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold text-sm font-semibold text-black">{index + 1}</span>
              <div><h3 className="font-semibold text-white">{title}</h3><p className="mt-0.5 text-sm leading-6 text-zinc-400">{text}</p></div>
            </li>)}
          </ol>
        </div>
        <div className="elite-card self-start p-6">
          <p className="section-kicker">Planos</p>
          <h2 className="text-xl font-semibold text-white">Do tamanho da sua operação</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Toda empresa assinante recebe a plataforma inteira: mapa, cidades, equipe, agenda, atendimentos, rede, resultados e o app no celular. O plano define:</p>
          <ul className="mt-4 grid gap-2 text-sm text-zinc-200">
            <li className="flex gap-2"><Users className="mt-0.5 size-4 shrink-0 text-gold-soft" aria-hidden />Quantas pessoas da equipe usam (mentorados não contam)</li>
            <li className="flex gap-2"><Building2 className="mt-0.5 size-4 shrink-0 text-gold-soft" aria-hidden />Quantas cidades ficam ativas ao mesmo tempo</li>
            {PLAN_FEATURES.map(([key, label]) => <li key={key} className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold-soft" aria-hidden />{label}</li>)}
          </ul>
          <p className="mt-4 rounded-lg border border-gold/20 bg-gold/[0.06] px-3 py-2 text-sm text-gold-pale">Os valores são apresentados na conversa, conforme o plano montado para a sua empresa.</p>
        </div>
      </section>

      <section id="pedido" className="mx-auto max-w-3xl scroll-mt-6 px-4 pb-16 sm:px-6">
        <div className="elite-card p-6 sm:p-8">
          <p className="section-kicker">Pedir uma apresentação</p>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Conte um pouco da sua empresa</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-400">A equipe da Elite responde pelo contato que você informar.</p>
          <div className="mt-6"><RequestForm /></div>
        </div>
      </section>

      <footer className="border-t border-white/6 px-4 py-6 text-center text-xs leading-6 text-subtle sm:px-6">
        <p>Elite Expansion X · Elite Frascaroli Academy</p>
        <p>Os dados enviados aqui servem só para responder ao seu pedido. Para corrigir ou apagar, responda à mensagem da Elite.</p>
        <p className="mt-2"><Link href="/entrar" className="text-gold-soft hover:underline">Entrar na plataforma</Link></p>
      </footer>
    </main>
  );
}
