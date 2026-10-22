import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/auth";
import { AuthShell } from "@/app/auth-shell";
import { LoginForm } from "@/app/entrar/login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar — Elite Expansion X" };

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <AuthShell kicker="Acesso seguro" title="Entrar na plataforma" description="Use o e-mail cadastrado pela sua organização e a sua senha.">
      <LoginForm />
      <p className="mt-6 text-center text-sm text-zinc-400">Sua empresa ainda não usa? <a href="/conheca" className="font-medium text-gold-soft hover:underline">Conheça a Elite Expansion X</a></p>
    </AuthShell>
  );
}
