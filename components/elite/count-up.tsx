"use client";
import { useLayoutEffect, useRef } from "react";

import { figureAt } from "@/lib/figures";

// Na primeira pintura (página vinda do servidor) o número aparece pronto; a
// contagem só roda depois, ao trocar de área ou quando o valor muda.
let interactive = false;
/** Chamado pela estrutura da plataforma (AppShell) depois de montar. */
export function markInteractive() { interactive = true; }

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Número de indicador que conta até o valor (0,65 s). Sem animação para quem pediu menos movimento. */
export function CountUp({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !interactive || !/\d/.test(text) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 650);
      el.textContent = figureAt(text, 1 - Math.pow(1 - t, 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    el.textContent = figureAt(text, 0);
    frame = requestAnimationFrame(tick);
    // Ao trocar o valor, o React já pôs o texto novo; aqui só para a contagem antiga.
    return () => cancelAnimationFrame(frame);
  }, [text]);
  // O texto entra como HTML para o React não disputar o conteúdo com a animação.
  return <span ref={ref} dangerouslySetInnerHTML={{ __html: escape(text) }} />;
}
