"use client";
import { useState } from "react";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TEAM_SIZES } from "@/lib/subscription-requests";

/** Formulário público do pedido de apresentação (cai em Plataforma → Pedidos de assinatura). */
export function RequestForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const data = {
      company: f.get("company"), contactName: f.get("contactName"), email: f.get("email"), whatsapp: f.get("whatsapp"), city: f.get("city"),
      teamSize: f.get("teamSize"), message: f.get("message") ?? "", consent: f.get("consent") === "on", website: f.get("website") ?? "",
    };
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/subscription-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "submit", data }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "Não foi possível enviar agora. Tente de novo em instantes.");
      setSent(String(data.contactName ?? "").split(" ")[0] || "Obrigado");
    } catch (e) { setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sem conexão. Confira a internet e tente de novo."); }
    finally { setBusy(false); }
  }

  if (sent) return <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-50">
    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden />
    <div><p className="font-semibold">{sent}, pedido recebido.</p><p className="mt-1 text-emerald-100/90">A equipe da Elite vai falar com você pelo WhatsApp ou e-mail que você informou.</p></div>
  </div>;

  return <form onSubmit={submit} className="grid gap-4 text-sm">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1 sm:col-span-2">Nome da empresa<input name="company" required minLength={2} maxLength={120} autoComplete="organization" className="commercial-input" /></label>
      <label className="grid gap-1">Seu nome<input name="contactName" required minLength={2} maxLength={120} autoComplete="name" className="commercial-input" /></label>
      <label className="grid gap-1">Cidade e estado<input name="city" required minLength={2} maxLength={120} placeholder="Ex.: Belo Horizonte, MG" className="commercial-input" /></label>
      <label className="grid gap-1">E-mail<input name="email" type="email" required maxLength={254} autoComplete="email" className="commercial-input" /></label>
      <label className="grid gap-1">WhatsApp<input name="whatsapp" required inputMode="tel" maxLength={40} autoComplete="tel" placeholder="(31) 99999-0000" className="commercial-input" /></label>
      <label className="grid gap-1 sm:col-span-2">Tamanho da equipe<select name="teamSize" required defaultValue="" className="commercial-input"><option value="" disabled>Selecione</option>{TEAM_SIZES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="grid gap-1 sm:col-span-2">O que você quer organizar? (opcional)<textarea name="message" maxLength={1000} rows={3} placeholder="Ex.: queremos expandir para 5 cidades e acompanhar os embaixadores." className="commercial-input min-h-24" /></label>
    </div>
    {/* Campo armadilha para robôs: fica fora da tela e fora da navegação por teclado. */}
    <label aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">Site<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <label className="flex items-start gap-2 text-zinc-300"><input type="checkbox" name="consent" required className="mt-1" />Autorizo a Elite Frascaroli Academy a entrar em contato pelo WhatsApp e pelo e-mail informados para falar sobre a Elite Expansion X.</label>
    {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">{error}</p>}
    <Button type="submit" disabled={busy} className="h-11 w-full bg-gold text-base text-black hover:bg-gold-hover sm:w-fit sm:px-6">{busy ? <LoaderCircle className="animate-spin" /> : <Send />} Pedir apresentação</Button>
  </form>;
}
