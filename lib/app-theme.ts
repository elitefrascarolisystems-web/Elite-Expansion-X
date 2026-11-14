/**
 * Tema do app (escuro, claro ou igual ao aparelho). A escolha fica no próprio aparelho (localStorage).
 * Só as telas de trabalho seguem o tema: entrada, página pública e folhas de impressão não mudam.
 */
import { useSyncExternalStore } from "react";

export const THEME_KEY = "elite-app-theme";
export const THEME_EVENT = "elite-app-theme";
export const THEME_CHOICES = ["escuro", "claro", "aparelho"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type ResolvedTheme = "dark" | "light";

/** Telas que seguem o tema escolhido. */
export const THEMED_PATHS = ["/", "/guia"];

export function resolveTheme(choice: string | null | undefined, prefersLight: boolean): ResolvedTheme {
  if (choice === "claro") return "light";
  if (choice === "aparelho") return prefersLight ? "light" : "dark";
  return "dark";
}

/**
 * Roda antes da primeira pintura (no <head>), para não piscar o tema errado.
 * Mesma regra de resolveTheme; mantenha os dois iguais (há teste).
 */
export const THEME_SCRIPT = `(function(){try{var p=location.pathname;if(${JSON.stringify(THEMED_PATHS)}.indexOf(p)<0)return;var v=localStorage.getItem(${JSON.stringify(THEME_KEY)});var l=v==="claro"||(v==="aparelho"&&matchMedia("(prefers-color-scheme: light)").matches);if(l)document.documentElement.dataset.theme="light";}catch(e){}})();`;

export function readChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return (THEME_CHOICES as readonly string[]).includes(String(value)) ? value as ThemeChoice : "escuro";
  } catch { return "escuro"; }
}

/** Aplica no documento e avisa quem acompanha (avisos, mapa). */
export function applyTheme(choice: ThemeChoice) {
  try { localStorage.setItem(THEME_KEY, choice); } catch { /* aparelho sem armazenamento: vale só nesta visita */ }
  const light = resolveTheme(choice, matchMedia("(prefers-color-scheme: light)").matches) === "light";
  if (THEMED_PATHS.includes(location.pathname)) {
    if (light) document.documentElement.dataset.theme = "light"; else delete document.documentElement.dataset.theme;
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

function subscribe(listener: () => void) {
  const media = matchMedia("(prefers-color-scheme: light)");
  const onMedia = () => { if (readChoice() === "aparelho") applyTheme("aparelho"); listener(); };
  window.addEventListener(THEME_EVENT, listener);
  window.addEventListener("storage", listener);
  media.addEventListener("change", onMedia);
  return () => { window.removeEventListener(THEME_EVENT, listener); window.removeEventListener("storage", listener); media.removeEventListener("change", onMedia); };
}

/** Tema em uso agora na página (o que o <html> mostra). */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, () => (document.documentElement.dataset.theme === "light" ? "light" : "dark"), () => "dark");
}

/** A escolha guardada no aparelho. */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, readChoice, () => "escuro");
}
