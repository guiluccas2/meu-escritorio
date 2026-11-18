/* ===== 🏛️ Processos antigos (antes do DJEN): colar a lista copiada do site do tribunal =====
   Sem IA e sem custo: o sistema só procura os números CNJ no texto colado e manda os novos para a lista “A revisar”.
   Depois de cadastrado, o robô (DataJud) traz o histórico completo do processo na primeira consulta. */
const UF_TJ = {'01':'AC','02':'AL','03':'AP','04':'AM','05':'BA','06':'CE','07':'DF','08':'ES','09':'GO','10':'MA','11':'MT','12':'MS','13':'MG','14':'PA','15':'PB','16':'PR','17':'PE','18':'PI','19':'RJ','20':'RN','21':'RS','22':'RO','23':'RR','24':'SC','25':'SE','26':'SP','27':'TO'};
function siglaTribunal(d){ const j = d[13], tr = d.slice(14, 16);
  return j === '8' ? 'TJ' + (UF_TJ[tr] || tr) : j === '5' ? (tr === '00' ? 'TST' : 'TRT' + +tr) : j === '4' ? 'TRF' + +tr : j === '3' ? 'STJ' : j === '1' ? 'STF' : j === '6' ? 'TRE' : j === '7' ? 'Justiça Militar' : j === '9' ? 'TJM' : ''; }
const SITES_ANTIGOS = [
  {t:'TJSP — e-SAJ 1º grau', url:'https://esaj.tjsp.jus.br/cpopg/open.do', como:'Em “Pesquisar por”, escolha <b>Nº da OAB</b>, digite o número e pesquise. Depois selecione toda a página (Ctrl+A), copie (Ctrl+C) e cole abaixo. Repita em cada página de resultados.'},
  {t:'TJSP — e-SAJ 2º grau', url:'https://esaj.tjsp.jus.br/cposg/open.do', como:'Mesma coisa: “Pesquisar por” → <b>Nº da OAB</b>; copie a página e cole abaixo.'},
  {t:'TRT-15 — PJe (área logada)', url:'https://pje.trt15.jus.br/primeirograu/login.seam', como:'Entre com o certificado, abra o <b>Painel / Acervo</b> com a lista dos seus processos, selecione a página (Ctrl+A), copie e cole abaixo. Faça o mesmo no 2º grau, se houver.'},
  {t:'TRF-3 — PJe (área logada)', url:'https://pje1g.trf3.jus.br/pje/login.seam', como:'Entre com o certificado, abra o <b>Painel do usuário → Acervo</b>, copie a página e cole abaixo.'},
];
let impColado = null; // resultado da última análise do texto colado
function impExtrair(txt){
  const linhas = String(txt || '').split(/\r?\n/), achados = new Map();
  const re = /\b(\d{7})[-.\s]?(\d{2})[.\s]?(\d{4})[.\s]?(\d)[.\s]?(\d{2})[.\s]?(\d{4})\b/g;
  linhas.forEach((l, i) => { let m; re.lastIndex = 0;
    while((m = re.exec(l))){ const d = m.slice(1).join(''); if(d.length !== 20 || achados.has(d)) continue;
      const trecho = [l, linhas[i + 1] || '', linhas[i + 2] || ''].map(x => x.trim()).filter(Boolean).join(' · ').replace(/\s+/g, ' ').slice(0, 220);
      achados.set(d, trecho); } });
  const ja = new Set(db.processos.map(p => digits(p.numero))), fila = new Set(db.importar.map(i => digits(i.numero)));
  const todos = [...achados].map(([d, trecho]) => ({d, numero:mascaraCnj(d), trecho, tribunal:siglaTribunal(d), st:ja.has(d) ? 'cadastrado' : fila.has(d) ? 'na lista' : 'novo'}));
  return {todos, novos:todos.filter(x => x.st === 'novo')};
}
function impAntigosCard(){
  const r = impColado;
  return `<div class="card"><h2>🏛️ Processos antigos (antes do DJEN) — pelo site do tribunal</h2>
    <p class="small" style="margin-top:0">Sem IA e sem custo: abra a lista dos seus processos no site do tribunal, <b>copie a página inteira e cole aqui</b>. O sistema encontra os números e manda os que ainda não estão cadastrados para a lista “A revisar”, abaixo. Depois de cadastrado, o robô (DataJud) traz o histórico completo de cada processo.</p>
    <details class="impSites"><summary>Onde encontrar a lista dos seus processos</summary>${SITES_ANTIGOS.map(s => `<div class="li"><div class="grow"><b>${s.t}</b><div class="sub">${s.como}</div></div><a class="mini" href="${s.url}" target="_blank" rel="noopener">abrir ↗</a></div>`).join('')}</details>
    <textarea id="impTexto" rows="4" placeholder="Cole aqui o texto copiado da página do tribunal (pode colar várias páginas, uma depois da outra)…"></textarea>
    <div class="toolbar" style="margin:8px 0 0"><button class="btn" data-act="impAnalisar">🔎 Encontrar processos no texto</button>
      ${r ? `<span class="small">${r.todos.length} número(s) encontrado(s): <b>${r.novos.length} novo(s)</b>${r.todos.length - r.novos.length ? ` · ${r.todos.length - r.novos.length} já cadastrado(s) ou na lista` : ''}</span>${r.novos.length ? `<span class="sp"></span><button class="btn primary" data-act="impAddColados">📥 Mandar ${r.novos.length} para “A revisar”</button>` : ''}` : ''}</div>
    ${r && r.todos.length ? `<div class="impPrev">${r.todos.slice(0, 60).map(x => `<div class="li"><div class="grow"><b>${esc(x.numero)}</b> <span class="tag grey">${esc(x.tribunal)}</span> ${x.st === 'novo' ? '<span class="tag ok">novo</span>' : `<span class="tag">${x.st}</span>`}<div class="sub">${esc(x.trecho)}</div></div></div>`).join('')}${r.todos.length > 60 ? `<div class="small muted">… e mais ${r.todos.length - 60}.</div>` : ''}</div>` : ''}</div>`;
}
Object.assign(A, {
  impAnalisar: () => { const t = document.getElementById('impTexto')?.value || ''; if(!t.trim()) return toast('Cole primeiro o texto copiado do site do tribunal');
    impColado = impExtrair(t); render(); if(!impColado.todos.length) toast('Nenhum número de processo (CNJ) encontrado no texto'); },
  impAddColados: () => { if(!impColado?.novos.length) return; const t = today();
    const novos = impColado.novos.filter(x => !db.importar.some(i => digits(i.numero) === x.d)).map(x => ({id:'imp:' + x.d, numero:x.numero, tribunal:x.tribunal, orgao:'', classe:'', partes:[], advogados:[], comunicacoes:0, primeira:'', ultima:t, status:'pendente', criadoEm:t, fonte:'colado', trecho:x.trecho}));
    db.importar.push(...novos); save(); impColado = null; tabs.imp = 'pendente'; render(); toast(`📥 ${novos.length} processo(s) na lista “A revisar”`); },
});
