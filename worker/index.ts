/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { ORGANIZATION_HEADER } from "../lib/tenant-request";
import { runNotifications } from "../db/notifications";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  // Opcional: sem o serviço de imagens da Cloudflare, a imagem original é servida.
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image" && !env.IMAGES) {
      const source = url.searchParams.get("url");
      if (!source || !source.startsWith("/") || source.startsWith("//")) return new Response("Imagem inválida.", { status: 400 });
      return env.ASSETS.fetch(new Request(new URL(source, request.url)));
    }

    if (url.pathname === "/_vinext/image" && env.IMAGES) {
      const images = env.IMAGES;
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await images.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    // Páginas: o vinext 0.0.50 entrega searchParams vazio na pré-renderização
    // (probePage), e a página redirecionaria sem parar. Repassamos o ?org= da
    // URL no mesmo header que as APIs já usam; a URL sempre vence o que o
    // navegador mandar. O vínculo com a organização é conferido na página.
    if (!url.pathname.startsWith("/api/")) {
      const pageHeaders = new Headers(request.headers);
      const org = url.searchParams.get("org");
      if (org === null) pageHeaders.delete(ORGANIZATION_HEADER);
      else pageHeaders.set(ORGANIZATION_HEADER, org);
      request = new Request(request, { headers: pageHeaders });
    }

    return handler.fetch(request, env, ctx);
  },

  // Avisos por e-mail: a rodada diária (7h30 de Brasília; às segundas inclui o resumo semanal).
  async scheduled(): Promise<void> {
    try { console.log("Avisos por e-mail:", JSON.stringify(await runNotifications())); }
    catch (error) { console.error("Avisos por e-mail:", error); }
  },
};

export default worker;
