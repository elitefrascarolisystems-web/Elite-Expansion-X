import "maplibre-gl/dist/maplibre-gl.css";
import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elite Expansion X — Embaixadores",
  description: "Gestão de cidades, embaixadores, custos e resultados da Expansão Elite.",
  icons: {
    // Ícone leve (o PNG oficial tem 1080 px e 120 KB; o da aba do navegador não precisa disso).
    icon: [{url: "/elite-academy-official.svg", type: "image/svg+xml"}, {url: "/app/icon-192.png", type: "image/png"}],
    shortcut: "/app/icon-192.png",
    apple: "/app/apple-touch-icon.png",
  },
  // App no celular: instalável na tela inicial e abre em tela cheia (public/sw.js).
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Elite X", statusBarStyle: "black" },
};

export const viewport: Viewport = { themeColor: "#050504" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Fontes da primeira tela: chegam junto com a página, sem trocar de letra no meio. */}
        <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/sora.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/space-grotesk.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
