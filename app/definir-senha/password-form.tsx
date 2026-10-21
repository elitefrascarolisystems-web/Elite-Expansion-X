"use client";

import { type FormEvent, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { PasswordField } from "@/app/password-field";
import { Button } from "@/components/ui/button";

type LinkInfo = { email: string; hasPassword: boolean };

/** O token vem depois do "#" no link: essa parte nunca é enviada ao servidor nem fica em registros de acesso. */
function linkToken() {
  return typeof window === "undefined" ? "" : window.location.hash.slice(1);
}

async function call(body: Record<string, string>) {
  const response = await fetch("/api/auth/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível continuar agora.");
  return result;
}

export function PasswordForm() {
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = linkToken();
    const check = token ? call({ action: "info", token }) : Promise.reject(new Error("Abra o link completo que você recebeu do administrador."));
    check.then(setInfo).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) { setError("As duas senhas não são iguais."); return; }
    setBusy(true);
    setError("");
    try {
      await call({ action: "set", token: linkToken(), password });
      window.history.replaceState(null, "", "/definir-senha");
      window.location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar a senha agora.");
      setBusy(false);
    }
  }

  if (loading) return <p className="flex items-center gap-2 text-sm text-zinc-400"><LoaderCircle className="size-4 animate-spin" /> Conferindo o link…</p>;
  if (!info) return (
    <div className="grid gap-5">
      <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">{error}</p>
      <a href="/entrar" className="text-center text-sm font-medium text-[#e8c766] hover:underline">Ir para a tela de entrada</a>
    </div>
  );
  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm"><span className="text-zinc-500">Conta: </span><span className="font-medium text-white">{info.email}</span></div>
      <PasswordField id="password" name="password" label={info.hasPassword ? "Nova senha" : "Crie sua senha"} autoComplete="new-password" autoFocus />
      <PasswordField id="confirm" name="confirm" label="Repita a senha" autoComplete="new-password" />
      <p className="text-xs leading-5 text-zinc-500">Mínimo de 10 caracteres, com letras e números. Não use o seu e-mail.</p>
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">{error}</p>}
      <Button type="submit" disabled={busy} className="h-12 bg-gradient-to-r from-[#f3d27a] via-[#c9a227] to-[#b8901f] text-base font-semibold tracking-wide text-black shadow-[0_10px_30px_-10px_rgba(201,162,39,0.7)] transition hover:brightness-110">
        {busy ? <><LoaderCircle className="animate-spin" /> Salvando…</> : info.hasPassword ? "Salvar nova senha e entrar" : "Criar senha e entrar"}
      </Button>
    </form>
  );
}
