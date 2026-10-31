"use client";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CircleHelp, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
// Só o tipo: os textos dos guias (lib/tab-guides.ts) chegam sob demanda, fora do pacote de Hoje.
import type { ResolvedGuide } from "@/lib/tab-guides";

/** O que o botão "Fazer agora" faz nesta tela, para esta função. */
export type GuideRun = { label: string; disabled?: string; run: () => void };

// ---------- "Já vi": no servidor (quando dá) e uma cópia no aparelho ----------

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function readLocal(key: string) { try { return window.localStorage.getItem(key) ?? ""; } catch { return ""; } }
function writeLocal(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* sem armazenamento: vale só nesta tela */ }
  listeners.forEach((listener) => listener());
}

/**
 * Guias já vistos. O servidor traz a lista do login (app_users.guides_seen); o aparelho
 * guarda uma cópia para a tela não piscar e funcionar sem internet. `send` grava no
 * servidor e falha em silêncio (tenta de novo na próxima vez); sem `send` (Assessoria
 * Elite), o "já vi" fica só no aparelho. Enquanto a tela não conhece o aparelho
 * (primeira pintura), `ready` é falso e nenhum cartão aparece.
 */
export function useGuidesSeen({ storageKey, serverSeen, send }: {
  storageKey: string; serverSeen: readonly string[]; send?: (action: "guide_seen" | "guides_reset", key?: string) => Promise<unknown>;
}) {
  const local = useSyncExternalStore(subscribe, () => readLocal(storageKey), () => null);
  const [cleared, setCleared] = useState(false);
  const seen = useMemo(() => new Set([...(cleared ? [] : serverSeen), ...(local ? local.split(",").filter(Boolean) : [])]), [cleared, serverSeen, local]);
  const markSeen = useCallback((key: string) => {
    if (seen.has(key)) return;
    writeLocal(storageKey, [...seen, key].join(","));
    send?.("guide_seen", key).catch(() => undefined);
  }, [seen, storageKey, send]);
  const resetAll = useCallback(() => {
    setCleared(true);
    writeLocal(storageKey, "");
    send?.("guides_reset").catch(() => undefined);
  }, [storageKey, send]);
  return { ready: local !== null, seen, markSeen, resetAll };
}

type GuidesModule = typeof import("@/lib/tab-guides");

/** Textos dos guias: chegam sob demanda, só quando a tela ainda não foi vista ou o botão é tocado. */
export function useGuideContent(needed: boolean) {
  const [content, setContent] = useState<GuidesModule | null>(null);
  useEffect(() => { if (needed && !content) import("@/lib/tab-guides").then(setContent).catch(() => undefined); }, [needed, content]);
  return content;
}

// ---------- Peças da tela ----------

/** Botão do cabeçalho: reabre o guia da tela a qualquer hora. No celular, só o ícone. */
export function GuideButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return <Button type="button" variant="ghost" size="sm" onClick={onClick} aria-label="Como usar esta aba" title="Como usar esta aba"
    className={`elite-guide-button h-8 gap-1.5 px-2 text-gold-soft hover:bg-white/5 hover:text-gold-light ${className}`}>
    <CircleHelp className="size-4" aria-hidden /><span className="hidden sm:inline">Como usar</span>
  </Button>;
}

/** Cartão da 1ª visita: para que serve e o 1º passo, sem cobrir nada da tela. */
export function TabGuideCard({ guide, action, onOpen, onDone }: { guide: ResolvedGuide; action?: GuideRun; onOpen: () => void; onDone: () => void }) {
  return <section className="elite-guide-card" aria-label={guide.titulo}>
    <div className="flex items-start gap-3">
      <CircleHelp className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-white">{guide.titulo}</h2>
        <p className="mt-1 line-clamp-3 text-sm leading-5 text-zinc-300">{guide.paraQueServe} 1º passo: {guide.passos[0]}</p>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2 pl-8">
      <Button type="button" size="sm" variant="outline" onClick={onOpen} className="border-white/12 bg-white/5 text-white">Ver como usar</Button>
      {action && <Button type="button" size="sm" disabled={Boolean(action.disabled)} title={action.disabled} onClick={action.run} className="bg-gold text-black">Fazer agora</Button>}
      <Button type="button" size="sm" variant="ghost" onClick={onDone} className="text-zinc-300 hover:bg-white/5 hover:text-white">Entendi</Button>
    </div>
  </section>;
}

/** No mapa, o cartão vira um chip pequeno, para não tirar altura do mapa. */
export function TabGuideChip({ label, onOpen, onDone }: { label: string; onOpen: () => void; onDone: () => void }) {
  return <div className="elite-guide-chip" role="note">
    <button type="button" onClick={onOpen} className="elite-guide-chip-open"><CircleHelp className="size-4 text-gold" aria-hidden />{label}</button>
    <button type="button" onClick={onDone} aria-label="Fechar o aviso do guia" title="Entendi" className="elite-guide-chip-close"><X className="size-3.5" aria-hidden /></button>
  </div>;
}

const COMPACT = "(max-width: 760px)";
function subscribeMedia(listener: () => void) {
  const query = window.matchMedia(COMPACT);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/** O miolo do guia: 3 passos, o exemplo com selo, o cuidado e os botões (também usado nos testes). */
export function TabGuideBody({ guide, action, onClose, onResetAll }: { guide: ResolvedGuide; action?: GuideRun; onClose: () => void; onResetAll?: () => void }) {
  return <div className="grid gap-4 px-4 pb-6">
    <ol className="grid gap-2" aria-label="Passo a passo">{guide.passos.map((step, index) => <li key={step} className="flex gap-3 rounded-lg border border-white/8 bg-white/[0.03] p-3 text-sm leading-6 text-zinc-200">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold text-xs font-semibold text-black" aria-hidden>{index + 1}</span><span>{step}</span>
    </li>)}</ol>
    <figure className="elite-guide-example"><figcaption><span className="elite-guide-badge">Exemplo</span></figcaption><p className="mt-2 text-sm leading-6 text-zinc-200">{guide.exemplo}</p></figure>
    {guide.cuidado && <p className="flex gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs leading-5 text-emerald-100"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /><span><strong>Cuidado:</strong> {guide.cuidado}</span></p>}
    <div className="flex flex-wrap gap-2">
      {action && <Button type="button" disabled={Boolean(action.disabled)} title={action.disabled} onClick={() => { onClose(); action.run(); }} className="bg-gold text-black">Fazer agora: {action.label}</Button>}
      <Button type="button" variant="outline" onClick={onClose} className="border-white/12 bg-white/5 text-white">Fechar</Button>
    </div>
    {onResetAll && <button type="button" onClick={onResetAll} className="justify-self-start text-xs text-subtle underline-offset-4 hover:text-zinc-200 hover:underline">Mostrar os guias de novo</button>}
  </div>;
}

/** Guia completo numa gaveta: de baixo no celular, à direita no computador. */
export function TabGuideSheet({ guide, open, onOpenChange, action, onResetAll }: {
  guide: ResolvedGuide | null; open: boolean; onOpenChange: (open: boolean) => void; action?: GuideRun; onResetAll?: () => void;
}) {
  const compact = useSyncExternalStore(subscribeMedia, () => window.matchMedia(COMPACT).matches, () => false);
  return <Sheet open={open && Boolean(guide)} onOpenChange={onOpenChange}>
    <SheetContent side={compact ? "bottom" : "right"} className={`elite-guide-sheet border-white/10 bg-surface text-white ${compact ? "max-h-[85dvh] overflow-y-auto rounded-t-2xl" : "w-[420px] overflow-y-auto sm:max-w-[420px]"}`}>
      {guide && <>
        <SheetHeader><SheetTitle className="text-white">{guide.titulo}</SheetTitle><SheetDescription className="text-zinc-300">{guide.paraQueServe}</SheetDescription></SheetHeader>
        <TabGuideBody guide={guide} action={action} onClose={() => onOpenChange(false)} onResetAll={onResetAll} />
      </>}
    </SheetContent>
  </Sheet>;
}
