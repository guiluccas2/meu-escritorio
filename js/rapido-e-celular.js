// Meu Escritório — ⚡ Lançamento rápido, botão “+”, tabelas em cartões no celular, atalhos do ícone e aparência
'use strict';
/* ================= ⚡ LANÇAMENTO RÁPIDO (prazos e compromissos) ================= */
const DIAS_SEM = {domingo:0, dom:0, segunda:1, seg:1, 'segunda-feira':1, terca:2, ter:2, 'terca-feira':2, quarta:3, qua:3, 'quarta-feira':3, quinta:4, qui:4, 'quinta-feira':4, sexta:5, sex:5, 'sexta-feira':5, sabado:6, sab:6};
const TIPO_PALAVRA = [[/^audi[eê]ncia/i, 'Audiência'], [/^per[ií]cia/i, 'Perícia'], [/^reuni[aã]o/i, 'Reunião'], [/^dilig[eê]ncia/i, 'Diligência'], [/^retorno/i, 'Retorno ao cliente']];
function parseRapido(txt){
  txt = String(txt || '').trim(); if(!txt) return null;
  const t = today(), tk = txt.split(/\s+/), usado = tk.map(() => false), nn = s => norm_s(s).replace(/[.,;:!?]+$/, '');
  let data = '', hora = '', proc = null, pessoa = null, dias = 0, contagem = 'u', base = '', tipo = '', subtipo = '';
  for(let i = 0; i < tk.length; i++){ // "a partir de 12/11"
    if(nn(tk[i]) === 'a' && nn(tk[i + 1] || '') === 'partir' && nn(tk[i + 2] || '') === 'de' && /^\d{1,2}\/\d{1,2}/.test(tk[i + 3] || '')){
      const [d, m, y] = tk[i + 3].replace(/[.,]$/, '').split('/'); let yy = y ? +y : +t.slice(0, 4); if(yy < 100) yy += 2000;
      base = `${yy}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; usado[i] = usado[i + 1] = usado[i + 2] = usado[i + 3] = true; }
  }
  tk.forEach((w, i) => { if(usado[i]) return; const x = nn(w); let m;
    if(!proc && (m = x.match(/^(\d+)\.(\d+)$/))){ const p = db.processos.find(p => procCode(p) === `${+m[1]}.${+m[2]}`); if(p){ proc = p; usado[i] = true; return; } }
    if(!proc && digits(w).length === 20){ const p = procPorNumero(w); if(p){ proc = p; usado[i] = true; return; } }
    if(!dias && (m = x.match(/^(\d{1,3})(du|d|dias?|dia)$/))){ dias = +m[1]; usado[i] = true; return; }
    if(!dias && /^\d{1,3}$/.test(x) && /^(dias?|du|d\.?u\.?)$/.test(nn(tk[i + 1] || ''))){ dias = +x; usado[i] = usado[i + 1] = true;
      if(/^uteis$/.test(nn(tk[i + 2] || ''))) usado[i + 2] = true; if(/^corridos?$/.test(nn(tk[i + 2] || ''))){ contagem = 'c'; usado[i + 2] = true; } return; }
    if(/^corridos?$/.test(x) && dias){ contagem = 'c'; usado[i] = true; return; }
    if(!hora && (m = x.match(/^(?:as)?(\d{1,2})(?:h|:)(\d{2})?h?$/))){ const h = +m[1]; if(h < 24){ hora = `${String(h).padStart(2, '0')}:${m[2] || '00'}`; usado[i] = true; if(i && /^(as|a)$/.test(nn(tk[i - 1]))) usado[i - 1] = true; return; } }
    if(!data){
      if(x === 'hoje'){ data = t; usado[i] = true; return; }
      if(x === 'amanha'){ data = addDays(t, 1); usado[i] = true; return; }
      if(x === 'depois' && nn(tk[i + 1] || '') === 'de' && nn(tk[i + 2] || '') === 'amanha'){ data = addDays(t, 2); usado[i] = usado[i + 1] = usado[i + 2] = true; return; }
      if(x in DIAS_SEM){ const alvo = DIAS_SEM[x]; let d = addDays(t, 1); while(parseD(d).getDay() !== alvo) d = addDays(d, 1); data = d; usado[i] = true; if(i && /^(na|no|nesta|neste|proxima|proximo)$/.test(nn(tk[i - 1]))) usado[i - 1] = true; return; }
      if((m = x.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))){ let yy = m[3] ? +m[3] : +t.slice(0, 4); if(yy < 100) yy += 2000;
        let d = `${yy}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; if(!m[3] && d < addDays(t, -30)) d = `${yy + 1}${d.slice(4)}`; data = d; usado[i] = true; if(i && /^(dia|em)$/.test(nn(tk[i - 1]))) usado[i - 1] = true; return; }
    }
    if(!tipo){ const tp = TIPO_PALAVRA.find(([re]) => re.test(x)); if(tp && OPT.tipoPrazo.includes(tp[1])){ tipo = tp[1]; return; } }
  });
  if(['Audiência', 'Perícia'].includes(tipo)) tk.forEach((w, i) => { if(subtipo || usado[i]) return; const x = nn(w);
    const st = OPT.subtipo.find(s => nn(s) === x || (x.length >= 4 && nn(s).startsWith(x))); if(st && st.split(' ').length === 1){ subtipo = st; usado[i] = true; } });
  if(!proc){ // cliente pelo nome (palavra de 3+ letras que identifica um único cliente)
    tk.forEach((w, i) => { if(pessoa || usado[i]) return; const x = nn(w); if(x.length < 3) return;
      const hits = db.pessoas.filter(p => p.tipo === 'Cliente' && norm_s(p.nome).split(/\s+/).includes(x)); if(hits.length === 1) pessoa = hits[0]; }); }
  if(!tipo) tipo = dias ? 'Prazo processual' : 'Tarefa';
  if(dias){ const b = base || t; data = calcPrazo(b, dias, contagem); base = b; }
  let titulo = tk.filter((w, i) => !usado[i]).join(' ').replace(/^(para|de|em|no|na)\s+/i, '').trim();
  if(tipo === 'Audiência' && /^audi[eê]ncia$/i.test(titulo) && subtipo) titulo = 'Audiência de ' + subtipo.toLowerCase();
  if(!titulo) titulo = subtipo ? `${tipo} de ${subtipo.toLowerCase()}` : tipo;
  titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1);
  const feriados = []; if(dias && contagem === 'u'){ for(let d = addDays(base, 1); d <= data; d = addDays(d, 1)){ const wd = parseD(d).getDay(); if(wd && wd !== 6 && !isBusiness(d, true)) feriados.push(d); } }
  return {titulo, tipo, subtipo, data, hora, processoId:proc?.id || '', pessoaId:proc?.clienteId || pessoa?.id || '', dias, contagem, base, feriados};
}
function rapidoRegistro(r){
  const rec = {titulo:r.titulo, tipo:r.tipo, subtipo:r.subtipo, data:r.data, hora:r.hora, processoId:r.processoId, pessoaId:r.pessoaId, situacao:'Pendente', concluido:false};
  if(r.tipo === 'Prazo processual' && r.data){ rec.dataFatal = r.data; if(r.dias) rec.obs = `Prazo de ${r.dias} dia(s) ${r.contagem === 'u' ? 'úteis' : 'corridos'} contado a partir de ${fmtD(r.base)} (lançamento rápido).`; }
  rec.coluna = colunaAuto(rec); return rec;
}
function rapidoPrevia(r){
  if(!r) return '';
  const pr = byId('processos', r.processoId), pe = byId('pessoas', r.pessoaId);
  const ico = {'Prazo processual':'⏰', 'Audiência':'⚖️', 'Perícia':'🔬', 'Reunião':'👥', 'Diligência':'🚗'}[r.tipo] || '📌';
  const sem = r.data ? parseD(r.data).toLocaleDateString('pt-BR', {weekday:'short'}).replace('.', '') : '';
  return `<div class="r">${ico} <span><b>${esc(r.tipo)}</b>${r.subtipo && !norm_s(r.titulo).includes(norm_s(r.subtipo)) ? ' · ' + esc(r.subtipo) : ''}${norm_s(r.titulo) !== norm_s(r.tipo) ? ' · ' + esc(r.titulo) : ''}</span></div>
    ${pr ? `<div class="r">📁 <span>${esc(procLabel(pr))}${pe ? ' · ' + esc(pe.nome) : ''}</span></div>` : pe ? `<div class="r">👤 <span>${esc(pe.nome)}</span></div>` : ''}
    <div class="r">📅 <span>${r.data ? `${r.dias ? 'vence ' : ''}<b>${sem}, ${fmtD(r.data)}</b>${r.hora ? ' às <b>' + r.hora + '</b>' : ''}${r.dias ? ` — ${r.dias} dia(s) ${r.contagem === 'u' ? 'úteis' : 'corridos'} a partir de ${fmtD(r.base)}` : ''}${r.feriados.length ? ` <span class="muted">(feriado${r.feriados.length > 1 ? 's' : ''} ${r.feriados.map(d => fmtD(d).slice(0, 5)).join(', ')} considerado${r.feriados.length > 1 ? 's' : ''})</span>` : ''}` : '<span class="muted">sem data — vai para “Em análise”</span>'}</span></div>
    ${r.tipo === 'Prazo processual' && r.data ? `<div class="r">⚠️ <span>prazo fatal ${fmtD(r.data)}</span></div>` : ''}
    <div class="r small muted">Enter para salvar · <a href="#" data-act="rapidoForm">✏️ abrir formulário completo</a></div>`;
}
function rapidoHtml(){
  return `<form class="rapido" id="rapidoForm" autocomplete="off"><div class="rapTop"><b>⚡ Rápido</b><span class="small muted">— digite e veja a prévia: <i>contestação 15 dias 152.1</i> · <i>audiência 03/12 14h30 152.1 conciliação</i> · <i>ligar Eduardo amanhã</i></span></div>
    <div class="rapLinha"><input id="rapidoIn" placeholder="Ex.: réplica 15 dias 152.1" enterkeyhint="done"><button class="btn primary" type="button" data-act="rapidoSalvar">Salvar</button></div><div id="rapidoPrev" class="rapPrev" hidden></div></form>`;
}
document.addEventListener('input', e => { if(e.target.id !== 'rapidoIn') return; const r = parseRapido(e.target.value), box = document.getElementById('rapidoPrev'); if(!box) return; box.hidden = !r; box.innerHTML = rapidoPrevia(r); });
document.addEventListener('submit', e => { if(e.target.id !== 'rapidoForm') return; e.preventDefault();
  const r = parseRapido(document.getElementById('rapidoIn').value); if(!r) return toast('Digite o compromisso. Ex.: contestação 15 dias 152.1');
  const n = upsert('prazos', rapidoRegistro(r)); toast(`✅ ${n.tipo} criado${n.data ? ' para ' + fmtD(n.data) : ''}`); render(); setTimeout(() => document.getElementById('rapidoIn')?.focus(), 50); });
A.rapidoSalvar = () => document.getElementById('rapidoForm').requestSubmit();
A.rapidoForm = () => { const r = parseRapido(document.getElementById('rapidoIn')?.value); formPrazo(r ? rapidoRegistro(r) : {}); };
A.rapidoAbrir = () => { const ir = () => { const i = document.getElementById('rapidoIn'); if(i){ i.focus(); i.scrollIntoView({block:'center'}); } };
  if(document.getElementById('rapidoIn')) ir(); else { go('#/painel'); setTimeout(ir, 120); } };

/* ================= BOTÃO "+" (celular) ================= */
A.plusMenu = () => { const s = document.getElementById('plusSheet'); s.hidden = !s.hidden; document.getElementById('plusBtn').classList.toggle('aberto', !s.hidden); };
document.getElementById('plusSheet').addEventListener('click', e => { if(e.target.closest('[data-act]') || e.target.id === 'plusSheet'){ document.getElementById('plusSheet').hidden = true; document.getElementById('plusBtn').classList.remove('aberto'); } });

/* ================= TABELAS VIRAM CARTÕES NO CELULAR ================= */
function rotularTabelas(raiz){
  (raiz || document).querySelectorAll('#view table:not(.nostack)').forEach(t => {
    t.classList.add('stack');
    const heads = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
    t.querySelectorAll('tbody tr, tfoot tr').forEach(tr => { let i = 0;
      for(const td of tr.children){ if(td.dataset.label === undefined){ const h = heads[i] || ''; td.dataset.label = h;
        if(!td.classList.contains('sel') && td.childNodes.length > 1){ const w = document.createElement('div'); w.className = 'cv'; while(td.firstChild) w.appendChild(td.firstChild); td.appendChild(w); }
        if(!h && !td.classList.contains('sel') && !td.querySelector('button,a,input,select') && td.textContent.trim().length <= 2) td.classList.add('hideM'); }
        i += td.colSpan || 1; } });
  });
}
new MutationObserver(() => { cancelAnimationFrame(rotularTabelas._r); rotularTabelas._r = requestAnimationFrame(() => rotularTabelas()); }).observe(document.getElementById('view'), {childList:true, subtree:true});

/* ================= ATALHOS DO ÍCONE DO APP ================= */
(function(){ const a = new URLSearchParams(location.search).get('a'); if(!a) return;
  history.replaceState(null, '', location.pathname + location.hash);
  setTimeout(() => { if(a === 'conversa') A.newConv({}); else if(a === 'prazo') A.newPrazo({}); else if(a === 'publicacoes') go('#/publicacoes'); else if(a === 'rapido') A.rapidoAbrir(); }, 400); })();

/* ================= APARÊNCIA (claro / escuro) ================= */
function temaAtual(){ const t = document.documentElement.dataset.theme; return t === 'light' || t === 'dark' ? t : 'auto'; }
function mostrarTema(){ const t = temaAtual();
  document.querySelectorAll('.temaSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === t));
  const meta = document.querySelector('meta[name="theme-color"]'); if(meta) meta.content = '#16263a'; }
A.temaSet = d => { const v = d.v;
  try{ if(v === 'auto') localStorage.removeItem('escritorio_tema'); else localStorage.setItem('escritorio_tema', v); }catch(e){}
  if(v === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
  mostrarTema(); };
mostrarTema();

