"use client";
/**
 * Segundo passo da entrada: o código do app autenticador (ou um código de recuperação).
 * Usado depois da senha na tela de entrada e depois de definir a senha por um link.
 */
import { type FormEvent, useState } from "react";
import { KeyRound, LoaderCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MfaCodeStep({ challenge, onRestart }: { challenge: string; onRestart: () => void }) {
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challenge, code }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = String(result.error || "Não foi possível entrar agora.");
        // Desafio vencido ou tentativas esgotadas: volta para a senha.
        if (/senha de novo/i.test(message)) { onRestart(); return; }
        throw new Error(message);
      }
      window.location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar agora.");
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="grid gap-5">
    <div className="flex items-start gap-3 rounded-xl border border-gold/25 bg-gold/[0.06] p-4 text-sm leading-6 text-zinc-200">
      {recovery ? <KeyRound className="mt-0.5 size-5 shrink-0 text-gold-soft" /> : <Smartphone className="mt-0.5 size-5 shrink-0 text-gold-soft" />}
      <p>{recovery ? "Digite um dos códigos de recuperação que você guardou (cada um vale uma vez só)." : "Abra o app autenticador no celular e digite o código de 6 números da Elite Expansion X."}</p>
    </div>
    <div className="grid gap-2">
      <label htmlFor="mfa-code" className="text-sm font-medium text-zinc-200">{recovery ? "Código de recuperação" : "Código do app"}</label>
      <Input key={recovery ? "rec" : "app"} id="mfa-code" name="code" required autoFocus autoComplete="one-time-code" inputMode={recovery ? "text" : "numeric"}
        pattern={recovery ? "[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}" : "[0-9]{6}"} maxLength={recovery ? 9 : 6} placeholder={recovery ? "XXXX-XXXX" : "000000"}
        className="h-12 border-white/12 bg-black/30 text-center text-lg tracking-[0.35em] text-white focus-visible:border-gold/60" />
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">{error}</p>}
    <Button type="submit" disabled={busy} className="h-12 bg-gold text-base font-semibold text-black hover:bg-gold-hover">{busy ? <><LoaderCircle className="animate-spin" /> Conferindo…</> : "Entrar"}</Button>
    <div className="flex flex-wrap justify-between gap-2 text-xs">
      <button type="button" className="text-gold-soft hover:underline" onClick={() => { setRecovery((v) => !v); setError(""); }}>{recovery ? "Usar o código do app" : "Perdeu o celular? Usar um código de recuperação"}</button>
      <button type="button" className="text-subtle hover:underline" onClick={onRestart}>Voltar</button>
    </div>
    <p className="text-center text-xs leading-5 text-subtle">Sem o celular e sem os códigos? Peça ao administrador da sua empresa para redefinir a verificação.</p>
  </form>;
}
