/* ===== 📚 Biblioteca =====
   Abas (nesta ordem): 📄 Documentos (em breve) · 🗂️ Arquivos (em breve) · ⚖️ Jurisprudência.
   Jurisprudência: SEM IA e sem custo — monta a pesquisa (vários termos: E / OU / NÃO / termos próximos, frase exata) e abre o buscador
   oficial de cada tribunal. Cada botão copia a pesquisa (na sintaxe do tribunal) e abre o endereço do tribunal; onde o endereço aceita
   a pesquisa ({q}), já abre preenchido; onde não aceita (ou pede verificação “não sou robô”), é só colar (Ctrl+V).
   Tribunais: db.meta.jurTribunais (editável em “⚙️ Tribunais”: incluir outros, corrigir o endereço). Pesquisas salvas: db.meta.jurSalvas. */
const JUR_PADRAO = [
  {id:'stf', nome:'STF', url:'https://jurisprudencia.stf.jus.br/pages/search?base=acordaos&sinonimo=true&plural=true&page=1&pageSize=10&sort=_score&sortBy=desc&pesquisa_inteiro_teor={inteiro}&queryString={q}', sint:'pt', ativo:true},
  {id:'stj', nome:'STJ', url:'https://scon.stj.jus.br/SCON/pesquisar.jsp?b=ACOR&livre={q}', sint:'pt', ativo:true},
  {id:'tst', nome:'TST', url:'https://jurisprudencia.tst.jus.br/', sint:'pt', ativo:true},
  {id:'tjsp', nome:'TJSP', url:'https://esaj.tjsp.jus.br/cjsg/consultaCompleta.do', sint:'pt', ativo:true},
  {id:'trt15', nome:'TRT15', url:'https://trt15.jus.br/jurisprudencia', sint:'pt', ativo:true},
  {id:'trf3', nome:'TRF3', url:'https://web.trf3.jus.br/base-textual', sint:'pt', ativo:true},
];
const jurTribunais = () => (db.meta.jurTribunais && db.meta.jurTribunais.length ? db.meta.jurTribunais : JUR_PADRAO);
const JUR_OPS = [{v:'E', t:'E (tem que ter)'}, {v:'OU', t:'OU (um ou outro)'}, {v:'NAO', t:'NÃO (excluir)'}, {v:'PROX', t:'PRÓXIMOS (perto um do outro)'}];
const JUR = {linhas:[{op:'E', txt:'', txt2:'', n:5, exata:true}], inteiro:true, de:'', ate:'', trib:null, aba:'juris'};
const jurSel = () => JUR.trib || jurTribunais().filter(t => t.ativo !== false).map(t => t.id);

// monta a pesquisa na sintaxe do tribunal ('pt' = E / OU / NÃO · 'en' = AND / OR / NOT)
function jurMontar(st = JUR, sint = 'pt'){
  const O = sint === 'en' ? {E:'AND', OU:'OR', NAO:'NOT', P:'NEAR'} : {E:'E', OU:'OU', NAO:'NÃO', P:'PROX'};
  const termo = (t, ex) => { t = String(t || '').trim().replace(/["“”]/g, '').replace(/\s+/g, ' '); return !t ? '' : ex && /\s/.test(t) ? `"${t}"` : t; };
  const alts = l => String(l.txt || '').split(/[;\n]/).map(x => termo(x, l.exata)).filter(Boolean);
  const e = [], ou = [], nao = [];
  st.linhas.forEach(l => {
    if(l.op === 'PROX'){ const a = termo(l.txt, l.exata), b = termo(l.txt2, l.exata); if(a && b) e.push(`${a} ${O.P}${Math.max(1, Math.min(50, +l.n || 5))} ${b}`); return; }
    const a = alts(l); if(!a.length) return;
    if(l.op === 'OU') ou.push(...a); else if(l.op === 'NAO') nao.push(...a); else e.push(a.length > 1 ? '(' + a.join(` ${O.OU} `) + ')' : a[0]);
  });
  if(ou.length) e.push(ou.length > 1 ? '(' + ou.join(` ${O.OU} `) + ')' : ou[0]);
  return [e.join(` ${O.E} `), ...nao.map(x => `${O.NAO} ${x}`)].filter(Boolean).join(' ').trim();
}
const jurUrl = (t, q) => String(t.url || '').replace(/\{q\}/g, encodeURIComponent(q)).replace(/\{inteiro\}/g, JUR.inteiro ? 'true' : 'false')
  .replace(/\{de\}/g, JUR.de ? fmtD(JUR.de) : '').replace(/\{ate\}/g, JUR.ate ? fmtD(JUR.ate) : '');
async function jurCopiar(txt){ try{ await navigator.clipboard.writeText(txt); return true; }catch(e){ return false; } }

function bibAbas(on){ const T = (k, t) => `<button class="${on === k ? 'on' : ''}" data-act="bibAba" data-k="${k}">${t}</button>`;
  return `<div class="tabs">${T('docs', '📄 Documentos')}${T('arqs', '🗂️ Arquivos')}${T('juris', '⚖️ Jurisprudência')}</div>`; }
VIEWS.biblioteca = sub => {
  const aba = ['docs', 'arqs', 'juris'].includes(sub) ? sub : JUR.aba; JUR.aba = aba;
  const cab = `<h1>📚 Biblioteca<span class="sp"></span>${aba === 'juris' ? '<button class="btn" data-act="jurTribs">⚙️ Tribunais</button>' : ''}</h1>${bibAbas(aba)}`;
  if(aba === 'docs') return cab + `<div class="card breve"><b>📄 Documentos personalizados e modelos — em breve</b><p class="small muted" style="margin:6px 0 0">Modelos com campos automáticos (procuração, contrato de honorários, declaração de hipossuficiência, substabelecimento, recibo, proposta para lead), preenchidos com os dados do cliente, do processo, do serviço ou do lead; importar seus modelos do Word; gerar em PDF / Word / Google Docs e salvar na pasta do cliente (ou em Leads) no Google Drive. Sem IA.</p></div>`;
  if(aba === 'arqs') return cab + `<div class="card breve"><b>🗂️ Arquivos — em breve</b><p class="small muted" style="margin:6px 0 0">Navegar e buscar nas pastas do Google Drive do escritório (Clientes, Leads, Atendimentos, Documentos) sem sair do sistema, lendo pelo robô.</p></div>`;
  const tribs = jurTribunais(), sel = jurSel(), q = jurMontar(JUR);
  const linha = (l, i) => `<div class="jurLin" data-i="${i}"><select data-jur="op" data-i="${i}" style="width:auto">${opts(JUR_OPS, l.op)}</select>
    ${l.op === 'PROX' ? `<input data-jur="txt" data-i="${i}" value="${esc(l.txt)}" placeholder="primeiro termo"><span class="small muted">até</span><input data-jur="n" data-i="${i}" type="number" min="1" max="50" value="${esc(l.n || 5)}" style="width:62px"><span class="small muted">palavras de</span><input data-jur="txt2" data-i="${i}" value="${esc(l.txt2 || '')}" placeholder="segundo termo">`
      : `<input data-jur="txt" data-i="${i}" value="${esc(l.txt)}" placeholder="${l.op === 'OU' ? 'ex.: negativa de cobertura; recusa de tratamento' : l.op === 'NAO' ? 'ex.: odontológico' : 'ex.: dano moral'}">`}
    <label class="small jurEx"><input type="checkbox" data-jur="exata" data-i="${i}" ${l.exata ? 'checked' : ''}> frase exata</label>
    ${JUR.linhas.length > 1 ? `<button class="mini" data-act="jurDel" data-i="${i}" title="Tirar este termo">✕</button>` : ''}</div>`;
  const salvas = db.meta.jurSalvas || [];
  return cab + `<div class="small muted" style="margin:-4px 0 10px">Sem IA e sem custo: o sistema monta a pesquisa e abre o buscador oficial de cada tribunal. Os resultados aparecem no site do tribunal.</div>
  <div class="card"><b>Montar a pesquisa</b><div class="small muted">Vários termos na mesma linha: separe com “;” (vira um OU). Em OU, basta aparecer um deles.</div>
    <div id="jurLinhas">${JUR.linhas.map(linha).join('')}</div>
    <div class="row" style="gap:6px;margin-top:6px"><button class="mini" data-act="jurAdd" data-op="E">+ termo (E)</button><button class="mini" data-act="jurAdd" data-op="OU">+ alternativa (OU)</button><button class="mini" data-act="jurAdd" data-op="NAO">+ excluir (NÃO)</button><button class="mini" data-act="jurAdd" data-op="PROX">+ termos próximos</button><button class="mini" data-act="jurLimpar">limpar</button></div>
    <div class="jurG">
      <label class="small">Onde procurar<select data-jur="inteiro"><option value="1" ${JUR.inteiro ? 'selected' : ''}>Ementa e inteiro teor</option><option value="0" ${JUR.inteiro ? '' : 'selected'}>Só ementa</option></select></label>
      <label class="small">Julgados de<input type="date" data-jur="de" value="${esc(JUR.de)}"></label><label class="small">até<input type="date" data-jur="ate" value="${esc(JUR.ate)}"></label>
    </div>
    <div class="small muted" style="margin-top:8px">Tribunais</div>
    <div class="row" style="gap:6px;flex-wrap:wrap">${tribs.map(t => `<button class="jurChip ${sel.includes(t.id) ? 'on' : ''}" data-act="jurTrib" data-id="${esc(t.id)}">${esc(t.nome)}</button>`).join('')}<button class="mini" data-act="jurTribs">+ incluir tribunal</button></div>
    <div class="jurQ"><span class="small muted">Pesquisa montada:</span> <code id="jurQ">${esc(q) || '—'}</code></div>
    <div class="row" style="gap:6px;margin-top:8px"><button class="btn primary" data-act="jurCopiarQ">📋 Copiar pesquisa</button><button class="btn" data-act="jurSalvar">⭐ Salvar esta pesquisa</button></div>
  </div>
  <div class="card"><b>Abrir em cada tribunal</b><div class="small muted">Cada botão copia a pesquisa e abre o buscador do tribunal${JUR.de || JUR.ate ? ` — filtre lá as datas (${JUR.de ? fmtD(JUR.de) : '…'} a ${JUR.ate ? fmtD(JUR.ate) : '…'})` : ''}. Se a página não vier preenchida, clique no campo de busca e cole (Ctrl+V).</div>
    ${tribs.filter(t => sel.includes(t.id)).map(t => `<div class="jurRes"><div><b>${esc(t.nome)}</b><small>${/\{q\}/.test(t.url) ? 'tenta abrir já com a pesquisa' : 'abre a busca do tribunal — é só colar a pesquisa'}${!JUR.inteiro && !/\{inteiro\}/.test(t.url) ? ' · escolha “ementa” no site' : ''}</small></div><button class="btn" data-act="jurAbrir" data-id="${esc(t.id)}" ${q ? '' : 'disabled'}>Abrir ↗</button></div>`).join('') || '<div class="empty">Escolha ao menos um tribunal.</div>'}
  </div>
  ${salvas.length ? `<div class="card"><b>⭐ Pesquisas salvas</b>${salvas.map(s => `<div class="jurRes"><div><b>${esc(s.nome)}</b><small>${esc(jurMontar(s))}</small></div><div class="row" style="gap:6px"><button class="mini" data-act="jurUsar" data-id="${esc(s.id)}">usar</button><button class="mini" data-act="jurApagar" data-id="${esc(s.id)}" title="Apagar">✕</button></div></div>`).join('')}</div>` : ''}`;
};
// edição dos campos sem redesenhar a tela inteira (não perde o cursor)
function jurAtualizarQ(){ const el = document.getElementById('jurQ'); if(el) el.textContent = jurMontar(JUR) || '—'; document.querySelectorAll('[data-act="jurAbrir"]').forEach(b => b.disabled = !jurMontar(JUR)); }
document.addEventListener('input', e => { const k = e.target.dataset?.jur; if(!k) return; const i = +e.target.dataset.i;
  if(['txt', 'txt2', 'n'].includes(k)) JUR.linhas[i][k] = e.target.value; jurAtualizarQ(); });
document.addEventListener('change', e => { const k = e.target.dataset?.jur; if(!k) return; const i = +e.target.dataset.i;
  if(k === 'op'){ JUR.linhas[i].op = e.target.value; render(); return; }
  if(k === 'exata') JUR.linhas[i].exata = e.target.checked;
  if(k === 'inteiro'){ JUR.inteiro = e.target.value === '1'; render(); return; }
  if(k === 'de' || k === 'ate'){ JUR[k] = e.target.value; render(); return; }
  jurAtualizarQ(); });
Object.assign(A, {
  bibAba: d => { JUR.aba = d.k; go('#/biblioteca/' + d.k); },
  jurAdd: d => { JUR.linhas.push({op:d.op, txt:'', txt2:'', n:5, exata:true}); render(); setTimeout(() => { const l = document.querySelectorAll('[data-jur="txt"]'); l[l.length - 1]?.focus(); }, 0); },
  jurDel: d => { JUR.linhas.splice(+d.i, 1); render(); },
  jurLimpar: () => { JUR.linhas = [{op:'E', txt:'', txt2:'', n:5, exata:true}]; JUR.de = JUR.ate = ''; JUR.inteiro = true; render(); },
  jurTrib: d => { const s = jurSel(); JUR.trib = s.includes(d.id) ? s.filter(x => x !== d.id) : [...s, d.id]; render(); },
  jurCopiarQ: async () => { const q = jurMontar(JUR); if(!q) return toast('Escreva ao menos um termo'); toast(await jurCopiar(q) ? '📋 Pesquisa copiada' : 'Copie a pesquisa montada (selecione e Ctrl+C)'); },
  jurAbrir: async d => { const t = jurTribunais().find(x => x.id === d.id), q = jurMontar(JUR, t?.sint); if(!t || !q) return;
    const w = window.open(jurUrl(t, q), '_blank', 'noopener'); const ok = await jurCopiar(q);
    toast(`${t.nome}: ${ok ? 'pesquisa copiada — ' : ''}${/\{q\}/.test(t.url) ? 'se não vier preenchida, cole no campo de busca' : 'cole no campo de busca (Ctrl+V)'}${w === null ? '' : ''}`); },
  jurSalvar: () => { if(!jurMontar(JUR)) return toast('Escreva ao menos um termo');
    openForm({title:'⭐ Salvar pesquisa', data:{nome:''}, fields:[{k:'nome', label:'Nome da pesquisa', req:true, full:true, ph:'Ex.: Plano de saúde – negativa de cobertura'}, {type:'html', html:`<div class="small muted">${esc(jurMontar(JUR))}</div>`}],
      onSave:o => { db.meta.jurSalvas = [...(db.meta.jurSalvas || []), {id:uid(), nome:o.nome, linhas:JSON.parse(JSON.stringify(JUR.linhas)), inteiro:JUR.inteiro, de:JUR.de, ate:JUR.ate, trib:jurSel()}]; save(); toast('⭐ Pesquisa salva'); render(); }}); },
  jurUsar: d => { const s = (db.meta.jurSalvas || []).find(x => x.id === d.id); if(!s) return; Object.assign(JUR, JSON.parse(JSON.stringify({linhas:s.linhas, inteiro:s.inteiro !== false, de:s.de || '', ate:s.ate || '', trib:s.trib || null}))); render(); },
  jurApagar: d => { if(!confirm('Apagar esta pesquisa salva?')) return; db.meta.jurSalvas = (db.meta.jurSalvas || []).filter(x => x.id !== d.id); save(); render(); },
  jurTribs: () => formJurTribunais(),
});
// ⚙️ Tribunais: incluir outros, corrigir o endereço ({q} = onde entra a pesquisa), sintaxe, ligado/desligado
function formJurTribunais(){
  const lin = (t, i) => `<div class="jurTr" data-i="${i}"><input class="jtNome" value="${esc(t.nome)}" placeholder="Tribunal" style="width:90px"><input class="jtUrl" value="${esc(t.url)}" placeholder="https://… (use {q} onde entra a pesquisa)" style="flex:1;min-width:160px">
    <select class="jtSint" style="width:auto"><option value="pt" ${t.sint !== 'en' ? 'selected' : ''}>E / OU / NÃO</option><option value="en" ${t.sint === 'en' ? 'selected' : ''}>AND / OR / NOT</option></select>
    <label class="small"><input type="checkbox" class="jtAtivo" ${t.ativo !== false ? 'checked' : ''}> marcado</label><button type="button" class="mini jtDel" title="Tirar">✕</button><input type="hidden" class="jtId" value="${esc(t.id)}"></div>`;
  openForm({title:'⚙️ Tribunais da pesquisa de jurisprudência', data:{}, fields:[{type:'html', html:`<div class="small muted" style="margin-bottom:6px">“marcado” = já vem selecionado na pesquisa. No endereço, <b>{q}</b> é onde entra a pesquisa (se o buscador do tribunal aceitar); sem {q}, o botão abre a busca e a pesquisa fica copiada para colar. Também: {inteiro} (true/false), {de} e {ate} (datas).</div>
    <div id="jtLista">${jurTribunais().map(lin).join('')}</div><div class="row" style="gap:6px;margin-top:6px"><button type="button" class="mini" id="jtAdd">+ incluir tribunal</button><button type="button" class="mini" id="jtPadrao">voltar à lista padrão</button></div>`}],
    after:f => { const L = f.querySelector('#jtLista');
      L.addEventListener('click', e => { if(e.target.classList.contains('jtDel')) e.target.closest('.jurTr').remove(); });
      f.querySelector('#jtAdd').onclick = () => { L.insertAdjacentHTML('beforeend', lin({id:'t' + Date.now().toString(36), nome:'', url:'', sint:'pt', ativo:true}, L.children.length)); L.lastElementChild.querySelector('.jtNome').focus(); };
      f.querySelector('#jtPadrao').onclick = () => { L.innerHTML = JUR_PADRAO.map(lin).join(''); }; },
    onSave:() => { const l = [...mForm.querySelectorAll('.jurTr')].map(r => ({id:r.querySelector('.jtId').value, nome:r.querySelector('.jtNome').value.trim(), url:r.querySelector('.jtUrl').value.trim(), sint:r.querySelector('.jtSint').value, ativo:r.querySelector('.jtAtivo').checked})).filter(t => t.nome && /^https?:\/\//i.test(t.url));
      if(!l.length){ toast('Inclua ao menos um tribunal com endereço (https://…)'); return false; }
      db.meta.jurTribunais = l; JUR.trib = null; save(); toast('Tribunais salvos'); render(); }});
}
