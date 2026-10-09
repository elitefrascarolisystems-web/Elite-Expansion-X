import "maplibre-gl/dist/maplibre-gl.css";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elite Expansion X — Embaixadores",
  description: "Gestão de cidades, embaixadores, custos e resultados da Expansão Elite.",
  icons: {
    icon: [{url: "/elite-academy-official.svg", type: "image/svg+xml"}, {url: "/elite-academy-official.png", type: "image/png"}],
    shortcut: "/elite-academy-official.png",
    apple: "/elite-academy-official.png",
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
