"use client";
/**
 * Segurança da conta: verificação em duas etapas com app autenticador.
 * O QR code é desenhado no próprio aparelho (a chave nunca vai para um serviço externo).
 */
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import { CheckCircle2, Copy, Download, KeyRound, LoaderCircle, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { groupSecret } from "@/lib/totp";
import { tenantFetch } from "@/lib/tenant-request";

type Status = { enabled: boolean; enabledAt: string | null; recoveryLeft: number; required: boolean };
type Stage = { kind: "status" } | { kind: "setup"; secret: string; otpauth: string } | { kind: "codes"; codes: string[] } | { kind: "confirm"; action: "disable" | "recovery" };

async function call(method: "GET" | "POST", body?: Record<string, unknown>) {
  const response = await tenantFetch("/api/auth/mfa", { method, cache: "no-store", ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível continuar agora.");
  return result;
}
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");

function QrCode({ text }: { text: string }) {
  const src = useMemo(() => { const qr = qrcode(0, "M"); qr.addData(text); qr.make(); return qr.createDataURL(5, 2); }, [text]);
  // eslint-disable-next-line @next/next/no-img-element -- imagem gerada no aparelho (data URL), sem servidor de imagens
  return <img src={src} alt="QR code para cadastrar a Elite Expansion X no app autenticador" className="size-48 rounded-lg bg-white p-2" width={192} height={192} />;
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const text = `Elite Expansion X — códigos de recuperação da verificação em duas etapas\nCada código vale uma vez só. Guarde em lugar seguro.\n\n${codes.join("\n")}\n`;
  async function copy() { try { await navigator.clipboard.writeText(text); toast.success("Códigos copiados."); } catch { toast.error("Não foi possível copiar. Selecione os códigos e copie."); } }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })), a = document.createElement("a");
    a.href = url; a.download = "codigos-de-recuperacao-elite-x.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="grid gap-4">
    <p className="flex items-start gap-2 text-sm leading-6 text-zinc-200"><KeyRound className="mt-1 size-4 shrink-0 text-gold-soft" />Guarde estes códigos fora do celular. Se perder o celular, cada um entra uma vez no lugar do código do app. Eles não aparecem de novo.</p>
    <ul className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-sm tracking-wider text-white" aria-label="Códigos de recuperação">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={copy}><Copy /> Copiar</Button><Button variant="outline" onClick={download}><Download /> Baixar (.txt)</Button></div>
    <label className="flex items-start gap-2 text-sm text-zinc-300"><input type="checkbox" className="mt-1" checked={saved} onChange={(e) => setSaved(e.target.checked)} />Guardei os códigos em lugar seguro.</label>
    <Button className="bg-gold text-black" disabled={!saved} onClick={onDone}>Concluir</Button>
  </div>;
}

function CodeForm({ label, busy, onSubmit, submitLabel, allowRecovery = true }: { label: string; busy: boolean; onSubmit: (code: string) => void; submitLabel: string; allowRecovery?: boolean }) {
  return <form className="grid gap-3" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); onSubmit(String(new FormData(e.currentTarget).get("code") ?? "").trim()); }}>
    <label className="grid gap-1 text-sm text-zinc-200">{label}<input name="code" required autoFocus autoComplete="one-time-code" inputMode={allowRecovery ? "text" : "numeric"} maxLength={9} placeholder={allowRecovery ? "000000 ou XXXX-XXXX" : "000000"} className="commercial-input text-center text-lg tracking-[0.3em]" /></label>
    <Button type="submit" disabled={busy} className="bg-gold text-black">{busy ? <LoaderCircle className="animate-spin" /> : null}{submitLabel}</Button>
  </form>;
}

/** Painel da verificação em duas etapas. `required`: a empresa exige (sem a opção de desligar). */
export function AccountSecurityPanel({ onEnabled }: { onEnabled?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "status" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(() => call("GET").then((r) => setStatus(r.data)).catch((e: Error) => setError(e.message)), []);
  useEffect(() => { void load(); }, [load]);

  async function run(fn: () => Promise<void>) { setBusy(true); setError(""); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível continuar."); } finally { setBusy(false); } }

  if (!status) return error ? <p role="alert" className="text-sm text-red-200">{error}</p> : <p role="status" className="flex items-center gap-2 text-sm text-zinc-400"><LoaderCircle className="size-4 animate-spin" /> Carregando…</p>;

  if (stage.kind === "codes") return <RecoveryCodes codes={stage.codes} onDone={() => { setStage({ kind: "status" }); void load(); onEnabled?.(); }} />;
  if (stage.kind === "setup") return <div className="grid gap-4">
    <ol className="grid gap-1 text-sm leading-6 text-zinc-300"><li>1. Instale um app autenticador no celular (Google Authenticator, Microsoft Authenticator, Authy ou 1Password).</li><li>2. No app, toque em adicionar e leia o QR code abaixo.</li><li>3. Digite o código de 6 números que aparecer no app.</li></ol>
    <div className="flex flex-wrap items-center gap-4"><QrCode text={stage.otpauth} /><div className="min-w-0 text-xs text-zinc-400"><p>Não consegue ler o QR? Digite esta chave no app:</p><p className="mt-1 select-all break-all font-mono text-sm tracking-wider text-white">{groupSecret(stage.secret)}</p></div></div>
    <CodeForm label="Código de 6 números do app" busy={busy} allowRecovery={false} submitLabel="Ativar" onSubmit={(code) => void run(async () => { const r = await call("POST", { action: "confirm", code }); toast.success("Verificação em duas etapas ativa."); setStage({ kind: "codes", codes: r.data.recoveryCodes }); })} />
    {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
    <Button variant="ghost" onClick={() => { setStage({ kind: "status" }); setError(""); }}>Cancelar</Button>
  </div>;
  if (stage.kind === "confirm") return <div className="grid gap-3">
    <p className="text-sm text-zinc-300">{stage.action === "disable" ? "Para desligar, confirme com o código do app (ou um código de recuperação)." : "Os códigos antigos deixam de valer. Confirme com o código do app."}</p>
    <CodeForm label="Código" busy={busy} submitLabel={stage.action === "disable" ? "Desligar a verificação" : "Gerar códigos novos"} onSubmit={(code) => void run(async () => {
      if (stage.action === "disable") { await call("POST", { action: "disable", code }); toast.success("Verificação em duas etapas desligada."); setStage({ kind: "status" }); await load(); }
      else { const r = await call("POST", { action: "recovery", code }); setStage({ kind: "codes", codes: r.data.recoveryCodes }); }
    })} />
    {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
    <Button variant="ghost" onClick={() => { setStage({ kind: "status" }); setError(""); }}>Cancelar</Button>
  </div>;

  return <div className="grid gap-4">
    {status.enabled ? <>
      <p className="flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />Verificação em duas etapas ativa desde {day(status.enabledAt)}. {status.recoveryLeft} {status.recoveryLeft === 1 ? "código de recuperação restante" : "códigos de recuperação restantes"}.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setStage({ kind: "confirm", action: "recovery" })}><KeyRound /> Gerar códigos de recuperação novos</Button>
        {!status.required && <Button variant="ghost" onClick={() => setStage({ kind: "confirm", action: "disable" })}>Desligar</Button>}
      </div>
      {status.required && <p className="text-xs text-subtle">Sua empresa exige a verificação em duas etapas. Trocou de celular? Gere códigos novos com o celular antigo ou peça ao administrador para redefinir.</p>}
    </> : <>
      <p className="flex items-start gap-2 text-sm leading-6 text-zinc-300"><Smartphone className="mt-1 size-4 shrink-0 text-gold-soft" />Além da senha, a entrada pede um código de 6 números que muda a cada 30 segundos no seu celular. Mesmo que alguém descubra a senha, não entra sem o celular.</p>
      {status.required && <p className="rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold-pale">Sua empresa exige a verificação em duas etapas para usar a plataforma.</p>}
      <Button className="bg-gold text-black" disabled={busy} onClick={() => void run(async () => { const r = await call("POST", { action: "start" }); setStage({ kind: "setup", secret: r.data.secret, otpauth: r.data.otpauth }); })}>{busy ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Ativar verificação em duas etapas</Button>
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
    </>}
  </div>;
}

export function AccountSecurityDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto bg-zinc-950 text-white sm:max-w-lg">
      <DialogHeader><DialogTitle>Segurança da conta</DialogTitle><DialogDescription className="text-zinc-400">Verificação em duas etapas com um app autenticador no celular.</DialogDescription></DialogHeader>
      {open && <AccountSecurityPanel />}
    </DialogContent>
  </Dialog>;
}
