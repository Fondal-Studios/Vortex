// Service worker: instalable en la pantalla de inicio. RED PRIMERO para el código (así nunca queda una versión vieja pegada) y caché de respaldo sin conexión.
const CACHE = 'cristal-vortice-v6-four-actions';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.endsWith('/ws') || u.pathname.endsWith('/health')) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try { const r = await fetch(e.request); if (r.ok && r.type === 'basic') c.put(e.request, r.clone()); return r; }
    catch { const hit = await c.match(e.request, { ignoreSearch: false }); if (hit) return hit; throw new Error('sin conexión'); }
  })());
});
