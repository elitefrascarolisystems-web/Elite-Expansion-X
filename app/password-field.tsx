"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Campo de senha com botão de mostrar/ocultar. */
export function PasswordField({ id, name, label, autoComplete, autoFocus }: { id: string; name: string; label: string; autoComplete: string; autoFocus?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium text-zinc-200">{label}</label>
      <div className="relative">
        <Input id={id} name={name} type={visible ? "text" : "password"} required autoComplete={autoComplete} autoFocus={autoFocus} maxLength={200} className="h-12 border-white/12 bg-black/30 pr-11 text-white focus-visible:border-[#c9a227]/60" />
        <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-zinc-500 hover:text-zinc-200">
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
