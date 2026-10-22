import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

/**
 * Configuração do Worker. Na publicação (GitHub Actions), as variáveis de
 * ambiente apontam para o Worker e o banco D1 reais; sem elas, valores locais
 * de desenvolvimento e teste. Nada aqui é segredo.
 */
const deployVars = Object.fromEntries(
  ["MAPS_EXTERNAL_ENABLED", "PUBLIC_MAPTILER_KEY", "PUBLIC_MAPTILER_SATELLITE_ID", "PUBLIC_MAPTILER_HYBRID_ID", "PUBLIC_GOOGLE_EMBED_KEY"]
    .filter((name) => process.env[name])
    .map((name) => [name, process.env[name] as string]),
);

const localBindingConfig = {
  name: process.env.WORKER_NAME || "elite-expansion-x",
  main: "./worker/index.ts",
  compatibility_date: "2026-05-15",
  compatibility_flags: ["nodejs_compat"],
  ...(Object.keys(deployVars).length ? { vars: deployVars } : {}),
  // O worker/index.ts lê os arquivos estáticos (logo, imagens) por env.ASSETS.
  assets: { binding: "ASSETS" },
  // Avisos por e-mail: todo dia às 10h30 UTC = 7h30 de Brasília (db/notifications.ts).
  triggers: { crons: ["30 10 * * *"] },
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: process.env.D1_DATABASE_NAME || "site-creator-d1",
          database_id: process.env.D1_DATABASE_ID || SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
          migrations_dir: "drizzle",
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
