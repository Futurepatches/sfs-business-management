/* SFS ERP — app service worker (makes the ERP installable).
   - The ERP code (app.js, styles.css, config.js) and the page itself are always taken
     FRESH from the internet first; the saved copy is used only when there is no internet.
   - Pictures (logo, backgrounds, icons) are kept and refreshed in the background.
   - Data (Google Apps Script) is never touched or stored here. */
const CACHE = 'sfs-erp-v2';
const CORE = ['./', 'app.js', 'styles.css', 'config.js', 'logo.png', 'icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, {cache: 'reload'})))).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function fresh(req) {   /* internet first, saved copy only when offline */
  return fetch(req, {cache: 'no-cache'}).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, {ignoreSearch: true}).then(hit => hit || offlinePage(req)));
}
function offlinePage(req) {
  if (req.mode !== 'navigate') return Response.error();
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SFS ERP</title>'
    + '<body style="font-family:Arial,sans-serif;background:#eef3fb;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#1f3b63;text-align:center">'
    + '<div><div style="font-size:42px">📡</div><h2>No internet connection</h2><p style="color:#64748b">SFS ERP could not be opened. Please check the internet connection and try again.</p>'
    + '<button onclick="location.reload()" style="background:#1f3b63;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-size:15px">Try again</button></div>',
    {headers: {'Content-Type': 'text/html; charset=utf-8'}});
}
function keep(req) {     /* pictures: saved copy now, refresh in the background */
  return caches.open(CACHE).then(c => c.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;   /* data / Google / CDN: untouched */
  if (req.mode === 'navigate' || /\.(js|css|webmanifest)$/.test(url.pathname)) { e.respondWith(fresh(req)); return; }
  if (/\.(png|jpe?g|webp|svg|ico|gif)$/.test(url.pathname)) { e.respondWith(keep(req)); return; }
});
