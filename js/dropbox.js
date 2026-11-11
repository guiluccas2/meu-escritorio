// Meu Escritório — Sincronização com o Dropbox (OAuth com PKCE, junção em 3 vias campo a campo) e instalação como app
'use strict';
/* ================= DROPBOX (sincronização entre aparelhos) ================= */
const DROPBOX_APP_KEY_PADRAO = '7mn7t0ltbk15ce1';   // preenchido na publicação (ou informado em Backup e dados)
const ARQ_NOME = 'escritorio-dados.json', ARQ_PATH = '/escritorio-dados.json';
const drive = {status:'off', ultimo:null, busy:false, again:0, erro:'', edits:0, timer:null};
function driveCfg(){ try{ return JSON.parse(localStorage.getItem('escritorio_sync_cfg')) || {}; }catch(e){ return {}; } }
const setDriveCfg = o => localStorage.setItem('escritorio_sync_cfg', JSON.stringify({...driveCfg(), ...o}));
const appKey = () => (driveCfg().appKey || DROPBOX_APP_KEY_PADRAO || '').trim();
function driveAtivo(){ return !!driveCfg().ativo && !!appKey() && location.protocol !== 'file:'; }
const temSessao = () => !!driveCfg().refresh;
const isDirty = () => localStorage.getItem('escritorio_sync_dirty') === '1';
const setDirty = v => v ? localStorage.setItem('escritorio_sync_dirty', '1') : localStorage.removeItem('escritorio_sync_dirty');
function statusTxt(){ return ({off:'desligada', sync:'sincronizando…', ok:'sincronizado', auth:'aguardando conexão com o Dropbox', 'pendente-auth':'alterações aguardando conexão com o Dropbox', offline:'sem internet — será sincronizado depois', erro:'erro: ' + drive.erro})[drive.status] || drive.status; }
function setStatus(st){
  drive.status = st; const pend = isDirty();
  // topo: só aparece quando você precisa agir (conectar, erro ou alterações presas sem internet)
  const c = document.getElementById('syncChip');
  if(c){ const alerta = {auth:['🔑', 'Conectar'], 'pendente-auth':['🔑', 'Conectar'], erro:['⚠️', 'Erro no Dropbox'], offline: pend ? ['📴', 'Sem internet · pendente'] : null}[st];
    c.hidden = !driveAtivo() || !alerta;
    if(alerta){ c.innerHTML = `${alerta[0]} <span class="lbl">${alerta[1]}</span>`; c.className = 'btn sBad'; c.title = 'Dropbox: ' + statusTxt(); } }
  // barra lateral: verificações em segundo plano não mudam o indicador; só o envio de alterações
  const sd = document.getElementById('syncSide');
  if(sd && !(st === 'sync' && !pend)){
    const m = !driveAtivo() ? ['off', 'Dropbox desligado'] : {ok:['ok', 'Salvo no Dropbox'], sync:['salvando', 'Salvando…'], auth:['erro', 'Conectar ao Dropbox'], 'pendente-auth':['erro', 'Conectar ao Dropbox'],
      offline:[pend ? 'erro' : 'off', pend ? 'Sem internet — salvo neste aparelho' : 'Sem internet'], erro:['erro', 'Erro ao sincronizar'], off:['off', 'Dropbox desligado']}[st] || ['off', 'Dropbox'];
    sd.className = 's-' + m[0]; sd.querySelector('span').textContent = m[1];
    sd.title = 'Dropbox: ' + statusTxt() + (drive.ultimo ? ' — última sincronização ' + drive.ultimo.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '') + ' (clique para sincronizar agora)'; }
  renderBanner();
}
function driveMarcar(){
  if(!driveAtivo()) return;
  setDirty(true); drive.edits++;
  clearTimeout(drive.timer); drive.timer = setTimeout(() => driveSync('alteração'), 1500);
  if(!temSessao()) setStatus('pendente-auth');
}
// ---- login (OAuth com PKCE: conecta uma vez por aparelho) ----
const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function authUrl(comRetorno){
  const v = b64url(crypto.getRandomValues(new Uint8Array(48))), c = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  const st = b64url(crypto.getRandomValues(new Uint8Array(12)));
  localStorage.setItem('dbx_pkce', JSON.stringify({v, st, r: comRetorno ? redirectUri() : '', h: location.hash}));
  const q = new URLSearchParams({client_id:appKey(), response_type:'code', code_challenge:c, code_challenge_method:'S256', token_access_type:'offline'});
  if(comRetorno){ q.set('redirect_uri', redirectUri()); q.set('state', st); }
  return 'https://www.dropbox.com/oauth2/authorize?' + q;
}
const offErr = () => Object.assign(new Error('sem conexão com a internet'), {code:'offline'});
async function trocarCodigo(code){
  const pk = JSON.parse(localStorage.getItem('dbx_pkce') || '{}'); if(!pk.v) throw new Error('o pedido de conexão expirou — tente conectar de novo');
  const body = new URLSearchParams({code, grant_type:'authorization_code', client_id:appKey(), code_verifier:pk.v}); if(pk.r) body.set('redirect_uri', pk.r);
  let r; try{ r = await fetch('https://api.dropboxapi.com/oauth2/token', {method:'POST', body}); }catch(e){ throw offErr(); }
  const j = await r.json().catch(() => ({}));
  if(!r.ok || !j.access_token) throw new Error('o Dropbox recusou a autorização' + (j.error_description ? ': ' + j.error_description : ''));
  localStorage.removeItem('dbx_pkce');
  setDriveCfg({ativo:true, refresh:j.refresh_token, at:j.access_token, exp:Date.now() + ((Number(j.expires_in) || 14400) - 120) * 1000});
  return pk;
}
async function tokenDbx(){
  const c = driveCfg(); if(c.at && Date.now() < c.exp) return c.at;
  if(!c.refresh) throw Object.assign(new Error('não conectado ao Dropbox'), {code:'auth'});
  let r; try{ r = await fetch('https://api.dropboxapi.com/oauth2/token', {method:'POST', body:new URLSearchParams({grant_type:'refresh_token', refresh_token:c.refresh, client_id:appKey()})}); }catch(e){ throw offErr(); }
  const j = await r.json().catch(() => ({}));
  if(!r.ok || !j.access_token){
    if(r.status === 400 || r.status === 401){ setDriveCfg({refresh:'', at:''}); throw Object.assign(new Error('a conexão com o Dropbox foi encerrada — conecte de novo'), {code:'auth'}); }
    throw new Error('falha ao renovar o acesso ao Dropbox (' + r.status + ')');
  }
  setDriveCfg({at:j.access_token, exp:Date.now() + ((Number(j.expires_in) || 14400) - 120) * 1000}); return j.access_token;
}
async function dbx(url, {arg, body, json} = {}, tentativa = 0){
  const h = {Authorization:'Bearer ' + await tokenDbx()};
  if(arg) h['Dropbox-API-Arg'] = JSON.stringify(arg);
  if(json !== undefined){ h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  else if(body !== undefined) h['Content-Type'] = 'application/octet-stream';
  let r; try{ r = await fetch(url, {method:'POST', headers:h, body}); }catch(e){ throw offErr(); }
  if(r.status === 401 && !tentativa){ setDriveCfg({at:''}); return dbx(url, {arg, body: json !== undefined ? undefined : body, json}, 1); }
  if(r.status === 401){ setDriveCfg({at:'', refresh:''}); throw Object.assign(new Error('a conexão com o Dropbox foi encerrada — conecte de novo'), {code:'auth'}); }
  if(r.status === 409){ const j = await r.json().catch(() => ({})); throw Object.assign(new Error(j.error_summary || 'conflito no Dropbox'), {code:'409', summary:j.error_summary || ''}); }
  if(!r.ok){ const t = await r.text().catch(() => ''); throw Object.assign(new Error(`o Dropbox respondeu ${r.status}${t ? ': ' + t.slice(0, 140) : ''}`), {code:'http', status:r.status}); }
  return r;
}
async function remoteMeta(){
  try{ return await (await dbx('https://api.dropboxapi.com/2/files/get_metadata', {json:{path:ARQ_PATH}})).json(); }
  catch(e){ if(e.code === '409' && /not_found/.test(e.summary)) return null; throw e; }
}
const remoteDownload = async () => JSON.parse(await (await dbx('https://content.dropboxapi.com/2/files/download', {arg:{path:ARQ_PATH}})).text());
async function remoteUpload(data, rev){
  try{ return await (await dbx('https://content.dropboxapi.com/2/files/upload', {arg:{path:ARQ_PATH, mode: rev ? {'.tag':'update', update:rev} : {'.tag':'add'}, autorename:false, mute:true}, body:JSON.stringify(data)})).json(); }
  catch(e){ if(e.code === '409' && /conflict/.test(e.summary)) throw Object.assign(new Error('o arquivo foi alterado por outro aparelho'), {code:'conflito'}); throw e; }
}
// mescla em 3 vias: base = última versão sincronizada neste aparelho
// junta um registro alterado em dois aparelhos: cada campo fica com a versão que mudou; conflito só se o MESMO campo mudou nos dois
function mergeCampos(b, l, r){
  const v = {}, eq = (x, y) => JSON.stringify(x) === JSON.stringify(y); let conflito = false;
  new Set([...Object.keys(l), ...Object.keys(r)]).forEach(k => {
    if(eq(l[k], r[k])) v[k] = l[k]; else if(eq(l[k], b[k])) v[k] = r[k]; else if(eq(r[k], b[k])) v[k] = l[k]; else { v[k] = l[k]; conflito = true; } });
  Object.keys(v).forEach(k => { if(v[k] === undefined) delete v[k]; });
  return {v, conflito};
}
function merge3(base, local, remote){
  base = base || {}; let conflitos = 0;
  const bm = base.meta || {}, lm = local.meta || {}, rm = remote.meta || {}, meta = {};
  new Set([...Object.keys(lm), ...Object.keys(rm)]).forEach(k => { meta[k] = JSON.stringify(lm[k]) === JSON.stringify(bm[k]) ? rm[k] : lm[k]; });
  const out = {meta};
  COL.forEach(c => {
    const B = new Map((base[c] || []).map(x => [x.id, x])), L = new Map((local[c] || []).map(x => [x.id, x])), R = new Map((remote[c] || []).map(x => [x.id, x]));
    const ordem = [...L.keys(), ...[...R.keys()].filter(i => !L.has(i))], res = [];
    ordem.forEach(id => {
      const b = B.get(id), l = L.get(id), r = R.get(id), sb = b && JSON.stringify(b), sl = l && JSON.stringify(l), sr = r && JSON.stringify(r);
      let v = null;
      if(l && r){ if(sl === sr || sr === sb) v = l; else if(sl === sb) v = r;
        else if(b){ const m = mergeCampos(b, l, r); v = m.v; if(m.conflito) conflitos++; }   // alterado nos dois: junta campo a campo
        else { v = l; conflitos++; } }
      else if(l){ if(!b) v = l; else if(sl !== sb){ v = l; conflitos++; } }          // apagado no outro aparelho
      else if(r){ if(!b) v = r; else if(sr !== sb){ v = r; conflitos++; } }          // apagado neste aparelho
      if(v) res.push(v);
    });
    out[c] = res;
  });
  return {data:norm(out), conflitos};
}
function escolherPrimeiraSync(remote){
  return new Promise(res => {
    const cnt = d => `${d.pessoas.length} pessoas, ${d.processos.length} processos, ${d.conversas.length} conversas, ${d.financeiro.length} lançamentos`;
    let feito = false;
    openForm({ title:'Já existem dados no Dropbox', data:{op:'drive'},
      fields:[{type:'html', html:`<p>Este aparelho tem dados próprios e o Dropbox também.</p><ul class="small"><li><b>No Dropbox:</b> ${cnt(remote)}</li><li><b>Neste aparelho:</b> ${cnt(db)}</li></ul>`},
        {k:'op', label:'O que fazer?', type:'select', empty:false, full:true, options:[{v:'drive', t:'Usar os dados do Dropbox neste aparelho (recomendado)'}, {v:'juntar', t:'Juntar os dados dos dois'}, {v:'local', t:'Substituir o Dropbox pelos dados deste aparelho'}]}],
      onSave: out => { if(out.op === 'local' && !confirm('Os dados do Dropbox serão substituídos pelos deste aparelho. Continuar?')) return false; feito = true; res(out.op); } });
    const w = setInterval(() => { if(modal.classList.contains('hidden')){ clearInterval(w); if(!feito) res('cancelar'); } }, 300);
  });
}
async function driveSync(motivo){
  if(!driveAtivo()) return;
  if(drive.busy){ drive.again = drive.again || 1; return; }
  if(!temSessao()){ setStatus(isDirty() ? 'pendente-auth' : 'auth'); return; }
  drive.busy = true; setStatus('sync');
  let repetir = false;
  try{
    const cfg = driveCfg(), meta = await remoteMeta(), n0 = drive.edits;
    if(!meta){
      const snap = JSON.parse(JSON.stringify(db)), r = await remoteUpload(snap, null);
      setDriveCfg({rev:r.rev}); await idbSet('base', snap);
      if(drive.edits === n0) setDirty(false);
    } else if(meta.rev === cfg.rev){
      if(isDirty()){
        const snap = JSON.parse(JSON.stringify(db)), r = await remoteUpload(snap, meta.rev);
        setDriveCfg({rev:r.rev}); await idbSet('base', snap);
        if(drive.edits === n0) setDirty(false);
      }
    } else {
      const remote = norm(await remoteDownload()), base = cfg.rev ? await idbGet('base') : null;
      let novo, conflitos = 0;
      if(base && !isDirty()) novo = remote;
      else if(base){ const m = merge3(base, db, remote); novo = m.data; conflitos = m.conflitos; }
      else {
        const temL = COL.some(c => db[c].length), temR = COL.some(c => remote[c].length);
        if(!temL || !temR) novo = temL ? db : remote;
        else { const op = await escolherPrimeiraSync(remote);
          if(op === 'cancelar') throw Object.assign(new Error('sincronização cancelada — escolha o que fazer para continuar'), {code:'cancel'});
          if(op === 'drive') novo = remote; else if(op === 'local') novo = db; else { const m = merge3({}, db, remote); novo = m.data; conflitos = m.conflitos; } }
      }
      const sNovo = JSON.stringify(novo), mudouLocal = sNovo !== JSON.stringify(db);
      let rev = meta.rev;
      if(sNovo !== JSON.stringify(remote)) rev = (await remoteUpload(JSON.parse(sNovo), meta.rev)).rev;
      setDriveCfg({rev}); await idbSet('base', JSON.parse(sNovo));
      if(mudouLocal){ db = norm(JSON.parse(sNovo)); localStorage.setItem(KEY, sNovo); updateCounts(); renderSeguro(); toast('🔄 Dados atualizados com o Dropbox'); }
      if(drive.edits === n0) setDirty(false);
      if(conflitos) setTimeout(() => alert(`Atenção: em ${conflitos} registro(s), o mesmo campo foi alterado neste e em outro aparelho ao mesmo tempo. Nesses campos foi mantida a versão deste aparelho (os demais campos foram juntados) — confira se está tudo certo.`), 200);
    }
    drive.ultimo = new Date(); drive.erro = ''; drive.again = 0; setStatus('ok');
  }catch(e){
    if(e.code === 'conflito' && drive.again < 3){ repetir = true; drive.again++; }
    else { drive.erro = e.message; drive.again = 0;
      setStatus(e.code === 'auth' ? (isDirty() ? 'pendente-auth' : 'auth') : e.code === 'offline' ? 'offline' : 'erro'); }
  }finally{
    drive.busy = false;
    if(repetir || (drive.again && drive.status !== 'erro')){ const n = drive.again; setTimeout(() => driveSync('repetir'), 300); if(!repetir) drive.again = 0; }
  }
}
async function dbxRetorno(){
  const u = new URL(location.href), code = u.searchParams.get('code'), st = u.searchParams.get('state'), err = u.searchParams.get('error');
  if(!code && !err) return false;
  const pk = JSON.parse(localStorage.getItem('dbx_pkce') || '{}');
  history.replaceState(null, '', location.pathname + (pk.h || ''));
  if(err){ drive.erro = 'a autorização foi negada no Dropbox'; setStatus('erro'); return true; }
  if(!pk.st || pk.st !== st){ drive.erro = 'retorno do Dropbox não reconhecido — tente conectar de novo'; setStatus('erro'); return true; }
  try{ await trocarCodigo(code); render(); toast('☁️ Conectado ao Dropbox'); await driveSync('login'); }
  catch(e){ drive.erro = e.message; setStatus(e.code === 'offline' ? 'offline' : 'erro'); }
  return true;
}
async function driveConectar(){
  if(!appKey()){ go('#/config'); return toast('Informe a chave do app (App key) do Dropbox'); }
  setDriveCfg({ativo:true}); location.href = await authUrl(true);
}
function formCodigoDbx(){
  authUrl(false).then(url => openForm({ title:'Conectar ao Dropbox com código',
    fields:[{type:'html', html:`<ol class="small" style="padding-left:18px;margin:0"><li><a href="${url}" target="_blank" rel="noopener"><b>Toque aqui para abrir o Dropbox</b></a> e clique em <b>Permitir</b>.</li><li>O Dropbox mostra um <b>código</b>. Copie-o.</li><li>Volte aqui, cole o código abaixo e salve.</li></ol>`},
      {k:'code', label:'Código mostrado pelo Dropbox', req:true, full:true}],
    onSave: out => { trocarCodigo(out.code.trim()).then(() => { setDriveCfg({ativo:true}); toast('☁️ Conectado ao Dropbox'); render(); return driveSync('login'); }).catch(e => alert('Não foi possível conectar: ' + e.message)); } }));
}
A.driveLogin = () => driveConectar();
A.driveOnPadrao = () => { setDriveCfg({appKey:DROPBOX_APP_KEY_PADRAO}); driveConectar(); };
A.driveAgoraNao = () => { setDriveCfg({recusado:true}); renderBanner(); toast('Você pode conectar depois em Backup e dados'); };
A.dbxCodigo = () => { if(!appKey()) return toast('Informe a chave do app (App key) do Dropbox'); setDriveCfg({ativo:true}); formCodigoDbx(); };
A.driveSyncNow = () => driveSync('manual').then(() => { if(location.hash.startsWith('#/config')) renderSeguro(); });
A.syncSide = () => { if(!driveAtivo()) return go('#/config'); A.syncChip(); };
A.syncChip = () => { if(!temSessao()) driveConectar(); else if(drive.status === 'erro'){ alert('Problema na sincronização: ' + drive.erro); driveSync('manual'); } else driveSync('manual'); };
A.driveOn = () => { const k = (document.getElementById('cfgAppKey')?.value || '').trim();
  if(!/^[a-z0-9]{8,30}$/i.test(k)) return alert('Informe a chave do app (App key) — uma sequência de letras e números copiada do Dropbox. Veja o guia.');
  setDriveCfg({appKey:k}); driveConectar(); };
A.driveOnCodigo = () => { const k = (document.getElementById('cfgAppKey')?.value || '').trim();
  if(!/^[a-z0-9]{8,30}$/i.test(k)) return alert('Informe a chave do app (App key) primeiro.');
  setDriveCfg({appKey:k, ativo:true}); formCodigoDbx(); };
A.driveOff = async () => { if(!confirm('Desligar a sincronização neste aparelho?\n\nOs dados continuam neste aparelho e no Dropbox; apenas param de ser sincronizados aqui.')) return;
  try{ const t = driveCfg().at; if(t) await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {method:'POST', headers:{Authorization:'Bearer ' + t}}); }catch(e){}
  setDriveCfg({ativo:false, refresh:'', at:'', rev:''}); setStatus('off'); render(); };
// instalar como app
let instalarEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalarEvt = e; if(location.hash.startsWith('#/config')) renderSeguro(); });
A.instalar = async () => { if(!instalarEvt) return; instalarEvt.prompt(); try{ await instalarEvt.userChoice; }catch(e){} instalarEvt = null; render(); };
// gatilhos de sincronização
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && driveAtivo() && temSessao()) driveSync('foco'); });
window.addEventListener('online', () => { if(driveAtivo() && temSessao()) driveSync('online'); });
setInterval(() => { if(document.visibilityState === 'visible' && driveAtivo() && temSessao() && !drive.busy) driveSync('verificação'); }, 30000);
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
document.getElementById('versaoTxt').textContent = 'versão ' + VERSAO;
// procura versão nova ao abrir e ao voltar para o app (no iPhone o app instalado não recarrega sozinho)
let avisouVersao = false;
async function verificarVersao(){
  if(avisouVersao || !/^https?:$/.test(location.protocol) || !navigator.onLine) return;
  try{ const t = await (await fetch(location.pathname + '?nv=' + Date.now(), {cache:'no-store'})).text(); const m = t.match(/const VERSAO = '([^']+)'/);
    if(m && m[1] !== VERSAO){ avisouVersao = true; navigator.serviceWorker?.getRegistration().then(r => r && r.update()).catch(() => {});
      const b = document.createElement('div'); b.id = 'novaVersao'; b.innerHTML = '🔄 Há uma versão nova do sistema. <button class="btn primary" data-act="atualizarApp">Atualizar agora</button>'; document.body.appendChild(b); } }catch(e){}
}
A.atualizarApp = () => { if(isDirty && typeof driveAtivo === 'function' && driveAtivo() && isDirty() && temSessao()) driveSync('atualização'); setTimeout(() => location.reload(), 600); };
setTimeout(verificarVersao, 3000);
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') setTimeout(verificarVersao, 1500); });


