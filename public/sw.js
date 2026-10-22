/*
 * Elite Expansion X — app no celular.
 *
 * Guarda o próprio app (scripts, estilos, ícones) e a última tela aberta de
 * cada organização, para a plataforma abrir em campo sem internet. Os dados
 * (/api/) nunca vêm do cache: sem conexão, o mapeamento guarda os cadastros no
 * aparelho (lib/offline-queue.ts) e envia quando o sinal volta.
 * Ao sair da plataforma, as telas guardadas são apagadas.
 */
const VERSION = "v2";
const STATIC = `elite-static-${VERSION}`;
const PAGES = `elite-pages-${VERSION}`;
const SHELL = ["/offline", "/manifest.webmanifest", "/app/icon-192.png", "/elite-emblem.png", "/elite-emblem-sm.png", "/fonts/inter.woff2", "/fonts/sora.woff2", "/fonts/space-grotesk.woff2"];
const MAX_STATIC = 250;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith("elite-") && key !== STATIC && key !== PAGES).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

// A página avisa o que já carregou antes de o app ficar instalado neste aparelho.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-assets" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(caches.open(STATIC).then(async (cache) => {
    for (const raw of event.data.urls.slice(0, 200)) {
      const url = new URL(raw, self.location.origin);
      if (url.origin !== self.location.origin || !isStatic(url) || await cache.match(url.href)) continue;
      const response = await fetch(url.href).catch(() => null);
      if (response?.ok) await cache.put(url.href, response);
    }
    await trim(cache);
  }));
});

function isStatic(url) {
  return url.pathname.startsWith("/assets/") || url.pathname.startsWith("/api/organization-logo")
    || /\.(?:png|svg|jpg|jpeg|webp|ico|woff2?|css|js|webmanifest)$/.test(url.pathname);
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_STATIC))) {
    if (!SHELL.includes(new URL(key.url).pathname)) await cache.delete(key);
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && url.pathname === "/api/auth/logout") {
    event.waitUntil(caches.delete(PAGES));
    return;
  }
  if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/organization-logo")) return;
  if (request.mode === "navigate") event.respondWith(page(event, request, url));
  else if (isStatic(url)) event.respondWith(asset(event, request, url));
});

// Telas: sempre da rede quando há sinal; sem sinal, a última tela guardada da
// organização (uma por organização, para o aparelho não acumular cópias).
async function page(event, request, url) {
  const org = url.searchParams.get("org");
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected && response.type === "basic" && url.pathname === "/" && org) {
      const copy = response.clone();
      event.waitUntil(caches.open(PAGES).then((cache) => Promise.all([
        cache.put(`/__ultima?org=${org}`, copy), cache.put(`/__ultima-url?org=${org}`, new Response(url.pathname + url.search)), cache.put("/__ultima-org", new Response(org)),
      ])));
    }
    return response;
  } catch {
    const cache = await caches.open(PAGES);
    const saved = url.pathname === "/" && org && await cache.match(`/__ultima?org=${org}`);
    if (saved) {
      // A tela guardada é a da última área aberta: o endereço passa a ser o dela,
      // para a área mostrada e a da barra de endereço serem a mesma.
      const savedUrl = await (await cache.match(`/__ultima-url?org=${org}`))?.text();
      return savedUrl && savedUrl !== url.pathname + url.search ? Response.redirect(savedUrl, 302) : saved;
    }
    // Ícone na tela inicial abre "/": sem sinal, volta para a última organização usada.
    const last = url.pathname === "/" && !org ? await cache.match("/__ultima-org") : null;
    if (last) return Response.redirect(`/?org=${encodeURIComponent(await last.text())}`, 302);
    return (await caches.match("/offline")) || Response.error();
  }
}

// Arquivos com hash no nome não mudam: do cache. Os outros: do cache e atualiza por trás.
async function asset(event, request, url) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  const update = fetch(request).then(async (response) => {
    if (response.ok && response.type === "basic") { await cache.put(request, response.clone()); await trim(cache); }
    return response;
  });
  if (cached) {
    if (!url.pathname.startsWith("/assets/")) event.waitUntil(update.catch(() => undefined));
    return cached;
  }
  return update.catch(() => Response.error());
}
