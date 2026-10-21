"use client";

import { type FormEvent, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { PasswordField } from "@/app/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível entrar agora.");
      window.location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar agora.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-2">
        <label htmlFor="email" className="text-sm font-medium text-zinc-200">E-mail</label>
        <Input id="email" name="email" type="email" required autoComplete="username" autoFocus maxLength={254} placeholder="voce@empresa.com" className="h-12 border-white/12 bg-black/30 text-white focus-visible:border-[#c9a227]/60" />
      </div>
      <PasswordField id="password" name="password" label="Senha" autoComplete="current-password" />
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">{error}</p>}
      <Button type="submit" disabled={busy} className="h-12 bg-gradient-to-r from-[#f3d27a] via-[#c9a227] to-[#b8901f] text-base font-semibold tracking-wide text-black shadow-[0_10px_30px_-10px_rgba(201,162,39,0.7)] transition hover:brightness-110">
        {busy ? <><LoaderCircle className="animate-spin" /> Entrando…</> : "Entrar"}
      </Button>
      <p className="text-center text-xs leading-5 text-zinc-500">Esqueceu a senha ou ainda não tem uma? Peça ao administrador da sua organização um link de acesso.</p>
    </form>
  );
}
