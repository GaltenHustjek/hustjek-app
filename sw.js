/* Galten Hustjek – offline. Ved nye versioner: hæv VERSION, så telefonen henter de nye filer. */
const VERSION = 'gh-mweyver8';
const FILES = [
  './', 'index.html', 'tools/dv.html', 'tools/vp.html', 'tools/kr.html', 'tools/mg.html', 'tools/bt.html', 'tools/tr.html', 'manifest.webmanifest', 'lib/docx.umd.js', 'lib/fonts/GHSans-Bold.ttf', 'lib/fonts/GHSans-Regular.ttf', 'lib/fonts/source-sans-3-latin-400-normal.woff2', 'lib/fonts/source-sans-3-latin-500-normal.woff2', 'lib/fonts/source-sans-3-latin-600-normal.woff2', 'lib/fonts/source-sans-3-latin-700-normal.woff2', 'lib/fonts/source-sans-3-latin-ext-400-normal.woff2', 'lib/fonts/source-sans-3-latin-ext-500-normal.woff2', 'lib/fonts/source-sans-3-latin-ext-600-normal.woff2', 'lib/fonts/source-sans-3-latin-ext-700-normal.woff2', 'lib/fonts/source-sans-3.css', 'lib/html2pdf.bundle.min.js', 'lib/jspdf.plugin.autotable.min.js', 'lib/jspdf.umd.min.js', 'lib/pdf.min.js', 'lib/pdf.worker.min.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/logo.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, {cache: 'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !fonts) return;
  if (url.origin === location.origin && url.pathname.endsWith('/version.json')) return;   // altid frisk fra nettet
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, {ignoreSearch: url.origin === location.origin});
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) cache.put(url.origin === location.origin ? new Request(url.origin + url.pathname) : req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net;
    if (r) return r;
    if (req.mode === 'navigate') { const idx = await cache.match('index.html'); if (idx) return idx; }
    return new Response('Offline – filen er ikke gemt på enheden endnu.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
  })());
});
