"use client";
/* eslint-disable @next/next/no-img-element -- emblema estático e pequeno, igual ao do cabeçalho anterior. */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { BarChart3, Building2, ChevronsLeft, ChevronsRight, HandCoins, LogOut, Map, Menu, Network, Plus, Settings2, Sun, type LucideIcon } from "lucide-react";

import { OrganizationSwitcher } from "@/app/organization-switcher";
import { markInteractive } from "@/components/elite/count-up";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AccessView } from "@/lib/expansion-types";
import type { AreaId, NavArea, NavLocation } from "@/lib/navigation";

export const AREA_ICONS: Record<AreaId, LucideIcon> = {
  hoje: Sun, territorio: Map, vendas: HandCoins, rede: Network, resultados: BarChart3, gestao: Settings2, plataforma: Building2,
};

/** Uma ação do botão "+ Novo". `group` separa as ações do dia a dia das de cadastro. */
export type NewAction = { id: string; label: string; icon: LucideIcon; group: "dia" | "cadastro"; disabled?: string; run: () => void };

// Menu recolhido: preferência só deste navegador (sem ela, o menu abre expandido).
const COLLAPSE_KEY = "elite-sidebar-collapsed";
const collapseListeners = new Set<() => void>();
function readCollapsed() { try { return window.localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; } }
function subscribeCollapsed(listener: () => void) { collapseListeners.add(listener); return () => { collapseListeners.delete(listener); }; }
function writeCollapsed(value: boolean) { try { window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0"); } catch { /* sem armazenamento: vale só nesta tela */ } collapseListeners.forEach((listener) => listener()); }

/**
 * Estrutura da plataforma da equipe: barra lateral (computador), barra inferior
 * (celular), cabeçalho com a organização e o "+ Novo", título da área e sub-abas.
 */
export function AppShell({ logo, access, userName, signOutPath, areas, location, badges, actions, onNavigate, search, notice, children }: {
  /** Logo da empresa assinante (no lugar do emblema Elite), quando houver. */
  logo?: string | null;
  access: AccessView; userName: string; signOutPath: string; areas: NavArea[]; location: NavLocation;
  badges: Partial<Record<AreaId, number>>; actions: NewAction[]; onNavigate: (location: NavLocation) => void; search?: ReactNode;
  /** Avisos sob o cabeçalho (conexão, cadastros guardados, instalar o app). */
  notice?: ReactNode; children: ReactNode;
}) {
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  // Depois da primeira pintura, os números dos indicadores passam a contar ao trocar de área.
  useEffect(() => { markInteractive(); }, []);
  const [moreOpen, setMoreOpen] = useState(false);
  const current = areas.find((area) => area.id === location.area) ?? areas[0];
  const AreaIcon = AREA_ICONS[current.id];
  // Empresa assinante: o nome dela é a marca principal; a Elite aparece como a plataforma.
  const client = access.organizationId !== 1;
  const go = (area: NavArea) => onNavigate({ area: area.id, view: area.views[0]?.id ?? "" });
  // Celular: até 5 itens na barra; passando disso, os 4 primeiros + "Mais".
  const primary = areas.length <= 5 ? areas : areas.slice(0, 4), extra = areas.length <= 5 ? [] : areas.slice(4);
  const toggle = () => writeCollapsed(!collapsed);

  const badge = (id: AreaId, compact = false) => badges[id] ? <span className={`elite-nav-badge ${compact ? "is-compact" : ""}`} aria-label={`${badges[id]} pendentes`}>{badges[id]}</span> : null;

  // Fundo de "painel de comando" só em Hoje e no Mapa (app/globals.css).
  const scene = location.area === "hoje" ? "hoje" : location.area === "territorio" && location.view === "mapa" ? "mapa" : undefined;
  return <div className={`elite-shell ${collapsed ? "is-collapsed" : ""}`} data-scene={scene}>
    <aside className="elite-sidebar" aria-label="Áreas da plataforma">
      <div className="elite-sidebar-brand"><img src={logo ?? "/elite-emblem-sm.png"} alt={logo ? `Logo da ${access.organizationName}` : "Elite Frascaroli Academy — logo oficial"} width={128} height={128} className="elite-brand-logo" />{!collapsed && (client
        ? <div className="min-w-0"><p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">Elite Expansion X</p><p className="elite-sidebar-org line-clamp-2 break-words" title={access.organizationName}>{access.organizationName}</p></div>
        : <div className="min-w-0"><p className="truncate font-semibold tracking-tight text-white">Elite Expansion X</p><p className="truncate text-xs text-subtle">{access.organizationName}</p></div>)}</div>
      <nav className="elite-sidebar-nav">{areas.map((area) => { const Icon = AREA_ICONS[area.id]; const active = area.id === current.id; return <button key={area.id} type="button" onClick={() => go(area)} aria-current={active ? "page" : undefined} title={collapsed ? area.label : undefined} className={`elite-nav-item ${active ? "is-active" : ""}`}><Icon className="size-[18px] shrink-0" />{!collapsed && <span className="flex-1 truncate text-left">{area.label}</span>}{badge(area.id, collapsed)}</button>; })}</nav>
      <div className="elite-sidebar-foot">
        {!collapsed && <div className="min-w-0 px-2"><p className="truncate text-sm text-zinc-200">{userName}</p><p className="truncate text-xs text-subtle">{access.isAdvisory ? "Assessoria Elite" : access.role}</p></div>}
        <div className={`flex ${collapsed ? "flex-col" : ""} items-center gap-1`}>
          <Button asChild variant="ghost" size="icon" className="text-zinc-400 hover:bg-white/5 hover:text-white"><a href={signOutPath} aria-label="Sair da plataforma" title="Sair"><LogOut /></a></Button>
          <Button variant="ghost" size="icon" onClick={toggle} className="text-subtle hover:bg-white/5 hover:text-white" aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : "Recolher menu"}>{collapsed ? <ChevronsRight /> : <ChevronsLeft />}</Button>
        </div>
      </div>
    </aside>

    <div className="elite-shell-main">
      <header className="elite-topbar">
        <div className="flex shrink-0 items-center lg:hidden"><img src={logo ?? "/elite-emblem-sm.png"} alt={logo ? `Logo da ${access.organizationName}` : "Elite Frascaroli Academy — logo oficial"} width={128} height={128} className="elite-brand-logo" /></div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {search}
          <OrganizationSwitcher access={access} />
          {actions.length > 0 && <NewMenu actions={actions} />}
        </div>
      </header>
      {access.isAdvisory && <div role="status" className="border-b border-gold/30 bg-gold/10 px-4 py-2 text-center text-sm text-gold-light">Modo assessoria: você está em <strong>{access.organizationName}</strong> pela Assessoria Elite. A empresa vê esse acesso, e tudo o que você alterar fica registrado no histórico dela.</div>}
      {notice}

      <main className="elite-area">
        <div className="elite-area-head">
          <div className="elite-area-title"><span className="elite-area-icon" aria-hidden><AreaIcon className="size-5" /></span><div className="min-w-0"><p className="elite-area-org truncate">{access.organizationName}</p><h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-[2rem]">{current.label}</h1></div></div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{current.description}</p>
          {current.views.length > 1 && <nav className="elite-subnav" aria-label={`Seções de ${current.label}`}>{current.views.map((view) => <button key={view.id} type="button" aria-current={view.id === location.view ? "page" : undefined} onClick={() => onNavigate({ area: current.id, view: view.id })} className={view.id === location.view ? "is-active" : ""}>{view.label}</button>)}</nav>}
        </div>
        {/* A chave refaz a entrada suave a cada troca de área (dentro da área, os filtros de cada tela continuam). */}
        <div key={location.area} className="elite-area-body">{children}</div>
      </main>
    </div>

    <nav className="elite-bottomnav" aria-label="Áreas da plataforma">
      {primary.map((area) => { const Icon = AREA_ICONS[area.id]; const active = area.id === current.id; return <button key={area.id} type="button" onClick={() => go(area)} aria-current={active ? "page" : undefined} className={active ? "is-active" : ""}><span className="relative"><Icon className="size-5" />{badge(area.id, true)}</span><span>{area.label}</span></button>; })}
      {extra.length > 0 && <button type="button" onClick={() => setMoreOpen(true)} className={extra.some((area) => area.id === current.id) ? "is-active" : ""}><Menu className="size-5" /><span>Mais</span></button>}
    </nav>
    <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
      <SheetContent side="bottom" className="border-white/10 bg-surface pb-8 text-white">
        <SheetHeader><SheetTitle className="text-white">Mais áreas</SheetTitle><SheetDescription className="text-zinc-400">{userName} · {access.isAdvisory ? "Assessoria Elite" : access.role}</SheetDescription></SheetHeader>
        <div className="grid gap-1 px-4">{extra.map((area) => { const Icon = AREA_ICONS[area.id]; return <button key={area.id} type="button" onClick={() => { setMoreOpen(false); go(area); }} className={`elite-nav-item ${area.id === current.id ? "is-active" : ""}`}><Icon className="size-[18px]" /><span className="flex-1 text-left">{area.label}</span>{badge(area.id)}</button>; })}
          <a href={signOutPath} className="elite-nav-item text-zinc-400"><LogOut className="size-[18px]" /><span>Sair</span></a></div>
      </SheetContent>
    </Sheet>
  </div>;
}

function NewMenu({ actions }: { actions: NewAction[] }) {
  const groups = [["dia", "No dia a dia"], ["cadastro", "Cadastros"]] as const;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button className="bg-gold text-black hover:bg-gold-hover"><Plus /> Novo</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-64 border-white/10 bg-surface-raised text-zinc-100">
      {groups.map(([group, label], index) => { const items = actions.filter((action) => action.group === group); if (!items.length) return null; return <div key={group}>{index > 0 && <DropdownMenuSeparator className="bg-white/8" />}<DropdownMenuLabel className="text-[11px] uppercase tracking-[0.14em] text-subtle">{label}</DropdownMenuLabel>{items.map(({ id, label: text, icon: Icon, disabled, run }) => <DropdownMenuItem key={id} disabled={Boolean(disabled)} onSelect={run} className="gap-2 focus:bg-white/8 focus:text-white"><Icon className="size-4 text-gold-soft" /><span className="flex-1">{text}</span>{disabled && <span className="text-[10px] text-subtle">{disabled}</span>}</DropdownMenuItem>)}</div>; })}
    </DropdownMenuContent>
  </DropdownMenu>;
}
