// Swaalia hors ligne : chaque fichier chargé est gardé en cache ; le bouton « Télécharger le jeu » met tout en cache d'un coup.
const C = 'swaalia-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return; const u = new URL(r.url); if (u.origin !== location.origin) return;
  const page = r.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html') || u.pathname.endsWith('offline.json');
  if (page) {   // la page : d'abord le réseau (pour les mises à jour), sinon la copie gardée
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r, { ignoreSearch: true }))));
});
self.addEventListener('message', e => {
  if (!e.data || e.data.t !== 'dl') return; const port = e.ports[0];
  e.waitUntil((async () => {
    const list = await (await fetch('offline.json', { cache: 'no-store' })).json(), c = await caches.open(C); let n = 0;
    for (let i = 0; i < list.length; i += 6) {
      await Promise.all(list.slice(i, i + 6).map(async f => { try { if (!(await c.match(f, { ignoreSearch: true }))) { const res = await fetch(f); if (res.ok) await c.put(f, res); } } catch (er) {} n++; }));
      port.postMessage({ n, tot: list.length });
    }
    port.postMessage({ done: true, tot: list.length });
  })());
});
