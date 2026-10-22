import "maplibre-gl/dist/maplibre-gl.css";
import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elite Expansion X — Embaixadores",
  description: "Gestão de cidades, embaixadores, custos e resultados da Expansão Elite.",
  icons: {
    icon: [{url: "/elite-academy-official.svg", type: "image/svg+xml"}, {url: "/elite-academy-official.png", type: "image/png"}],
    shortcut: "/elite-academy-official.png",
    apple: "/app/apple-touch-icon.png",
  },
  // App no celular: instalável na tela inicial e abre em tela cheia (public/sw.js).
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Elite X", statusBarStyle: "black" },
};

export const viewport: Viewport = { themeColor: "#070706" };

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
