// Service worker: permite abrir o app sem internet e instalá-lo.
// A página é buscada primeiro na internet (para receber atualizações) e, sem conexão, vem da cópia guardada.
const CACHE = 'escritorio-v27';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './apple-touch-icon-precomposed.png', './favicon-64.png',
  './css/estilo.css', './js/acoes.js', './js/base.js', './js/cadastros.js', './js/dropbox.js', './js/financeiro.js', './js/ia.js', './js/inicio.js', './js/logo.js', './js/publicacoes.js', './js/rapido-e-celular.js', './js/sugestao-prazos.js', './js/navegador.js', './js/telas.js'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => Promise.all(ARQUIVOS.map(f => c.add(f).catch(() => {}))))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if(e.request.method !== 'GET' || u.origin !== self.location.origin) return; // Google e outros: direto pela internet
  if(e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html')){
    e.respondWith(fetch(e.request, {cache:'no-cache'}).then(r => { if(r.ok && !u.search.includes('nv=')){ const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); } return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(fetch(e.request).then(r => { if(r.ok){ const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request, {ignoreSearch:true})));
});
