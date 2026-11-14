"use client";
/** Aplica a cor da empresa em toda a plataforma (variáveis do dourado nos dois temas). Dourado: nada a fazer. */
import { accentCss } from "@/lib/accent";

export function AccentStyle({ accent }: { accent: string | null | undefined }) {
  const css = accentCss(accent);
  return css ? <style data-accent={accent ?? ""}>{css}</style> : null;
}
