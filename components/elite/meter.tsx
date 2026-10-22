import { percentOf } from "@/lib/figures";

/**
 * Medidor de uma parte de um total (meta, uso do plano, etapas concluídas).
 * Anel para destaque; barra para listas. O número fica sempre escrito ao lado.
 */
export function Meter({ value, max, label, valueText, variant = "ring", size = 64 }: {
  value: number; max: number; label: string;
  /** Como o leitor de tela e a tela leem o valor (ex.: "6 de 7"). */
  valueText?: string; variant?: "ring" | "bar"; size?: number;
}) {
  const pct = percentOf(value, max);
  const text = valueText ?? `${Math.round(pct)}%`;
  const aria = { role: "meter", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": max, "aria-valuenow": Math.min(Math.max(value, 0), max), "aria-valuetext": text } as const;
  if (variant === "bar") return <div className="elite-meter-bar" {...aria}><span style={{ width: `${pct}%` }} /></div>;
  const stroke = 6, radius = (size - stroke) / 2, length = 2 * Math.PI * radius;
  return <div className="elite-meter-ring" style={{ width: size, height: size }} {...aria}>
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={radius} className="elite-meter-track" strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={radius} className="elite-meter-fill" strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * length} ${length}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
    <span className="elite-meter-text">{text}</span>
  </div>;
}
