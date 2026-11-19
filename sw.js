// Service worker: permite abrir o app sem internet e instalá-lo.
// A página é buscada primeiro na internet (para receber atualizações) e, sem conexão, vem da cópia guardada.
const CACHE = 'escritorio-v74';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './apple-touch-icon-precomposed.png', './favicon-64.png',
  './css/estilo.css', './js/acoes.js', './js/base.js', './js/cadastros.js', './js/dropbox.js', './js/financeiro.js', './js/plano-contas.js', './js/financeiro-contas.js', './js/participacoes.js', './js/financeiro-painel.js', './js/recebimentos.js', './js/servicos.js', './js/relatorios.js', './js/publicacoes-fontes.js', './js/ia.js', './js/inicio.js', './js/logo.js', './js/publicacoes.js', './js/rapido-e-celular.js', './js/sugestao-prazos.js', './js/navegador.js', './js/google-agenda.js', './js/timesheet.js', './js/campos.js', './js/pessoas-campos.js', './js/lote.js', './js/colunas.js', './js/notificacoes.js', './js/assistente.js', './js/calculadora.js', './js/importar-antigos.js', './js/cadastro-link.js', './js/compromissos.js', './js/workflows.js', './js/backup.js', './js/verificacao.js', './js/telas.js'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => Promise.all(ARQUIVOS.map(f => c.add(f).catch(() => {}))))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if(e.request.method !== 'GET' || u.origin !== self.location.origin) return; // Google e outros: direto pela internet
  if(u.pathname.endsWith('/cadastro.html')) return; // página pública de cadastro de clientes: sempre direto pela internet, sem cache
  if(e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html')){
    e.respondWith(fetch(e.request, {cache:'no-cache'}).then(r => { if(r.ok && !u.search.includes('nv=')){ const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); } return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(fetch(e.request).then(r => { if(r.ok){ const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request, {ignoreSearch:true})));
});

// clique numa notificação do sistema: volta para o app (ou abre) na tela certa
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(cs => {
    for(const c of cs){ if('focus' in c){ c.postMessage({tipo:'abrir', url}); return c.focus(); } }
    return self.clients.openWindow ? self.clients.openWindow(url) : null; }));
});
