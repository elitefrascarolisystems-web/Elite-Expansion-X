"use client";
import { useRef, type KeyboardEvent } from "react";

export type SegmentedOption<T extends string> = { value: T; label: string; count?: number };

/**
 * Controle segmentado: escolhe um entre poucos modos (ex.: Lembrete diário |
 * Resumo semanal). Setas trocam a opção, como num grupo de rádio.
 */
export function Segmented<T extends string>({ options, value, onChange, label, size = "md" }: {
  options: SegmentedOption<T>[]; value: T; onChange: (value: T) => void; label: string; size?: "sm" | "md";
}) {
  const ref = useRef<HTMLDivElement>(null);
  function onKeyDown(event: KeyboardEvent) {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
      : (index + (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    ref.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  }
  return <div ref={ref} role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={`elite-segmented ${size === "sm" ? "is-sm" : ""}`}>
    {options.map((option) => {
      const checked = option.value === value;
      return <button key={option.value} type="button" role="radio" aria-checked={checked} tabIndex={checked ? 0 : -1} onClick={() => onChange(option.value)}>
        {option.label}{option.count !== undefined && <span className="elite-segmented-count">{option.count}</span>}
      </button>;
    })}
  </div>;
}
