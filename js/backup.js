/* ===== 🛟 Backups automáticos =====
   • A cada X minutos (Configurações; padrão 10), se houve alteração, guarda uma cópia completa dos dados neste aparelho
     (IndexedDB “escritorio_backup”, compactada em gzip quando o navegador permite).
   • Com o Dropbox conectado, envia 1 cópia por hora para a pasta /backups do app no Dropbox (a cada aparelho).
   • Cópia extra imediata ANTES de: remover 5+ registros de uma vez (qualquer tela, sincronização ou workflow), restaurar e apagar tudo.
   • Cada cópia é conferida contra a anterior: se muitos registros sumiram, fica marcada “⚠️ suspeita” e aparece um aviso.
   • Retenção: tudo das últimas 24 h · 1 por hora até 7 dias · 1 por dia até 90 dias · 1 por semana até 1 ano.
   • Restaurar sempre faz antes uma cópia do estado atual (dá para voltar atrás). */
const BK = {ult:null, nuvemUlt:null, rodando:false, alerta:null};
const BK_COLS_IMPORTANTES = ['pessoas', 'processos', 'prazos', 'andamentos', 'conversas', 'financeiro', 'acordos', 'leads'];
const bkCfg = () => ({intervalo:10, nuvem:true, ...(db.meta.backup || {})});
const bkContar = d => Object.fromEntries(COL.map(c => [c, (d[c] || []).length]));
const bkTotal = n => sum(COL.map(c => n[c] || 0));

function bkIdb(){ return BK._db || (BK._db = new Promise((res, rej) => { const r = indexedDB.open('escritorio_backup', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('snaps', {keyPath:'id'}); r.onsuccess = () => res(r.result); r.onerror = () => { BK._db = null; rej(r.error); }; })); }
async function bkTx(modo, fn){ const d = await bkIdb(); return new Promise((res, rej) => { const t = d.transaction('snaps', modo), st = t.objectStore('snaps'); let out; const q = fn(st); if(q) q.onsuccess = () => { out = q.result; };
  t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('cancelado')); }); }
// lista sem os dados (só o resumo de cada cópia), da mais nova para a mais antiga
async function bkListar(){ const out = []; const d = await bkIdb();
  await new Promise((res, rej) => { const q = d.transaction('snaps').objectStore('snaps').openCursor(null, 'prev');
    q.onsuccess = () => { const c = q.result; if(!c) return res(); const {dados, ...r} = c.value; out.push(r); c.continue(); }; q.onerror = () => rej(q.error); });
  return out; }
async function bkComprimir(str){
  if(typeof CompressionStream === 'undefined') return {gz:false, dados:str};
  try{ return {gz:true, dados:await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).blob()}; }catch(e){ return {gz:false, dados:str}; } }
async function bkTexto(r){ if(!r.gz) return r.dados; return new Response(r.dados.stream().pipeThrough(new DecompressionStream('gzip'))).text(); }

// confere se a cópia nova perdeu muita coisa em relação à anterior confiável
function bkSuspeita(n, ant){
  if(!ant) return ''; const tA = bkTotal(ant.n), tN = bkTotal(n), perdas = [];
  BK_COLS_IMPORTANTES.forEach(c => { const a = ant.n[c] || 0, b = n[c] || 0; if(a >= 10 && b <= a * 0.5) perdas.push(`${NOMES_COL[c] || c}: ${a} → ${b}`); });
  if(tA >= 20 && tN <= tA * 0.8) perdas.unshift(`total: ${tA} → ${tN}`);
  return perdas.join(' · '); }
const NOMES_COL = {pessoas:'clientes e partes', processos:'processos', prazos:'compromissos', andamentos:'andamentos', conversas:'atendimentos', financeiro:'lançamentos', acordos:'acordos', leads:'leads', monitor:'publicações', horas:'horas'};

// grava uma cópia a partir do texto JSON (o texto é capturado na hora; a compactação acontece depois)
async function bkDoTexto(str, motivo, n){
  try{
    const d = n ? null : JSON.parse(str); n = n || bkContar(d);
    const lista = await bkListar(), ant = lista.find(x => !x.suspeita);
    const suspeita = /^antes /.test(motivo) ? '' : bkSuspeita(n, ant);
    const {gz, dados} = await bkComprimir(str);
    const r = {id:new Date().toISOString(), motivo, n, total:bkTotal(n), tam:str.length, gz, dados, suspeita, updated:'', aparelho:navigator.userAgent.includes('Mobile') ? 'celular' : 'computador'};
    try{ r.updated = (str.match(/"updated":"([^"]+)"/) || [])[1] || ''; }catch(e){}
    await bkTx('readwrite', st => st.put(r));
    BK.ult = r; localStorage.setItem('escritorio_bk_ult', JSON.stringify({id:r.id, updated:r.updated, total:r.total}));
    if(suspeita){ BK.alerta = {id:r.id, txt:suspeita}; if(typeof renderBanner === 'function') renderBanner(); }
    bkPodar().catch(() => {});
    return r;
  }catch(e){ console.warn('backup', e); return null; }
}
// cópia agora (se mudou desde a última ou se forçado)
async function bkAgora(motivo = 'automático', forcar = false){
  if(BK.rodando || ARM.carregando) return null; const u = bkUltLocal();
  if(!forcar && u && u.updated === (db.meta.updated || '')) return null;
  if(!COL.some(c => db[c].length) && !forcar) return null;
  BK.rodando = true; try{ return await bkDoTexto(JSON.stringify(db), motivo); } finally{ BK.rodando = false; }
}
const bkUltLocal = () => { try{ return BK.ult || JSON.parse(localStorage.getItem('escritorio_bk_ult')); }catch(e){ return null; } };

// retenção
async function bkPodar(){
  const ls = await bkListar(), agora = Date.now(), manter = new Set(), vistos = new Set();
  ls.filter(x => !x.suspeita).slice(0, 5).forEach(x => manter.add(x.id));       // as 5 confiáveis mais recentes, sempre
  ls.forEach(x => { const t = Date.parse(x.id), idade = (agora - t) / 3600e3, d = x.id.slice(0, 10);
    let chave = null;
    if(idade <= 24) chave = 'all:' + x.id; else if(idade <= 24 * 7) chave = 'h:' + x.id.slice(0, 13); else if(idade <= 24 * 90) chave = 'd:' + d;
    else if(idade <= 24 * 366){ const dt = new Date(t); chave = 'w:' + dt.getFullYear() + '-' + Math.floor((dt - new Date(dt.getFullYear(), 0, 1)) / (7 * 864e5)); }
    if(/^antes /.test(x.motivo) && idade <= 24 * 30) chave = 'all:' + x.id;     // cópias “antes de…” ficam 30 dias
    if(chave && !vistos.has(chave)){ vistos.add(chave); manter.add(x.id); } });
  const apagar = ls.filter(x => !manter.has(x.id)).map(x => x.id);
  if(apagar.length) await bkTx('readwrite', st => { apagar.forEach(id => st.delete(id)); });
}

/* ----- nuvem (Dropbox): 1 por hora, pasta /backups ----- */
const BK_PASTA = '/backups';
async function bkNuvem(forcar){
  if(!bkCfg().nuvem || typeof driveAtivo !== 'function' || !driveAtivo() || !temSessao() || !navigator.onLine) return;
  const ult = Number(localStorage.getItem('escritorio_bk_nuvem') || 0); if(!forcar && Date.now() - ult < 3600e3) return;
  const u = bkUltLocal(), enviado = localStorage.getItem('escritorio_bk_nuvem_upd'); if(!forcar && enviado && u && enviado === u.updated) return;
  try{
    const r = await bkAgora('automático', true) || BK.ult; if(!r) return;
    const reg = await bkTx('readonly', st => st.get(r.id)); if(!reg) return;
    const corpo = reg.gz ? reg.dados : new Blob([reg.dados]), nome = `${BK_PASTA}/backup-${reg.id.slice(0, 16).replace(/[:T]/g, '-')}-${reg.aparelho}.json${reg.gz ? '.gz' : ''}`;
    await dbx('https://content.dropboxapi.com/2/files/upload', {arg:{path:nome, mode:{'.tag':'add'}, autorename:true, mute:true}, body:corpo});
    localStorage.setItem('escritorio_bk_nuvem', String(Date.now())); localStorage.setItem('escritorio_bk_nuvem_upd', reg.updated || ''); BK.nuvemUlt = new Date();
    bkNuvemPodar().catch(() => {});
  }catch(e){ console.warn('backup na nuvem', e); BK.nuvemErro = e.message; }
}
async function bkNuvemListar(){
  let out = [], j = await (await dbx('https://api.dropboxapi.com/2/files/list_folder', {json:{path:BK_PASTA, limit:2000}})).json(); out.push(...j.entries);
  while(j.has_more){ j = await (await dbx('https://api.dropboxapi.com/2/files/list_folder/continue', {json:{cursor:j.cursor}})).json(); out.push(...j.entries); }
  return out.filter(e => e['.tag'] === 'file' && /^backup-/.test(e.name)).sort((a, b) => b.name.localeCompare(a.name));
}
async function bkNuvemPodar(){
  const dia = localStorage.getItem('escritorio_bk_nuvem_poda'); if(dia === today()) return; localStorage.setItem('escritorio_bk_nuvem_poda', today());
  const ls = await bkNuvemListar(), agora = Date.now(), vistos = new Set(), apagar = [];
  ls.forEach((e, i) => { const m = e.name.match(/backup-(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})/); if(!m) return;
    const t = Date.parse(`${m[1]}T${m[2]}:${m[3]}:00Z`), idade = (agora - t) / 3600e3; let chave;
    if(i < 10 || idade <= 48) return; if(idade <= 24 * 90) chave = 'd:' + m[1]; else if(idade <= 24 * 366) chave = 'w:' + Math.floor(t / (7 * 864e5)); else chave = null;
    if(chave && !vistos.has(chave)) vistos.add(chave); else apagar.push({path:e.path_lower}); });
  for(let i = 0; i < apagar.length; i += 900) await dbx('https://api.dropboxapi.com/2/files/delete_batch', {json:{entries:apagar.slice(i, i + 900)}});
}

/* ----- agenda: verifica a cada minuto ----- */
function bkTick(){ if(ARM.carregando) return; const u = bkUltLocal(), mins = Number(bkCfg().intervalo) || 10;
  if(!u || Date.now() - Date.parse(u.id) >= mins * 60e3) bkAgora('automático').then(() => bkNuvem()).catch(() => {}); else bkNuvem().catch(() => {}); }
setInterval(bkTick, 60e3); setTimeout(bkTick, 20e3);
document.addEventListener('visibilitychange', () => { if(document.visibilityState !== 'hidden') return; const u = bkUltLocal();
  if(!u || Date.now() - Date.parse(u.id) >= 2 * 60e3) bkAgora('ao sair').catch(() => {}); });

/* ----- restaurar ----- */
async function bkRestaurar(id, origem = 'aparelho', nomeNuvem){
  let txt;
  try{
    if(origem === 'nuvem'){ const r = await dbx('https://content.dropboxapi.com/2/files/download', {arg:{path:nomeNuvem}}); const bl = await r.blob();
      txt = /\.gz$/.test(nomeNuvem) ? await new Response(bl.stream().pipeThrough(new DecompressionStream('gzip'))).text() : await bl.text(); }
    else { const r = await bkTx('readonly', st => st.get(id)); if(!r) return toast('Cópia não encontrada'); txt = await bkTexto(r); }
  }catch(e){ return alert('Não foi possível ler esta cópia: ' + e.message); }
  let d; try{ d = JSON.parse(txt); }catch(e){ return alert('Cópia ilegível.'); }
  if(!validDb(d)) return alert('Esta cópia não parece ser dos dados deste programa.');
  const nA = bkContar(db), nB = bkContar(d), linhas = COL.filter(c => nA[c] || nB[c]).map(c => `${NOMES_COL[c] || c}: hoje ${nA[c]} → ficará ${nB[c]}`).join('\n');
  if(!confirm(`Restaurar a cópia de ${new Date(id || Date.now()).toLocaleString('pt-BR')}?\n\n${linhas}\n\nAntes, o estado atual é guardado como cópia “antes de restaurar” (dá para voltar).`)) return;
  const antes = await bkDoTexto(JSON.stringify(db), 'antes de restaurar');
  db = norm(d); db.meta.updated = new Date().toISOString(); DBV++; salvarAgora(); closeModal(); render();
  if(typeof driveAtivo === 'function' && driveAtivo()) setTimeout(() => driveSync('restauração'), 500);
  toastDesfazer('🛟 Cópia restaurada', () => antes && bkRestaurarDireto(antes.id));
}
async function bkRestaurarDireto(id){ const r = await bkTx('readonly', st => st.get(id)); if(!r) return; db = norm(JSON.parse(await bkTexto(r))); db.meta.updated = new Date().toISOString(); DBV++; salvarAgora(); render(); toast('Voltou ao estado anterior'); }

/* ----- telas ----- */
const bkQuando = id => { const d = new Date(id), h = d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}), dd = isoDate(d);
  return dd === today() ? 'hoje, ' + h : dd === addDays(today(), -1) ? 'ontem, ' + h : d.toLocaleDateString('pt-BR') + ' ' + h; };
const bkResumoN = n => [['processos', 'proc.'], ['pessoas', 'pessoas'], ['prazos', 'compr.'], ['andamentos', 'and.'], ['financeiro', 'lanç.']].filter(([c]) => n[c]).map(([c, t]) => `${n[c]} ${t}`).join(' · ');
function bkCardHtml(){
  const c = bkCfg(), u = bkUltLocal(), nv = Number(localStorage.getItem('escritorio_bk_nuvem') || 0), dbxOn = typeof driveAtivo === 'function' && driveAtivo();
  return `<div class="card" style="border:2px solid var(--ok)"><h2>🛟 Backups automáticos <span class="tag ok">ligado</span></h2>
    <p class="small" style="margin-top:0">Uma cópia completa de tudo é feita sozinha a cada <b>${c.intervalo} minutos</b> (quando há alteração), e também <b>antes</b> de qualquer exclusão em massa, restauração ou sincronização que remova registros. ${dbxOn && c.nuvem ? 'Uma cópia por hora vai para a pasta <b>backups</b> do app no seu Dropbox.' : 'As cópias ficam neste aparelho' + (dbxOn ? '' : ' — conecte o Dropbox para ter cópias também na nuvem') + '.'}</p>
    <div class="info" style="margin-bottom:10px">${info('Última cópia neste aparelho', u ? bkQuando(u.id) : 'ainda nenhuma')}${dbxOn ? info('Última cópia na nuvem', nv ? bkQuando(new Date(nv).toISOString()) : '—') : ''}</div>
    <div class="row" style="gap:10px;flex-wrap:wrap;align-items:end"><label class="small">Fazer cópia a cada<select id="bkInt">${[5, 10, 15, 30, 60].map(m => `<option value="${m}" ${+c.intervalo === m ? 'selected' : ''}>${m} minutos</option>`).join('')}</select></label>
      ${dbxOn ? `<label class="chk small"><input type="checkbox" id="bkNuvem" ${c.nuvem ? 'checked' : ''}> cópias na nuvem (Dropbox)</label>` : ''}</div>
    <div class="toolbar" style="margin-top:10px"><button class="btn primary" data-act="bkVer">🛟 Ver e restaurar cópias</button><button class="btn" data-act="bkFazer">Fazer uma cópia agora</button></div></div>`;
}
document.addEventListener('change', e => { if(e.target.id === 'bkInt'){ db.meta.backup = {...bkCfg(), intervalo:+e.target.value}; save(); toast('Intervalo dos backups alterado'); }
  if(e.target.id === 'bkNuvem'){ db.meta.backup = {...bkCfg(), nuvem:e.target.checked}; save(); } });
async function bkTela(){
  let ls = []; try{ ls = await bkListar(); }catch(e){}
  const dias = new Map(); ls.forEach(x => { const d = isoDate(new Date(x.id)); (dias.get(d) || dias.set(d, []).get(d)).push(x); });
  const linha = x => `<div class="li"><div class="grow"><b>${bkQuando(x.id)}</b> <span class="tag grey">${esc(x.motivo)}</span>${x.suspeita ? ` <span class="tag bad" title="${esc(x.suspeita)}">⚠️ suspeita</span>` : ''}
      <div class="sub">${bkResumoN(x.n)} · ${(x.tam / 1e6).toFixed(1)} MB${x.suspeita ? ' · ' + esc(x.suspeita) : ''}</div></div><button type="button" class="btn" data-bkres="${x.id}">Restaurar</button></div>`;
  openForm({title:'🛟 Cópias de segurança', soFechar:true, fields:[{type:'html', html:`<p class="small muted" style="margin-top:0">Escolha uma cópia para voltar os dados àquele momento. O estado atual é guardado antes, e dá para desfazer.</p>
    <h3 style="margin:6px 0">📱 Neste aparelho <span class="tag grey">${ls.length}</span></h3>
    ${[...dias].map(([d, xs], i) => `<details class="fgrupo" ${i < 2 ? 'open' : ''}><summary>${d === today() ? 'Hoje' : d === addDays(today(), -1) ? 'Ontem' : fmtD(d)} <span class="tag grey">${xs.length}</span></summary>${xs.map(linha).join('')}</details>`).join('') || '<div class="empty">Nenhuma cópia ainda — a primeira é feita alguns segundos após abrir o programa.</div>'}
    ${typeof driveAtivo === 'function' && driveAtivo() ? `<h3 style="margin:14px 0 6px">☁️ No Dropbox</h3><div id="bkNv"><button type="button" class="btn" id="bkNvBtn">Carregar a lista da nuvem</button></div>` : ''}
    <p class="small muted">Também é possível restaurar um arquivo baixado: Configurações › Backup manual › “Restaurar a partir de um backup”.</p>`}],
    after:f => { f.querySelectorAll('[data-bkres]').forEach(b => b.onclick = () => bkRestaurar(b.dataset.bkres));
      f.querySelector('#bkNvBtn')?.addEventListener('click', async () => { const el = f.querySelector('#bkNv'); el.innerHTML = '<div class="small muted">Carregando…</div>';
        try{ const ns = await bkNuvemListar(); el.innerHTML = ns.slice(0, 120).map(e => `<div class="li"><div class="grow"><b>${esc(e.name.replace(/^backup-|\.json(\.gz)?$/g, ''))}</b><div class="sub">${(e.size / 1e6).toFixed(2)} MB</div></div><button type="button" class="btn" data-bknv="${esc(e.path_lower)}">Restaurar</button></div>`).join('') || '<div class="empty">Nenhuma cópia na nuvem ainda.</div>';
          el.querySelectorAll('[data-bknv]').forEach(b => b.onclick = () => { const m = b.dataset.bknv.match(/backup-(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})/); bkRestaurar(m ? `${m[1]}T${m[2]}:${m[3]}:00Z` : '', 'nuvem', b.dataset.bknv); }); }
        catch(e){ el.innerHTML = `<div class="small" style="color:var(--bad)">Não foi possível listar: ${esc(e.message)}</div>`; } }); }});
}
Object.assign(A, {
  bkVer: () => bkTela(),
  bkFazer: async () => { const r = await bkAgora('manual', true); toast(r ? '🛟 Cópia feita' : 'Não foi possível fazer a cópia'); render(); },
  bkAlertaVer: () => { BK.alerta = null; renderBanner(); bkTela(); },
  bkAlertaOk: () => { BK.alerta = null; renderBanner(); },
});
