import type { Metadata } from "next";
import { AuthShell } from "@/app/auth-shell";
import { PasswordForm } from "@/app/definir-senha/password-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Definir senha — Elite Expansion X", referrer: "no-referrer" };

export default function SetPasswordPage() {
  return (
    <AuthShell kicker="Primeiro acesso" title="Defina sua senha" description="Este link é pessoal, vale por 72 horas e só pode ser usado uma vez.">
      <PasswordForm />
    </AuthShell>
  );
}
