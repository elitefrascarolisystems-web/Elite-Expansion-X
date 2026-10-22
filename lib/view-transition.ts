/**
 * Troca de tela com transição suave (View Transitions) quando o navegador permite
 * e a pessoa não pediu menos movimento. Sem suporte, troca na hora.
 */
export function withViewTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (callback: () => void) => unknown };
  if (typeof doc.startViewTransition !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { update(); return; }
  doc.startViewTransition(update);
}
