/* ================= APARÊNCIA: paletas de cores + ajustes =================
   Carregado logo no início (antes dos outros scripts) para aplicar as cores sem “piscar”.
   Fica só neste aparelho (localStorage 'escritorio_aparencia'), como o Claro/Escuro ('escritorio_tema').
   As cores de alerta (vermelho = atrasado, âmbar = hoje/aviso, verde = ok) NÃO mudam com a paleta,
   exceto quando a cor da paleta se confundiria com o aviso (dourado → aviso fica laranja).
   Cada paleta tem versão clara e escura; os ajustes (fundo, menu, destaque, botões) são guardados por modo. */
const AP_KEY = 'escritorio_aparencia';
const AP_PALETAS = {
  azul:{nome:'Azul (padrão)',
    claro:{bg:'#f4f5f7', panel:'#ffffff', text:'#1d2330', muted:'#6b7385', line:'#e2e5ea', pri:'#1f4e79', pri2:'#2d6aa3', priSoft:'#e7eff8', priText:'#ffffff', side:'#16263a', sideText:'#c9d3e0', acc:'#1f4e79', accText:'#ffffff'},
    escuro:{bg:'#12161d', panel:'#1b212b', text:'#e6e9ef', muted:'#9aa3b2', line:'#2c3441', pri:'#5b9bd5', pri2:'#7fb2e0', priSoft:'#1f2d3d', priText:'#ffffff', side:'#0d1117', sideText:'#aeb8c6', acc:'#5b9bd5', accText:'#ffffff'}},
  marinho:{nome:'Marinho e amarelo',
    claro:{bg:'#f4f6f8', panel:'#ffffff', text:'#16202e', muted:'#5d6b7e', line:'#dfe4eb', pri:'#1c3556', pri2:'#2a4a75', priSoft:'#e6ebf2', side:'#12263f', sideText:'#c4cfdd', acc:'#f5b700', accText:'#12263f'},
    escuro:{bg:'#0d1826', panel:'#14223a', text:'#e8edf4', muted:'#a9b8cc', line:'#24344d', pri:'#8fb3e6', pri2:'#aac6ee', priSoft:'#1b2d48', side:'#0a1320', sideText:'#a9b8cc', acc:'#f5b700', accText:'#12263f'}},
  verde:{nome:'Verde-escuro e âmbar',
    claro:{bg:'#f3f6f4', panel:'#ffffff', text:'#16231e', muted:'#5b6b63', line:'#dde6e1', pri:'#1e4a3c', pri2:'#2b6552', priSoft:'#e3eee9', side:'#14352b', sideText:'#c6d8cf', acc:'#e8a33d', accText:'#14352b'},
    escuro:{bg:'#0e1b17', panel:'#152822', text:'#e7efeb', muted:'#b7c9bf', line:'#244036', pri:'#7cc7aa', pri2:'#9dd6c0', priSoft:'#1b3a30', side:'#0a1511', sideText:'#b7c9bf', acc:'#e8a33d', accText:'#14352b'}},
  laranja:{nome:'Claro, azul e laranja',
    claro:{bg:'#faf7f0', panel:'#fffdf9', text:'#12263f', muted:'#4a5868', line:'#e7e1d4', pri:'#1f4e8c', pri2:'#2b63ad', priSoft:'#e5edf7', side:'#efe9dc', sideText:'#12263f', acc:'#f28c28', accText:'#12263f'},
    escuro:{bg:'#101c2c', panel:'#172638', text:'#f1ede4', muted:'#a8b3c2', line:'#273a52', pri:'#6fa0dd', pri2:'#8db5e8', priSoft:'#1c2f47', side:'#0b1522', sideText:'#c8d0db', acc:'#f28c28', accText:'#12263f'}},
  dourado:{nome:'Off-white e dourado',
    claro:{bg:'#f3eee3', panel:'#fbf8f2', text:'#1c1b19', muted:'#5f5b53', line:'#e2dacb', pri:'#8a5e0f', pri2:'#a5731d', priSoft:'#f1e6cf', side:'#1c1b19', sideText:'#d6cfc2', acc:'#c98a1b', accText:'#1c1b19', warn:'#c2540a', warnSoft:'#fbe6d6'},
    escuro:{bg:'#141311', panel:'#1e1d1a', text:'#efe9dd', muted:'#a59e90', line:'#33302b', pri:'#d9a441', pri2:'#e6b95f', priSoft:'#2e2618', side:'#0e0d0c', sideText:'#c9c1b2', acc:'#c98a1b', accText:'#1c1b19', warn:'#f0883e', warnSoft:'#3a2414'}},
};
// cores prontas para os ajustes (por modo). Todas testadas para manter o texto legível.
const AP_OPCOES = {
  bg:{nome:'Fundo', dica:'cor atrás dos cartões',
    claro:[['#f4f5f7','Cinza-claro'],['#ffffff','Branco'],['#faf7f0','Creme'],['#f3eee3','Areia'],['#eef2f7','Azul-claro'],['#f3f6f4','Verde-claro'],['#f5f3f7','Lilás-claro'],['#f7f1ee','Rosado']],
    escuro:[['#12161d','Grafite'],['#0d1826','Marinho'],['#0e1b17','Verde'],['#141311','Café'],['#17151c','Ameixa'],['#1a1a1a','Cinza'],['#000000','Preto']]},
  side:{nome:'Menu lateral', dica:'barra da esquerda, quadro “Hoje” e avisos',
    claro:[['#16263a','Azul-noite'],['#12263f','Marinho'],['#14352b','Verde-escuro'],['#1c1b19','Preto'],['#2f3640','Grafite'],['#3b2f4a','Roxo'],['#5a1f2a','Bordô'],['#efe9dc','Creme'],['#e9eef5','Azul-claro'],['#ffffff','Branco']],
    escuro:[['#0d1117','Grafite'],['#0a1320','Marinho'],['#0a1511','Verde'],['#0e0d0c','Preto'],['#1b1424','Roxo'],['#220d12','Bordô'],['#1f2937','Ardósia']]},
  acc:{nome:'Destaque do menu', dica:'item aberto no menu lateral',
    claro:[['#1f4e79','Azul'],['#f5b700','Amarelo'],['#e8a33d','Âmbar'],['#f28c28','Laranja'],['#c98a1b','Dourado'],['#23834b','Verde'],['#0d7f75','Turquesa'],['#7a55b0','Roxo'],['#5b9bd5','Azul-claro']],
    escuro:[['#5b9bd5','Azul'],['#f5b700','Amarelo'],['#e8a33d','Âmbar'],['#f28c28','Laranja'],['#c98a1b','Dourado'],['#23834b','Verde'],['#0d7f75','Turquesa'],['#7a55b0','Roxo']]},
  pri:{nome:'Botões e links', dica:'botões principais, links e seleção',
    claro:[['#1f4e79','Azul'],['#1c3556','Marinho'],['#1f4e8c','Azul-royal'],['#1e4a3c','Verde'],['#0f766e','Petróleo'],['#8a5e0f','Dourado'],['#5b3f8c','Roxo'],['#7a2638','Bordô'],['#2f3640','Grafite']],
    escuro:[['#5b9bd5','Azul'],['#8fb3e6','Azul-claro'],['#7cc7aa','Verde'],['#2dd4bf','Turquesa'],['#d9a441','Dourado'],['#a78bfa','Lilás'],['#f0a0b0','Rosa'],['#cbd5e1','Prata']]},
};

/* ---------- cálculo de cores ---------- */
const apRgb = h => { h = String(h).replace('#', ''); if(h.length === 3) h = h.replace(/./g, c => c + c); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const apHex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const apMix = (a, b, t) => { const x = apRgb(a), y = apRgb(b); return apHex(x.map((v, i) => v + (y[i] - v) * t)); };
const apLum = h => { const c = apRgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const apContraste = (a, b) => { const x = apLum(a), y = apLum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const apEscuro = h => apLum(h) < .2;
// texto sobre uma cor: branco ou escuro, o que ler melhor
const apTextoSobre = (h, esc = '#12161d') => apContraste('#ffffff', h) >= apContraste(esc, h) ? '#ffffff' : esc;
const apRgba = (h, a) => { const [r, g, b] = apRgb(h); return `rgba(${r},${g},${b},${a})`; };

/* ---------- estado (só neste aparelho) ---------- */
function apEstado(){ let e = {}; try{ e = JSON.parse(localStorage.getItem(AP_KEY) || '{}') || {}; }catch(x){ e = {}; }
  if(!AP_PALETAS[e.paleta]) e.paleta = 'azul'; e.ajustes = e.ajustes && typeof e.ajustes === 'object' ? e.ajustes : {};
  ['claro', 'escuro'].forEach(m => { if(!e.ajustes[m] || typeof e.ajustes[m] !== 'object') e.ajustes[m] = {}; });
  if(e.icones !== 'cinza') e.icones = 'cor'; return e; }
function apGuardar(e){ try{ if(e.paleta === 'azul' && e.icones === 'cor' && !Object.keys(e.ajustes.claro).length && !Object.keys(e.ajustes.escuro).length) localStorage.removeItem(AP_KEY); else localStorage.setItem(AP_KEY, JSON.stringify(e)); }catch(x){} }
// modo em uso agora: escolhido (Claro/Escuro) ou, no Auto, o do aparelho
function apModo(){ const t = document.documentElement.dataset.theme; if(t === 'dark') return 'escuro'; if(t === 'light') return 'claro';
  try{ return matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'; }catch(x){ return 'claro'; } }

// todas as variáveis de cor para uma paleta + ajustes num modo
function apCores(paleta, modo, aj){
  const base = (AP_PALETAS[paleta] || AP_PALETAS.azul)[modo], c = {...base}; aj = aj || {};
  const esc = modo === 'escuro';
  if(aj.bg){ c.bg = aj.bg; c.panel = esc ? apMix(aj.bg, '#ffffff', .07) : (aj.bg === '#ffffff' ? '#ffffff' : apMix(aj.bg, '#ffffff', .7));
    c.line = esc ? apMix(aj.bg, '#ffffff', .15) : apMix(aj.bg === '#ffffff' ? '#f4f5f7' : aj.bg, '#000000', .07); }
  if(aj.side){ c.side = aj.side; c.sideText = apEscuro(aj.side) ? apMix(aj.side, '#ffffff', .78) : apMix(aj.side, '#000000', .78); }
  if(aj.acc){ c.acc = aj.acc; c.accText = apTextoSobre(aj.acc, apEscuro(c.side) ? c.side : '#12161d'); }
  if(aj.pri){ c.pri = aj.pri; c.pri2 = apMix(aj.pri, '#ffffff', esc ? .25 : .18); c.priSoft = esc ? apMix(aj.pri, c.bg, .82) : apMix(aj.pri, '#ffffff', .89); c.priText = apTextoSobre(aj.pri); }
  else if(aj.bg && !esc) c.priSoft = apMix(c.pri, '#ffffff', .89);
  if(!c.priText) c.priText = apTextoSobre(c.pri); if(!c.accText) c.accText = apTextoSobre(c.acc);
  // cores que dependem do menu ser escuro ou claro
  const sideEsc = apEscuro(c.side), on = sideEsc ? '#ffffff' : apMix(c.side, '#000000', .85);
  c.onSide = on; c.sideHover = apRgba(on, .07); c.sideChip = apRgba(on, .14); c.sideLinha = apRgba(on, .25);
  c.sideAlerta = sideEsc ? '#ff8a80' : '#b42318'; c.logoFiltro = sideEsc ? 'invert(1)' : 'none';
  return c;
}
const AP_VARS = ['bg', 'panel', 'text', 'muted', 'line', 'pri', 'pri2', 'priSoft', 'priText', 'side', 'sideText', 'acc', 'accText', 'onSide', 'sideHover', 'sideChip', 'sideLinha', 'sideAlerta', 'logoFiltro', 'warn', 'warnSoft'];
function apAplicar(){
  const e = apEstado(), modo = apModo(), c = apCores(e.paleta, modo, e.ajustes[modo]), st = document.documentElement.style;
  AP_VARS.forEach(k => { if(c[k]) st.setProperty('--' + k, c[k]); else st.removeProperty('--' + k); });
  document.documentElement.dataset.paleta = e.paleta; document.documentElement.dataset.icones = e.icones;
  const meta = document.querySelector('meta[name="theme-color"]'); if(meta) meta.content = c.side;
  return c;
}
apAplicar();
try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { apAplicar(); apAtualizarCard(); }); }catch(x){}

/* ---------- Configurações › Aparência ---------- */
function apCardHtml(){
  const e = apEstado(), modo = apModo(), aj = e.ajustes[modo], cur = apCores(e.paleta, modo, aj), nomeModo = modo === 'escuro' ? 'Escuro' : 'Claro';
  const prev = (k, p) => { const c = apCores(k, modo); return `<button type="button" class="apPal${p ? ' on' : ''}" data-act="apPaleta" data-k="${k}" aria-pressed="${p}" title="${AP_PALETAS[k].nome}">
    <span class="apMini" style="background:${c.bg}"><i style="background:${c.side}"><b style="background:${c.acc}"></b></i><s style="background:${c.panel};border-color:${c.line}"><u style="background:${c.pri}"></u></s></span><span class="apNome">${AP_PALETAS[k].nome}</span></button>`; };
  const linha = k => { const o = AP_OPCOES[k], atual = cur[k];
    return `<div class="apLinha"><div class="apRot"><b>${o.nome}</b><span class="small muted">${o.dica}</span></div><div class="apCores" role="group" aria-label="${o.nome}">${o[modo].map(([h, n]) =>
      `<button type="button" class="apCor${atual === h ? ' on' : ''}" data-act="apCor" data-k="${k}" data-c="${h}" title="${n}" aria-label="${n}" aria-pressed="${atual === h}" style="background:${h}"></button>`).join('')}</div></div>`; };
  const nAj = Object.keys(aj).length;
  return `<div id="apBox">
    <div class="apSec"><b>Paleta de cores</b></div>
    <div class="apPals">${Object.keys(AP_PALETAS).map(k => prev(k, e.paleta === k)).join('')}</div>
    <div class="apSec"><b>Ícones do menu</b></div>
    <div class="temaSeg apIc" role="group" aria-label="Ícones do menu"><button data-act="apIcones" data-v="cor" class="${e.icones === 'cor' ? 'on' : ''}">Coloridos</button><button data-act="apIcones" data-v="cinza" class="${e.icones === 'cinza' ? 'on' : ''}">Discretos (cinza)</button></div>
    <details class="apAjustes"${nAj ? ' open' : ''}><summary><b>🖌️ Ajustar cores</b> <span class="small muted">— modo ${nomeModo} em uso${nAj ? ` · ${nAj} ajuste(s)` : ''}</span></summary>
      <p class="small muted" style="margin:6px 0 10px">Escolha por cima da paleta. Os ajustes valem para o modo <b>${nomeModo}</b>; para ajustar o outro modo, troque Claro/Escuro acima. As cores de alerta (vermelho, âmbar, verde) não mudam, para os prazos continuarem chamando atenção.</p>
      ${['bg', 'side', 'acc', 'pri'].map(linha).join('')}
      ${nAj ? `<div class="toolbar" style="margin:10px 0 0"><button class="btn" data-act="apRestaurar">↺ Voltar às cores da paleta (modo ${nomeModo})</button></div>` : ''}
    </details></div>`;
}
function apAtualizarCard(){ const b = document.getElementById('apBox'); if(b) b.outerHTML = apCardHtml(); }
function apMudar(fn, msg){ const e = apEstado(); fn(e); apGuardar(e); apAplicar(); apAtualizarCard(); if(msg && typeof toast === 'function') toast(msg); }
// ações (A é criado em acoes.js, carregado depois deste arquivo)
document.addEventListener('DOMContentLoaded', () => { if(typeof A === 'undefined') return;
  A.apPaleta = d => { if(!AP_PALETAS[d.k]) return; const e = apEstado(), tem = Object.keys(e.ajustes.claro).length + Object.keys(e.ajustes.escuro).length;
    if(e.paleta === d.k) return; if(tem && !confirm('Trocar de paleta apaga os seus ajustes de cor. Continuar?')) return;
    apMudar(e => { e.paleta = d.k; e.ajustes = {claro:{}, escuro:{}}; }, '🎨 Paleta: ' + AP_PALETAS[d.k].nome); };
  A.apCor = d => { if(!AP_OPCOES[d.k]) return; const modo = apModo();
    apMudar(e => { const base = AP_PALETAS[e.paleta][modo][d.k]; if(base === d.c) delete e.ajustes[modo][d.k]; else e.ajustes[modo][d.k] = d.c; }); };
  A.apIcones = d => apMudar(e => { e.icones = d.v === 'cinza' ? 'cinza' : 'cor'; });
  A.apRestaurar = () => { const modo = apModo(); apMudar(e => { e.ajustes[modo] = {}; }, 'Cores da paleta restauradas'); };
});
