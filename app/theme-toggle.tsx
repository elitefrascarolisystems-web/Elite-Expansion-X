"use client";
/** Tema do app: botão rápido (escuro ↔ claro) e a escolha completa (com "igual ao aparelho"). */
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyTheme, THEME_CHOICES, useResolvedTheme, useThemeChoice, type ThemeChoice } from "@/lib/app-theme";

const LABELS: Record<ThemeChoice, { label: string; help: string }> = {
  escuro: { label: "Escuro", help: "Fundo preto com destaques na cor da empresa (padrão)." },
  claro: { label: "Claro", help: "Fundo claro, bom para ambientes iluminados e apresentações." },
  aparelho: { label: "Igual ao aparelho", help: "Segue o modo claro ou escuro do celular ou computador." },
};

/** Ícone na barra lateral: troca entre escuro e claro. */
export function ThemeToggleButton({ className }: { className?: string }) {
  const light = useResolvedTheme() === "light";
  const label = light ? "Usar tema escuro" : "Usar tema claro";
  return <Button variant="ghost" size="icon" onClick={() => applyTheme(light ? "escuro" : "claro")} className={className} aria-label={label} title={label}>{light ? <Moon /> : <Sun />}</Button>;
}

/** Linha no menu "Mais" do celular. */
export function ThemeToggleItem({ className }: { className?: string }) {
  const light = useResolvedTheme() === "light";
  return <button type="button" onClick={() => applyTheme(light ? "escuro" : "claro")} className={className}>{light ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}<span>{light ? "Tema escuro" : "Tema claro"}</span></button>;
}

/** Escolha completa (na janela da conta). Fica guardada neste aparelho. */
export function ThemeChoiceField() {
  const choice = useThemeChoice();
  return <fieldset className="grid gap-2">
    <legend className="mb-1 text-sm font-medium text-zinc-200">Aparência</legend>
    {THEME_CHOICES.map((value) => <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${choice === value ? "border-gold/50 bg-gold/[0.06]" : "border-white/10 bg-black/20"}`}>
      <input type="radio" name="app-theme" value={value} checked={choice === value} onChange={() => applyTheme(value)} className="mt-1" />
      <span><span className="font-medium text-white">{LABELS[value].label}</span><span className="block text-xs text-zinc-400">{LABELS[value].help}</span></span>
    </label>)}
    <p className="text-xs text-subtle">Vale para este aparelho. A tela de entrada e as folhas de impressão não mudam.</p>
  </fieldset>;
}
