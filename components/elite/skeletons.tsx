/** Esqueleto de carregamento no formato da tela que vai aparecer (com a frase para leitor de tela). */
export function PanelSkeleton({ label, rows = 4, card = true }: { label: string; rows?: number; card?: boolean }) {
  return <div role="status" aria-live="polite" className={`${card ? "elite-card p-5 sm:p-6" : ""} grid gap-4`}>
    <span className="sr-only">{label}</span>
    <div className="elite-skeleton h-4 w-32" aria-hidden />
    <div className="elite-skeleton h-6 w-2/3 max-w-md" aria-hidden />
    <div className="grid gap-3" aria-hidden>{Array.from({ length: rows }, (_, index) => <div key={index} className="elite-skeleton h-12" style={{ opacity: 1 - index * 0.15 }} />)}</div>
  </div>;
}

/** Esqueleto de gráfico: barras subindo do eixo, na altura do gráfico real. */
export function ChartSkeleton({ label = "Carregando o gráfico…", height = 290 }: { label?: string; height?: number }) {
  return <div role="status" aria-live="polite" className="flex items-end gap-3 px-2 pb-6" style={{ height }}>
    <span className="sr-only">{label}</span>
    {[42, 64, 38, 78, 56, 88, 47, 70].map((h, index) => <div key={index} aria-hidden className="elite-skeleton flex-1 rounded-t" style={{ height: `${h}%` }} />)}
  </div>;
}
