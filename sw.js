/* The site's saver (5 Nov 2026; user: "if I want to show someone this site I dont want them to go through the hassle of the offer of
   install app", then "Silent saving first"). A service worker, copied next to the lock screen by src/site/lock.js publish. It keeps two
   kinds of file on the device, and nothing else:
     - the lock screen (index.html): asked for afresh whenever there is a connection; the kept copy is used only if the network fails or
       is slow (3 seconds), so a new version is seen as soon as it is published;
     - the scrambled site (d-<version>.bin): kept until a new version replaces it, so a second visit opens at once, and offline.
   Nothing unscrambled is ever stored: the site is unlocked in the page, as before. No install prompt is involved (there is no app
   manifest), and every other request (the scripture services, maps, photographs) goes to the network untouched. */
const CACHE = 'tf-site-1', SLOW = 3000;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('tf-site-')) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url), scope = new URL(self.registration.scope);
  if (u.origin !== scope.origin || !u.pathname.startsWith(scope.pathname)) return;
  const rel = u.pathname.slice(scope.pathname.length);
  if (/^d-[0-9a-f]{16}\.bin$/.test(rel)) e.respondWith(site(req, rel));
  else if (rel === '' || rel === 'index.html') e.respondWith(lock(req));
});
/* the scrambled site: from the device if kept, else from the network (and then kept, the older versions let go) */
async function site(req, name){
  const c = await caches.open(CACHE), hit = await c.match(name);
  if (hit) return hit;
  const r = await fetch(req.url, { cache:'no-cache' });
  if (r.ok){
    await c.put(name, r.clone());
    for (const k of await c.keys()){ const n = new URL(k.url).pathname.split('/').pop(); if (/^d-[0-9a-f]{16}\.bin$/.test(n) && n !== name) await c.delete(k); }
  }
  return r;
}
/* the lock screen: the network's copy when it answers in time (kept for next time), else the kept copy */
async function lock(req){
  const c = await caches.open(CACHE);
  const net = fetch(req.url.split('#')[0].split('?')[0], { cache:'no-cache' }).then(async r => { if (r.ok) await c.put('index.html', r.clone()); return r; });
  const kept = await c.match('index.html');
  if (!kept) return net.catch(() => Response.error());
  const late = new Promise(res => setTimeout(() => res(null), SLOW));
  const first = await Promise.race([net.catch(() => null), late]);
  return first && first.ok ? first : kept;
}
