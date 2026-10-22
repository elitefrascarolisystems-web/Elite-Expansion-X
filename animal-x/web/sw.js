// Service worker do Animal X: guarda o pacote inteiro para uso sem internet.
// A API (/api/) nunca é guardada em cache.
const VERSAO = 'animalx-__VERSAO__';
const ARQUIVOS = [/* __ARQUIVOS__ */];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c.startsWith('animalx-') && c !== VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);
  if (evento.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  evento.respondWith(
    caches.match(evento.request, { ignoreSearch: true }).then((resposta) => {
      if (resposta) return resposta;
      return fetch(evento.request).catch(() => caches.match('./'));
    }),
  );
});
