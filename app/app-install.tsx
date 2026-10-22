"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// O navegador oferece a instalação uma vez por página; guardamos o pedido para o botão.
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferred = event as InstallPrompt; notify(); });
  window.addEventListener("appinstalled", () => { deferred = null; notify(); });
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

const DISMISS_KEY = "elite-install-dismissed";
function readDismissed() { try { return window.localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; } }
function standalone() { return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true; }
// iPhone e iPad não têm o pedido de instalação: mostramos o passo a passo do Safari.
function iosSafari() { const ua = navigator.userAgent; return (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) && !/crios|fxios|edgios/i.test(ua); }
type Mode = "none" | "prompt" | "ios";
function readMode(): Mode { if (standalone() || readDismissed()) return "none"; if (deferred) return "prompt"; return iosSafari() ? "ios" : "none"; }

/** Liga o app no celular: registra o service worker e guarda o que a tela já carregou. */
export function useAppServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready).then((registration) => {
      const urls = [...performance.getEntriesByType("resource").map((entry) => entry.name), ...Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel=modulepreload],link[rel=stylesheet]"), (link) => link.href)];
      registration.active?.postMessage({ type: "cache-assets", urls });
    }).catch(() => { /* sem service worker: a plataforma segue funcionando só com internet */ });
  }, []);
}

/** Faixa "Instalar o app" (some depois de instalar ou de fechar). */
export function InstallAppBanner() {
  const mode = useSyncExternalStore(subscribe, readMode, () => "none" as Mode);
  const [steps, setSteps] = useState(false);
  if (mode === "none") return null;
  const dismiss = () => { try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch { /* vale só nesta tela */ } deferred = null; notify(); };
  async function install() {
    if (mode === "ios") { setSteps(true); return; }
    const prompt = deferred;
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice.catch(() => ({ outcome: "dismissed" }));
    if (choice.outcome === "accepted") { deferred = null; notify(); }
  }
  return <>
    <div role="region" aria-label="Instalar o aplicativo" className="flex items-center gap-3 border-b border-gold/20 bg-gold/[0.07] px-4 py-2 text-sm text-zinc-200">
      <Download className="size-4 shrink-0 text-gold-soft" aria-hidden />
      <p className="min-w-0 flex-1">Use como aplicativo: ícone na tela inicial, tela cheia e mapeamento mesmo sem internet.</p>
      <Button size="sm" onClick={install} className="bg-gold text-black hover:bg-gold-hover">Instalar</Button>
      <Button size="icon" variant="ghost" onClick={dismiss} aria-label="Agora não" title="Agora não" className="size-8 text-subtle hover:bg-white/5 hover:text-white"><X /></Button>
    </div>
    <Dialog open={steps} onOpenChange={setSteps}>
      <DialogContent className="border-white/10 bg-surface-raised text-white sm:max-w-md">
        <DialogHeader><DialogTitle>Instalar no iPhone ou iPad</DialogTitle><DialogDescription className="text-zinc-400">No Safari, leva três toques.</DialogDescription></DialogHeader>
        <ol className="grid gap-3 text-sm text-zinc-200">
          <li className="flex items-start gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold text-xs font-semibold text-black">1</span><span>Toque em <strong>Compartilhar</strong> <Share className="inline size-4 align-text-bottom text-gold-soft" aria-label="(quadrado com seta para cima)" /> na barra do Safari.</span></li>
          <li className="flex items-start gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold text-xs font-semibold text-black">2</span><span>Escolha <strong>Adicionar à Tela de Início</strong> <SquarePlus className="inline size-4 align-text-bottom text-gold-soft" aria-hidden />.</span></li>
          <li className="flex items-start gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold text-xs font-semibold text-black">3</span><span>Toque em <strong>Adicionar</strong>. O ícone Elite X aparece na tela inicial.</span></li>
        </ol>
        <Button onClick={() => { setSteps(false); dismiss(); }} className="bg-gold text-black hover:bg-gold-hover">Entendi</Button>
      </DialogContent>
    </Dialog>
  </>;
}
