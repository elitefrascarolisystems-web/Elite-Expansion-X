import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elite Expansão — Embaixadores",
  description: "Gestão de cidades, embaixadores, custos e resultados da Expansão Elite.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
