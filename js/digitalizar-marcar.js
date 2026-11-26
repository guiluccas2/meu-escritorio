/* ===== 🖊 Digitalizar — marcar a página (tela “🖊 Marcar” do digitalizar.js) =====
   ⬛ tarja preta (CPF, RG, endereço, conta — LGPD) · ⬜ tarja branca (apaga anotação/carimbo) · 🔤 texto (prontos: “Confere com o original”,
   “Cópia”, “uso exclusivo no processo”, data… + os seus, em db.meta.digTextos) · ✍️ assinatura (desenhada na tela ou fotografada; salvas SÓ
   neste aparelho, localStorage 'escritorio_assinaturas') · 💧 marca d’água (do documento todo: doc.marcaOn/doc.marca).
   Marcas em p.marcas, em frações da página pronta (0–1, depois do recorte e do giro):
     {t:'tp'|'tb', x, y, w, h} · {t:'txt', x, y, s (letra ÷ largura), linhas:[…], cor, mold} · {t:'ass', x, y, w, ar (altura/largura), src (PNG)}
   São “queimadas” na imagem por digProcessar → digMarcasDesenhar: no PDF não dá para tirar a tarja. Tudo no aparelho, sem IA. */
const DIG_CORES = {azul:'#1d4fa3', preto:'#111111', vermelho:'#c0262d'};
const DIG_ASS_KEY = 'escritorio_assinaturas';
const digImgs = new Map(); // src → imagem carregada (assinaturas)
function digImg(src){ let im = digImgs.get(src); if(!im){ im = new Image(); im.src = src; digImgs.set(src, im); } return im; }
function digMarcasPreparar(marcas){ return Promise.all((marcas || []).filter(m => m.src).map(m => new Promise(r => { const im = digImg(m.src); if(im.complete && im.naturalWidth) r(); else im.addEventListener('load', r, {once:true}), im.addEventListener('error', r, {once:true}); }))); }

/* ----- desenho (usado também no PDF) ----- */
function digTxtCaixa(ctx, m, W){ const fs = m.s * W, ls = m.linhas && m.linhas.length ? m.linhas : [''], f2 = fs * .72;
  ctx.font = `bold ${fs}px Arial, sans-serif`; let lw = ctx.measureText(ls[0]).width; ctx.font = `${f2}px Arial, sans-serif`; ls.slice(1).forEach(l => { lw = Math.max(lw, ctx.measureText(l).width); });
  const pad = m.mold ? fs * .45 : fs * .1; return {w:lw + 2 * pad, h:fs * 1.1 + (ls.length - 1) * f2 * 1.25 + 2 * pad, pad, fs, f2}; }
function digMarcaCaixa(ctx, m, W, H){
  if(m.t === 'txt') return {x:m.x * W, y:m.y * H, ...digTxtCaixa(ctx, m, W)};
  if(m.t === 'ass'){ const w = m.w * W; return {x:m.x * W, y:m.y * H, w, h:w * m.ar}; }
  return {x:m.x * W, y:m.y * H, w:m.w * W, h:m.h * H}; }
function digMarcasDesenhar(ctx, W, H, marcas){
  (marcas || []).forEach(m => { const c = digMarcaCaixa(ctx, m, W, H); ctx.save();
    if(m.t === 'tp' || m.t === 'tb'){ ctx.fillStyle = m.t === 'tp' ? '#000' : '#fff'; ctx.fillRect(c.x, c.y, c.w, c.h); }
    else if(m.t === 'txt'){ const cor = DIG_CORES[m.cor] || DIG_CORES.azul; ctx.fillStyle = cor; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.font = `bold ${c.fs}px Arial, sans-serif`; ctx.fillText(m.linhas[0] || '', c.x + c.pad, c.y + c.pad);
      ctx.font = `${c.f2}px Arial, sans-serif`; m.linhas.slice(1).forEach((l, i) => ctx.fillText(l, c.x + c.pad, c.y + c.pad + c.fs * 1.1 + i * c.f2 * 1.25 + c.f2 * .15));
      if(m.mold){ const lw = Math.max(1, c.fs * .1); ctx.strokeStyle = cor; ctx.lineWidth = lw; ctx.strokeRect(c.x + lw / 2, c.y + lw / 2, c.w - lw, c.h - lw); } }
    else if(m.t === 'ass'){ const im = digImg(m.src); if(im.complete && im.naturalWidth) ctx.drawImage(im, c.x, c.y, c.w, c.h); }
    ctx.restore(); });
}

/* ----- tela “Marcar” ----- */
function digMarcarAbrir(){ const p = digPag(); if(!p) return; p.marcas = p.marcas || []; dig.marcar = {sel:-1, ferr:null, hist:[]}; dig.ver = true; dig.livro = null; digRender(); }
function digMarcarHtml(p){ const m = dig.marcar, doc = digDoc(), sel = p.marcas[m.sel];
  return `<div class="digMarcTopo"><b>🖊 Marcar a página ${dig.at + 1}</b><button type="button" class="btn primary" data-dgk="pronto">✔ Pronto</button></div>
    <div class="digStage" id="digStage"><canvas id="digCv" class="digMarcCv"></canvas></div>
    <div class="digFerr">
      <button type="button" class="mini ${m.ferr === 'tp' ? 'on' : ''}" data-dgk="tp" title="Cobre o trecho de preto (dados sensíveis)">⬛ Tarja preta</button>
      <button type="button" class="mini ${m.ferr === 'tb' ? 'on' : ''}" data-dgk="tb" title="Cobre o trecho de branco (apaga anotação ou carimbo)">⬜ Tarja branca</button>
      <button type="button" class="mini" data-dgk="txt">🔤 Texto</button><button type="button" class="mini" data-dgk="ass">✍️ Assinatura</button>
      <button type="button" class="mini ${doc.marcaOn ? 'on' : ''}" data-dgk="agua" title="Marca d’água em todas as páginas deste documento">💧 Marca d’água</button>
      <button type="button" class="mini" data-dgk="desf" ${m.hist.length ? '' : 'disabled'}>↶ Desfazer</button>
      <button type="button" class="mini" data-dgk="rem" ${sel ? '' : 'disabled'}>🗑 Remover selecionado</button></div>
    ${sel && sel.t === 'txt' ? `<div class="digChips">${Object.keys(DIG_CORES).map(k => `<button type="button" class="dgChip ${sel.cor === k ? 'on' : ''}" data-dgk="cor:${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}<button type="button" class="dgChip ${sel.mold ? 'on' : ''}" data-dgk="mold">Moldura</button></div>` : ''}
    <div class="small muted" id="digAviso">${m.ferr ? `Arraste o dedo na página para cobrir o trecho com a tarja ${m.ferr === 'tp' ? 'preta' : 'branca'}. Toque de novo no botão para parar.` : 'Toque numa marca para mover; a bolinha azul muda o tamanho. Tudo fica gravado na imagem do PDF (não dá para tirar a tarja depois).'}</div>`; }
function digMarcarDesenhar(){
  const p = digPag(), cv = document.getElementById('digCv'); if(!p || !cv || !dig.marcar) return;
  const base = digProcessar(p, digMaxPalco(), {semMarcas:true}), {cw, ch, dpr} = digPalco(base);
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  const x = cv.getContext('2d'), desenha = () => { x.drawImage(base, 0, 0, cv.width, cv.height); digMarcasDesenhar(x, cv.width, cv.height, p.marcas);
    if(digDoc().marcaOn) digMarcaDagua(x, cv.width, cv.height, digDoc().marca);
    const s = p.marcas[dig.marcar?.sel]; if(!s) return; const c = digMarcaCaixa(x, s, cv.width, cv.height);
    x.save(); x.setLineDash([6 * dpr, 4 * dpr]); x.strokeStyle = '#5b9bd5'; x.lineWidth = 2 * dpr; x.strokeRect(c.x - 3 * dpr, c.y - 3 * dpr, c.w + 6 * dpr, c.h + 6 * dpr); x.setLineDash([]);
    x.fillStyle = '#5b9bd5'; x.beginPath(); x.arc(c.x + c.w + 3 * dpr, c.y + c.h + 3 * dpr, 9 * dpr, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 2 * dpr; x.stroke(); x.restore(); };
  desenha(); dig.marcar.desenha = desenha;
  const fr = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }; let op = null;
  cv.onpointerdown = e => { const M = dig.marcar; if(!M) return; e.preventDefault(); try{ cv.setPointerCapture(e.pointerId); }catch(er){}
    const [fx, fy] = fr(e), Wc = cv.width, Hc = cv.height, snap = JSON.stringify(p.marcas), s = p.marcas[M.sel];
    if(s){ const c = digMarcaCaixa(x, s, Wc, Hc); if(Math.hypot(fx * Wc - (c.x + c.w), fy * Hc - (c.y + c.h)) < 24 * dpr){ op = {t:'tam', snap, ini:[fx, fy], m0:{...s}, w0:c.w / Wc}; return; } }
    if(M.ferr){ p.marcas.push({t:M.ferr, x:fx, y:fy, w:0, h:0}); M.sel = p.marcas.length - 1; op = {t:'novo', snap, ini:[fx, fy]}; return desenha(); }
    for(let i = p.marcas.length - 1; i >= 0; i--){ const c = digMarcaCaixa(x, p.marcas[i], Wc, Hc), px = fx * Wc, py = fy * Hc, f = 6 * dpr;
      if(px >= c.x - f && px <= c.x + c.w + f && py >= c.y - f && py <= c.y + c.h + f){ M.sel = i; op = {t:'mover', snap, ini:[fx, fy], m0:{...p.marcas[i]}, sel:true}; return desenha(); } }
    const tinha = M.sel >= 0; M.sel = -1; op = null; desenha(); if(tinha) digRender(); };
  cv.onpointermove = e => { if(!op) return; const [fx, fy] = fr(e), m = p.marcas[dig.marcar.sel]; if(!m) return; op.mexeu = true;
    if(op.t === 'novo'){ m.x = Math.max(0, Math.min(op.ini[0], fx)); m.y = Math.max(0, Math.min(op.ini[1], fy)); m.w = Math.min(1, Math.max(op.ini[0], fx)) - m.x; m.h = Math.min(1, Math.max(op.ini[1], fy)) - m.y; }
    else if(op.t === 'mover'){ m.x = Math.max(-.05, Math.min(.98, op.m0.x + fx - op.ini[0])); m.y = Math.max(-.05, Math.min(.98, op.m0.y + fy - op.ini[1])); }
    else { const dx = fx - op.ini[0], dy = fy - op.ini[1];
      if(m.t === 'tp' || m.t === 'tb'){ m.w = Math.max(.01, op.m0.w + dx); m.h = Math.max(.004, op.m0.h + dy); }
      else if(m.t === 'ass') m.w = Math.max(.04, op.m0.w + dx);
      else m.s = Math.max(.008, op.m0.s * Math.max(.2, (op.w0 + dx) / op.w0)); }
    desenha(); };
  cv.onpointerup = cv.onpointercancel = () => { if(!op) return; const M = dig.marcar, m = p.marcas[M.sel];
    if(op.t === 'novo' && m && (m.w < .01 || m.h < .004)){ p.marcas.splice(M.sel, 1); M.sel = -1; } else if(op.mexeu || op.t === 'novo') M.hist.push(op.snap);
    op = null; digRender(); };
}
function digMarcarAdd(m){ const p = digPag(), M = dig.marcar; M.hist.push(JSON.stringify(p.marcas)); p.marcas.push(m); M.sel = p.marcas.length - 1; M.ferr = null; document.getElementById('digSheet')?.remove(); digRender(); }

/* ----- textos prontos ----- */
function digTextosProntos(){
  const o = (monCfg().oabs || [])[0], oab = o && o.numero ? `OAB/${o.uf || ''} ${Number(digits(o.numero)).toLocaleString('pt-BR')}` : '', hoje = fmtD(today()), num = dig?.alvo?.procNum || '';
  return [['✔ Confere com o original', ['CONFERE COM O ORIGINAL', [hoje, oab].filter(Boolean).join(' · ')], '+ data e OAB'], ['📄 Cópia', ['CÓPIA']],
    ['🔒 Documento do cliente — uso exclusivo no processo', ['DOCUMENTO DO CLIENTE', `uso exclusivo no processo nº ${num || '__________'}`], num ? 'nº ' + num : ''],
    ['📅 Data de hoje', [hoje], hoje], ['📥 Recebido em', ['RECEBIDO EM ' + hoje]], ['✔ Confere com o original (só o texto)', ['CONFERE COM O ORIGINAL']]]
    .concat((db.meta.digTextos || []).map((t, i) => ['📝 ' + t, t.split(/\s*\|\s*/), '', i])); }
function digSheet(html){ document.getElementById('digSheet')?.remove(); const s = document.createElement('div'); s.id = 'digSheet';
  s.innerHTML = `<div class="dsFundo" data-dgs="fechar"></div><div class="dsBox"><button type="button" class="dsX" data-dgs="fechar" aria-label="Fechar">×</button>${html}</div>`; document.getElementById('digOv').appendChild(s); return s; }
function digSheetTexto(){ const c = db.meta.digCfg || {}, cor = c.txtCor || 'azul', mold = c.txtMold !== false;
  digSheet(`<b>🔤 Texto</b><div class="small muted" style="margin:2px 0 8px">Escolha um pronto ou escreva o seu. Depois arraste para o lugar.</div>
    ${digTextosProntos().map(([n, , sub, ci], i) => `<div class="dsOpt"><button type="button" data-dgs="t:${i}">${esc(n)}${sub ? ` <span class="small muted">${esc(sub)}</span>` : ''}</button>${ci !== undefined ? `<button type="button" class="dsDel" data-dgs="tdel:${ci}" title="Apagar este texto da lista">✕</button>` : ''}</div>`).join('')}
    <div class="dsOpt"><button type="button" data-dgs="tnovo">➕ Escrever outro texto… <span class="small muted">(fica salvo na lista)</span></button></div>
    <div class="digChips">${Object.keys(DIG_CORES).map(k => `<button type="button" class="dgChip ${cor === k ? 'on' : ''}" data-dgs="cor:${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}<button type="button" class="dgChip ${mold ? 'on' : ''}" data-dgs="mold">Com moldura</button></div>`); }
function digTextoAdd(linhas){ const c = db.meta.digCfg || {}; digMarcarAdd({t:'txt', x:.07, y:.78, s:.034, linhas, cor:c.txtCor || 'azul', mold:c.txtMold !== false}); }

/* ----- ✍️ assinaturas (só neste aparelho) ----- */
function digAssLista(){ try{ const l = JSON.parse(localStorage.getItem(DIG_ASS_KEY) || '[]'); return Array.isArray(l) ? l : []; }catch(e){ return []; } }
function digAssGuardar(l){ try{ localStorage.setItem(DIG_ASS_KEY, JSON.stringify(l)); return true; }catch(e){ toast('Sem espaço para guardar a assinatura neste aparelho'); return false; } }
function digAssNova(src){ if(!src) return; const l = digAssLista(); l.unshift({id:uid(), src}); if(digAssGuardar(l.slice(0, 8))){ toast('✍️ Assinatura salva neste aparelho'); digSheetAss(); } }
function digSheetAss(){ const l = digAssLista();
  digSheet(`<b>✍️ Assinatura</b><div class="small muted" style="margin:2px 0 8px">Toque numa assinatura salva para pôr na página; depois arraste e ajuste o tamanho.</div>
    <div class="dsAss">${l.map(a => `<div class="dsAssI"><button type="button" data-dgs="a:${a.id}"><img src="${a.src}" alt="assinatura"></button><button type="button" class="dsDel" data-dgs="adel:${a.id}" title="Apagar esta assinatura">✕</button></div>`).join('') || '<div class="small muted">Nenhuma assinatura salva ainda.</div>'}</div>
    <div class="digChips"><button type="button" class="mini" data-dgs="adesenhar">✏️ Desenhar nova</button><button type="button" class="mini" data-dgs="afoto">📷 Foto da assinatura</button></div>
    <input type="file" accept="image/*" id="digAssArq" hidden>
    <div class="small muted">As assinaturas ficam só neste aparelho. Imagem de assinatura não substitui o certificado digital (ICP-Brasil).</div>`); }
function digSheetPad(){
  const s = digSheet(`<b>✏️ Desenhe sua assinatura ou rubrica</b><div class="small muted" style="margin:2px 0 8px">Use o dedo (ou a caneta). Deite o celular para ter mais espaço.</div>
    <canvas id="digPad" class="digPad"></canvas><div class="digChips"><button type="button" class="btn primary" data-dgs="psalvar">✔ Salvar</button><button type="button" class="btn" data-dgs="plimpar">Limpar</button><button type="button" class="btn" data-dgs="ass">Voltar</button></div>`);
  const cv = s.querySelector('#digPad'), dpr = Math.min(3, devicePixelRatio || 1), w = cv.clientWidth || 320, h = cv.clientHeight || 180; cv.width = w * dpr; cv.height = h * dpr;
  const x = cv.getContext('2d'); x.lineCap = x.lineJoin = 'round'; x.strokeStyle = '#14306b'; x.lineWidth = 2.6 * dpr; let ult = null;
  const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr]; };
  cv.onpointerdown = e => { e.preventDefault(); try{ cv.setPointerCapture(e.pointerId); }catch(er){} ult = pt(e); x.beginPath(); x.arc(ult[0], ult[1], x.lineWidth / 2, 0, 7); x.fillStyle = x.strokeStyle; x.fill(); cv.dataset.usado = '1'; };
  cv.onpointermove = e => { if(!ult) return; const q = pt(e); x.beginPath(); x.moveTo(ult[0], ult[1]); x.lineTo(q[0], q[1]); x.stroke(); ult = q; };
  cv.onpointerup = cv.onpointercancel = () => { ult = null; }; }
// recorta a assinatura (só a parte desenhada, com uma margem) e devolve PNG com fundo transparente
function digAparar(cv){ const x = cv.getContext('2d', {willReadFrequently:true}), {width:W, height:H} = cv, d = x.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for(let y = 0; y < H; y++) for(let z = 0; z < W; z++) if(d[(y * W + z) * 4 + 3] > 20){ if(z < x0) x0 = z; if(z > x1) x1 = z; if(y < y0) y0 = y; if(y > y1) y1 = y; }
  if(x1 < 0) return ''; const m = 6, w = Math.min(W, x1 + m) - Math.max(0, x0 - m), h = Math.min(H, y1 + m) - Math.max(0, y0 - m), k = Math.min(1, 900 / w), c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(cv, Math.max(0, x0 - m), Math.max(0, y0 - m), w, h, 0, 0, c.width, c.height); return c.toDataURL('image/png'); }
// foto da assinatura no papel → só a tinta (o papel fica transparente)
function digAssDaFoto(img){ const k = Math.min(1, 1200 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const x = c.getContext('2d', {willReadFrequently:true}); x.drawImage(img, 0, 0, c.width, c.height); const im = x.getImageData(0, 0, c.width, c.height), d = im.data, n = c.width * c.height, L = new Float32Array(n);
  for(let i = 0; i < n; i++) L[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
  const t = digOtsu(L) - 12; for(let i = 0; i < n; i++){ const a = L[i] < t ? Math.min(255, (t - L[i]) * 5) : 0; d[i * 4] *= .55; d[i * 4 + 1] *= .55; d[i * 4 + 2] *= .7; d[i * 4 + 3] = a; }
  x.putImageData(im, 0, 0); return digAparar(c); }
function digAssAdd(src){ const im = digImg(src), por = () => { const ar = im.naturalHeight / im.naturalWidth || .35, cv = document.getElementById('digCv'), r = cv ? cv.width / cv.height : .7, w = .3;
  digMarcarAdd({t:'ass', x:.62, y:Math.max(.02, Math.min(.96 - w * ar * r, .82)), w, ar, src}); };
  if(im.complete && im.naturalWidth) por(); else im.addEventListener('load', por, {once:true}); }

/* ----- cliques da tela Marcar e das janelinhas ----- */
document.addEventListener('click', e => {
  const k = e.target.closest && e.target.closest('#digOv [data-dgk]'), s = e.target.closest && e.target.closest('#digOv [data-dgs]'); if((!k && !s) || !dig) return;
  const p = digPag(), doc = digDoc(), M = dig.marcar;
  if(k){ const a = k.dataset.dgk; if(!M || !p) return;
    if(a === 'pronto'){ dig.marcar = null; digRender(); digThumb(p); return; }
    if(a === 'tp' || a === 'tb'){ M.ferr = M.ferr === a ? null : a; M.sel = -1; return digRender(); }
    if(a === 'txt') return digSheetTexto();
    if(a === 'ass') return digSheetAss();
    if(a === 'agua'){ doc.marcaOn = !doc.marcaOn; if(doc.marcaOn && !doc.marca) doc.marca = digMarcaPadrao(); toast(doc.marcaOn ? `💧 Marca d’água: “${doc.marca}” (o texto se muda no painel ao lado/abaixo)` : 'Marca d’água desligada'); return digRender(); }
    if(a === 'desf' && M.hist.length){ p.marcas = JSON.parse(M.hist.pop()); M.sel = -1; return digRender(); }
    if(a === 'rem' && p.marcas[M.sel]){ M.hist.push(JSON.stringify(p.marcas)); p.marcas.splice(M.sel, 1); M.sel = -1; return digRender(); }
    const m = p.marcas[M.sel]; if(!m || m.t !== 'txt') return; M.hist.push(JSON.stringify(p.marcas));
    if(a.startsWith('cor:')) m.cor = a.slice(4); if(a === 'mold') m.mold = !m.mold;
    db.meta.digCfg = {...(db.meta.digCfg || {}), txtCor:m.cor, txtMold:m.mold}; save(); return digRender(); }
  const a = s.dataset.dgs;
  if(a === 'fechar') return document.getElementById('digSheet')?.remove();
  if(a === 'ass') return digSheetAss();
  if(a.startsWith('t:')){ const t = digTextosProntos()[+a.slice(2)]; if(t) digTextoAdd(t[1].filter(x => x !== '')); return; }
  if(a.startsWith('tdel:')){ const l = (db.meta.digTextos || []).slice(); l.splice(+a.slice(5), 1); db.meta.digTextos = l; save(); return digSheetTexto(); }
  if(a === 'tnovo'){ const t = (prompt('Texto para pôr na página (use | para quebrar a linha):') || '').trim(); if(!t) return;
    db.meta.digTextos = [t, ...(db.meta.digTextos || []).filter(x => x !== t)].slice(0, 20); save(); return digTextoAdd(t.split(/\s*\|\s*/)); }
  if(a.startsWith('cor:') || a === 'mold'){ const c = db.meta.digCfg || {}; db.meta.digCfg = a === 'mold' ? {...c, txtMold:c.txtMold === false} : {...c, txtCor:a.slice(4)}; save(); return digSheetTexto(); }
  if(a.startsWith('a:')){ const x = digAssLista().find(y => y.id === a.slice(2)); if(x) digAssAdd(x.src); return; }
  if(a.startsWith('adel:')){ if(!confirm('Apagar esta assinatura deste aparelho?')) return; digAssGuardar(digAssLista().filter(y => y.id !== a.slice(5))); return digSheetAss(); }
  if(a === 'adesenhar') return digSheetPad();
  if(a === 'afoto') return document.getElementById('digAssArq')?.click();
  if(a === 'plimpar'){ const c = document.getElementById('digPad'); c.getContext('2d').clearRect(0, 0, c.width, c.height); delete c.dataset.usado; return; }
  if(a === 'psalvar'){ const c = document.getElementById('digPad'); if(!c.dataset.usado) return toast('Desenhe a assinatura primeiro'); return digAssNova(digAparar(c)); }
});
document.addEventListener('change', async e => { if(e.target.id !== 'digAssArq' || !e.target.files[0]) return; const f = e.target.files[0]; e.target.value = '';
  try{ const src = digAssDaFoto(await digCarregar(f)); if(!src) return toast('Não encontrei a assinatura na foto — use papel branco e caneta escura'); digAssNova(src); }catch(er){ toast('Não foi possível abrir a foto'); } });
