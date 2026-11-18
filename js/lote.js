/* ===== Seleção em massa, alteração rápida e relatórios (PDF / Excel) — Processos e Clientes =====
   Nas listas: <input data-xsel="processos:ID"> em cada linha e <input data-xselall="processos"> no cabeçalho.
   A barra de baixo (#bulk) mostra as ações do tipo selecionado. */
const fmtTempo = d => { if(!d) return ''; const dias = Math.round((parseD(today()) - parseD(d)) / 864e5); if(dias < 1) return 'hoje';
  if(dias < 31) return `há ${dias} dia${dias > 1 ? 's' : ''}`; if(dias < 365) { const m = Math.floor(dias / 30.4); return `há ${m} ${m > 1 ? 'meses' : 'mês'}`; } const a = Math.floor(dias / 365); return `há ${a} ano${a > 1 ? 's' : ''}`; };
const ultAndamento = p => db.andamentos.filter(a => a.processoId === p.id && a.data).reduce((m, a) => a.data > m ? a.data : m, '');
// cores do status (como no SEDEP): ativo verde · suspenso azul · arquivado/encerrado vermelho · baixado laranja · outros cinza
const STATUS_COR = s => /^ativo/i.test(s || '') ? 'st-ativo' : /suspens|sobrest/i.test(s || '') ? 'st-susp' : /arquiv|encerr/i.test(s || '') ? 'st-arq' : /baixad/i.test(s || '') ? 'st-baixa' : 'st-out';
const LEGENDA_STATUS = `<div class="stLeg"><span><i class="st-ativo"></i>Ativo</span><span><i class="st-susp"></i>Suspenso / sobrestado</span><span><i class="st-arq"></i>Arquivado / encerrado</span><span><i class="st-baixa"></i>Baixado</span><span><i class="st-out"></i>Outros</span></div>`;

const LOTE = {
  processos:{um:'processo', varios:'processos', rota:'#/processo/', nome:p => procLabel(p),
    campos:() => [
      {k:'status', t:'Status', op:() => OPT.statusProc},
      {k:'fase', t:'Fase do processo', op:() => OPT.faseProc, vazio:true},
      {k:'situacaoProc', t:'Situação', op:() => OPT.situacaoProc, vazio:true},
      {k:'area', t:'Área de atuação', op:() => OPT.area, vazio:true},
      {k:'titulo', t:'Ação / assunto', combo:() => sugestoes('acao', 'titulo')},
      {k:'tipoProc', t:'Tipo (judicial / administrativo / extrajudicial)', op:() => ['Judicial', 'Administrativo', 'Extrajudicial']},
      {k:'rito', t:'Rito', op:() => OPT.rito, vazio:true},
      {k:'tribunal', t:'Tribunal / órgão', combo:() => sugestoes('tribunal', 'tribunal')},
      {k:'comarca', t:'Comarca', combo:() => sugestoes('comarca', 'comarca')},
      {k:'vara', t:'Vara / órgão julgador', combo:() => sugestoes('vara', 'vara')},
      {k:'sistema', t:'Sistema em que tramita', op:() => OPT.sistema, vazio:true},
      {k:'clienteId', t:'Cliente responsável', op:() => pessoasOpts()},
      ...camposDe('processo').map(c => ({k:'extra.' + c.id, t:c.titulo + ' (personalizado)', cp:c}))],
    tags:true,
    colunas:[['Pasta', p => procCode(p)], ['Ação / assunto', p => p.titulo], ['Número', p => p.numero], ['Cliente', p => pessoaNome(p.clienteId)], ['Parte contrária', p => nomesContrarios(p).join(', ')],
      ['Área', p => p.area], ['Tribunal / vara', p => [p.tribunal, p.vara, p.comarca].filter(Boolean).join(' · ')], ['Status', p => p.status], ['Fase', p => p.fase], ['Situação', p => p.situacaoProc],
      ['Último andamento', p => { const u = ultAndamento(p); return u ? fmtD(u) + ' (' + fmtTempo(u) + ')' : ''; }], ['Tags', p => tagsDe(p).map(t => t.nome).join(', ')]]},
  pessoas:{um:'pessoa', varios:'pessoas', rota:'#/pessoa/', nome:p => p.nome,
    campos:() => [{k:'tipo', t:'Tipo de pessoa', op:() => OPT.tipoPessoa}, ...camposDe('pessoa').map(c => ({k:'extra.' + c.id, t:c.titulo + ' (personalizado)', cp:c}))],
    colunas:[['Pasta', p => p.pasta], ['Nome', p => p.nome], ['Tipo', p => p.tipo], ['CPF / CNPJ', p => p.doc], ['Telefone', p => [p.telefone, p.telefone2].filter(Boolean).join(' / ')], ['E-mail', p => p.email],
      ['Processos', p => db.processos.filter(x => envolve(x, p.id)).length || ''], ['Cliente desde', p => fmtD(p.dataContratacao)]]},
};
const XSEL = {processos:new Set(), pessoas:new Set()};
const xMarc = (col, id) => XSEL[col]?.has(id) ? 'checked' : '';
const xSel = () => { const g = {}; document.querySelectorAll('#view [data-xsel]:checked').forEach(c => { const [col, id] = c.dataset.xsel.split(':'); (g[col] = g[col] || []).push(id); });
  const col = Object.keys(g)[0]; return col ? {col, ls:g[col].map(id => byId(col, id)).filter(Boolean)} : null; };
// barra de ações (chamada pelo updateBulk); true = assumiu a barra
function loteBarra(){
  document.querySelectorAll('#view [data-xsel]').forEach(c => { const [col, id] = c.dataset.xsel.split(':'); if(XSEL[col]) c.checked ? XSEL[col].add(id) : XSEL[col].delete(id); });
  const box = document.getElementById('bulk'), s = xSel();
  document.querySelectorAll('#view [data-xselall]').forEach(h => { const all = document.querySelectorAll(`#view [data-xsel^="${h.dataset.xselall}:"]`), on = document.querySelectorAll(`#view [data-xsel^="${h.dataset.xselall}:"]:checked`);
    h.checked = all.length > 0 && on.length === all.length; h.indeterminate = on.length > 0 && on.length < all.length; });
  if(!s) return false;
  const L = LOTE[s.col], n = s.ls.length;
  document.body.classList.add('hasbulk'); box.hidden = false;
  box.innerHTML = `<b>${n} ${n > 1 ? L.varios : L.um} selecionado(s)</b><button class="btn primary" data-act="xAlterar">✏️ Alterar ▾</button>${L.tags ? '<button class="btn" data-act="xTags">🏷️ Tags</button>' : ''}
    <button class="btn" data-act="xRel" data-f="pdf">📄 PDF</button><button class="btn" data-act="xRel" data-f="xls">📊 Excel</button><button class="btn" data-act="bulkClear">Limpar seleção</button>`;
  return true;
}
// menu “Alterar ▾” (lista dos campos) — abre por cima da barra
function loteMenu(){
  const s = xSel(); if(!s) return; let m = document.getElementById('xMenu'); if(m){ m.remove(); return; }
  m = document.createElement('div'); m.id = 'xMenu'; m.className = 'tpop xMenu';
  m.innerHTML = `<h3>Alterar em ${s.ls.length} ${s.ls.length > 1 ? LOTE[s.col].varios : LOTE[s.col].um}</h3>` + LOTE[s.col].campos().map((c, i) => `<button data-xc="${i}">${esc(c.t)}</button>`).join('');
  document.body.appendChild(m);
  m.querySelectorAll('[data-xc]').forEach(b => b.onclick = () => { m.remove(); loteAlterar(s, LOTE[s.col].campos()[+b.dataset.xc]); });
  setTimeout(() => document.addEventListener('click', function fecha(e){ if(!m.contains(e.target)){ m.remove(); document.removeEventListener('click', fecha); } }), 0);
}
function loteAlterar(s, c){
  const L = LOTE[s.col], n = s.ls.length, get = r => c.k.startsWith('extra.') ? r.extra?.[c.k.slice(6)] : r[c.k];
  const iguais = [...new Set(s.ls.map(get))], atual = iguais.length === 1 ? iguais[0] ?? '' : '';
  const fd = c.cp ? (c.cp.tipo === 'lista' ? {k:'v', label:c.t, type:'select', options:c.cp.opcoes} : c.cp.tipo === 'sim' ? {k:'v', label:c.cp.titulo, type:'check'} : {k:'v', label:c.t, type:{numero:'number', valor:'number', data:'date', textarea:'textarea'}[c.cp.tipo] || 'text'})
    : c.combo ? {k:'v', label:c.t, type:'combo', options:c.combo} : {k:'v', label:c.t, type:'select', options:c.op, empty:!!c.vazio, emptyLabel:'— deixar em branco —'};
  openForm({title:`✏️ ${c.t} — ${n} ${n > 1 ? L.varios : L.um}`, data:{v:atual}, fields:[fd,
    {type:'html', html:`<div class="small muted">${iguais.length > 1 ? `Hoje há ${iguais.length} valores diferentes entre os selecionados. ` : ''}O novo valor vale para todos os ${n} selecionado(s): ${esc(s.ls.slice(0, 4).map(L.nome).join('; '))}${n > 4 ? '…' : ''}</div>`}],
    onSave:o => { const ant = s.ls.map(r => ({id:r.id, v:get(r), seq:r.seq}));
      s.ls.forEach(r => { if(c.k.startsWith('extra.')) r.extra = {...(r.extra || {}), [c.k.slice(6)]:o.v}; else r[c.k] = o.v;
        if(c.k === 'clienteId' && s.col === 'processos') r.seq = nextSeq(o.v, r.id); });
      save(); render(); setTimeout(updateBulk, 0);
      toastDesfazer(`${c.t} alterado em ${n} ${n > 1 ? L.varios : L.um}`, () => { ant.forEach(a => { const r = byId(s.col, a.id); if(!r) return; if(c.k.startsWith('extra.')) r.extra = {...(r.extra || {}), [c.k.slice(6)]:a.v}; else r[c.k] = a.v; if(c.k === 'clienteId') r.seq = a.seq; }); save(); render(); }); }});
}
function loteTags(){
  const s = xSel(); if(!s) return; const n = s.ls.length;
  const est = t => { const c = s.ls.filter(p => (p.tags || []).includes(t.id)).length; return c === 0 ? '' : c === n ? 'on' : 'meio'; };
  openForm({title:`🏷️ Tags — ${n} processo(s)`, fields:[{type:'html', html:`<p class="small muted" style="margin-top:0">Clique para <b>incluir</b> (✓) ou <b>tirar</b> a tag de todos os selecionados. “–” = só alguns têm (fica como está).</p>
    <div class="tagsEd">${tagsProc().map(t => `<button type="button" class="tagC ${est(t)}" style="--c:${t.cor}" data-tg3="${t.id}" data-st="${est(t)}">${esc(t.nome)}</button>`).join('')}</div>`}],
    after:f => f.querySelectorAll('[data-tg3]').forEach(b => b.onclick = () => { const nx = b.dataset.st === 'on' ? '' : 'on'; b.dataset.st = nx; b.className = 'tagC ' + nx; }),
    onSave:() => { const ant = s.ls.map(p => ({id:p.id, tags:[...(p.tags || [])]}));
      mForm.querySelectorAll('[data-tg3]').forEach(b => { const id = b.dataset.tg3, st = b.dataset.st; if(st === 'meio') return;
        s.ls.forEach(p => { const tg = new Set(p.tags || []); st === 'on' ? tg.add(id) : tg.delete(id); p.tags = [...tg]; }); });
      save(); render(); setTimeout(updateBulk, 0);
      toastDesfazer(`Tags atualizadas em ${n} processo(s)`, () => { ant.forEach(a => { const p = byId('processos', a.id); if(p) p.tags = a.tags; }); save(); render(); }); }});
}
/* ----- alteração rápida (sem abrir o processo) ----- */
function procRapido(id){
  const p = byId('processos', id); if(!p) return;
  openForm({title:'⚡ ' + procLabel(p), data:{status:p.status, fase:p.fase, situacaoProc:p.situacaoProc}, fields:[
    {k:'status', label:'Status', type:'select', options:() => OPT.statusProc, empty:false, lista:'statusProc'},
    {k:'fase', label:'Fase do processo', type:'select', options:() => OPT.faseProc, lista:'faseProc'},
    {k:'situacaoProc', label:'Situação (o que se aguarda)', type:'select', options:() => OPT.situacaoProc, lista:'situacaoProc', full:true},
    {type:'html', html:`<label>🏷️ Tags</label><div id="tagsEdW">${tagsEditorHtml(p.tags || [])}</div>`},
    {type:'html', html:`<div class="small"><a href="#/processo/${id}" data-xfecha>abrir o processo</a> · <a href="#" data-xedit>editar todos os dados</a></div>`}],
    after:f => { tagsEditorLigar(f); f.querySelector('[data-xfecha]').onclick = () => closeModal(); f.querySelector('[data-xedit]').onclick = e => { e.preventDefault(); formProc(p); }; },
    onSave:o => { upsert('processos', {id, ...o, tags:tagsLer(mForm)}); toast('Atualizado'); }});
}
/* ----- relatórios ----- */
function loteRelatorio(col, lista, formato){
  const L = LOTE[col], cols = L.colunas, nomeArq = `${L.varios}-${today()}`;
  if(!lista.length) return toast('Nada para o relatório');
  if(formato === 'xls'){ const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    download(nomeArq + '.csv', '﻿' + [cols.map(c => q(c[0])).join(';'), ...lista.map(r => cols.map(c => q(c[1](r))).join(';'))].join('\r\n'), 'text/csv;charset=utf-8'); toast('📊 Planilha gerada (abre no Excel)'); return; }
  const tit = col === 'processos' ? 'Relatório de processos' : 'Relatório de clientes e partes';
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${tit}</title><style>
    body{font:11px/1.35 Arial,sans-serif;color:#111;margin:18px}h1{font-size:16px;margin:0 0 2px}.sub{color:#555;margin-bottom:10px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 5px;text-align:left;vertical-align:top}th{background:#eef2f7;font-size:10.5px}tr:nth-child(even) td{background:#fafafa}
    @page{size:A4 landscape;margin:12mm}</style></head><body>
    <h1>${tit}</h1><div class="sub">${lista.length} registro(s) · emitido em ${new Date().toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'})}</div>
    <table><thead><tr>${cols.map(c => `<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${lista.map(r => `<tr>${cols.map(c => `<td>${esc(c[1](r) ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
  const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(fr);
  fr.contentDocument.open(); fr.contentDocument.write(html); fr.contentDocument.close();
  setTimeout(() => { try{ fr.contentWindow.focus(); fr.contentWindow.print(); }catch(e){ toast('Não foi possível abrir a impressão'); } setTimeout(() => fr.remove(), 60000); }, 250);
  toast('📄 Escolha “Salvar como PDF” na janela de impressão');
}
// lista visível (filtrada) de cada tela — para “Selecionar todos” e para o relatório sem seleção
const loteVisiveis = col => [...document.querySelectorAll(`#view [data-xsel^="${col}:"]`)].map(c => byId(col, c.dataset.xsel.split(':')[1])).filter(Boolean);
Object.assign(A, {
  xAlterar: () => loteMenu(), xTags: () => loteTags(),
  xRel: d => { const s = xSel(); if(s) loteRelatorio(s.col, s.ls, d.f); },
  xRelTodos: d => loteRelatorio(d.col, loteVisiveis(d.col), d.f),
  xSelTodos: d => { const cs = document.querySelectorAll(`#view [data-xsel^="${d.col}:"]`), todos = [...cs].every(c => c.checked); cs.forEach(c => c.checked = !todos); updateBulk(); },
  procRapido: d => procRapido(d.id),
});
let xUlt = null;
document.addEventListener('click', e => {
  const c = e.target.closest('#view [data-xsel]');
  if(c){ if(e.shiftKey && xUlt && xUlt !== c && document.contains(xUlt)){ const all = [...document.querySelectorAll('#view [data-xsel]')], i = all.indexOf(xUlt), j = all.indexOf(c);
      if(i >= 0 && j >= 0) all.slice(Math.min(i, j), Math.max(i, j) + 1).forEach(x => x.checked = c.checked); }
    xUlt = c; updateBulk(); return; }
  const h = e.target.closest('#view [data-xselall]');
  if(h){ document.querySelectorAll(`#view [data-xsel^="${h.dataset.xselall}:"]`).forEach(x => x.checked = h.checked); updateBulk(); }
});
{ const limpar = A.bulkClear; A.bulkClear = d => { Object.values(XSEL).forEach(s => s.clear()); limpar(d); }; }
