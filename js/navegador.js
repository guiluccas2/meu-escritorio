// Meu Escritório — Atualizar andamentos pelo navegador (Claude no Chrome, com o certificado do advogado já logado)
'use strict';
/* O sistema monta as instruções (processos, links, desde quando buscar, regras de segurança) para colar no Claude no Chrome.
   O Claude consulta os sites dos tribunais SOMENTE LENDO e cola o resultado na tela #/navegador.
   As movimentações entram na aba ⚖️ Movimentações (origem "Tribunal") e só viram andamento quando o advogado confirma. */
const NAV_LS = 'escritorio_navegador_v1';
function navCfg(){ try{ return JSON.parse(localStorage.getItem(NAV_LS)) || {}; }catch(e){ return {}; } }
function setNavCfg(o){ try{ localStorage.setItem(NAV_LS, JSON.stringify({...navCfg(), ...o})); }catch(e){} }
const navUlt = () => db.meta.navUlt || {};   // dígitos do processo -> data da última consulta pelo navegador
function navTribunal(p){
  const d = digits(p.numero); if(d.length !== 20) return {sigla:'?', sistema:'', link:''};
  const j = d[13], tr = d.slice(14, 16), org = d.slice(16), mask = mascaraCnj(d), [nd, ano] = [mask.slice(0, 10), mask.slice(11, 15)];
  if(j === '8' && tr === '26'){
    const seg = org === '0000';
    const link = seg ? `https://esaj.tjsp.jus.br/cposg/search.do?conversationId=&paginaConsulta=1&cbPesquisa=NUMPROC&tipoNuProcesso=UNIFICADO&numeroDigitoAnoUnificado=${nd}.${ano}&foroNumeroUnificado=${org}&dePesquisaNuUnificado=${mask}&dePesquisa=`
      : `https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${nd}.${ano}&foroNumeroUnificado=${org}&dadosConsulta.valorConsultaNuUnificado=${mask}&dadosConsulta.valorConsulta=&dadosConsulta.tipoNuProcesso=UNIFICADO`;
    return {sigla:'TJSP', sistema:seg ? 'e-SAJ 2º grau' : 'e-SAJ 1º grau', link};
  }
  if(j === '5' && tr !== '00') return {sigla:'TRT' + (+tr), sistema:'PJe-JT', link:`https://pje.trt${+tr}.jus.br/consultaprocessual/detalhe-processo/${mask}`};
  if(j === '4') return {sigla:'TRF' + (+tr), sistema:'PJe', link:+tr === 3 ? (org === '0000' ? 'https://pje2g.trf3.jus.br/pje/ConsultaPublica/listView.seam' : 'https://pje1g.trf3.jus.br/pje/ConsultaPublica/listView.seam') : ''};
  const uf = (typeof TJ_UF_APP !== 'undefined' && TJ_UF_APP[+tr]) || '';
  return {sigla:j === '8' ? 'TJ' + uf.toUpperCase() : 'Tribunal', sistema:'', link:''};
}
const TJ_UF_APP = ['', 'ac', 'al', 'ap', 'am', 'ba', 'ce', 'dft', 'es', 'go', 'ma', 'mt', 'ms', 'mg', 'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'se', 'sp', 'to'];
function navDesde(p){ // última movimentação já registrada (qualquer origem) ou última consulta pelo navegador
  const a = db.andamentos.filter(x => x.processoId === p.id).map(x => x.data).sort().pop() || '';
  const u = navUlt()[digits(p.numero)] || '';
  const d = [a, u].sort().pop();
  return d || addDays(today(), -60);
}
function navCandidatos(){
  return db.processos.filter(p => !INATIVOS.includes(p.status) && digits(p.numero).length === 20)
    .map(p => ({p, t:navTribunal(p), ult:navUlt()[digits(p.numero)] || ''}))
    .sort((a, b) => a.ult.localeCompare(b.ult) || (procCode(a.p) || '').localeCompare(procCode(b.p) || '', 'pt-BR', {numeric:true}));
}
function navSelecionados(){
  const c = navCfg(), tribs = c.tribs || null, max = c.max || 20;
  const l = navCandidatos().filter(x => !tribs || tribs.includes(x.t.sigla));
  return max === 'todos' ? l : l.slice(0, +max);
}
function navInstrucoes(){
  const sel = navSelecionados(), appUrl = location.origin + location.pathname + '#/navegador';
  const linhas = sel.map((x, i) => `${i + 1}) ${mascaraCnj(x.p.numero)} | ${x.t.sigla}${x.t.sistema ? ' – ' + x.t.sistema : ''} | movimentações desde ${fmtD(navDesde(x.p))} | ${x.p.link || x.t.link || 'use a busca por número do processo no sistema do tribunal'}`).join('\n');
  return `TAREFA – ATUALIZAR ANDAMENTOS NOS SITES DOS TRIBUNAIS (SOMENTE LEITURA)
Sou advogado e já estou logado com o meu certificado digital nos sistemas dos tribunais neste Chrome. Escreva em português do Brasil.

REGRAS (obrigatórias)
- Somente leitura. Nunca peticione, nunca protocole, nunca clique em "tomar ciência", "dar ciência", "confirmar recebimento", "abrir intimação/expediente/citação", nem em nada que registre ciência ou altere o processo.
- Não entre nas áreas de Intimações, Expedientes, Citações, Comunicações ou Painel de pendências. Use só a consulta do processo (dados e lista de movimentações).
- Nunca digite senha, PIN ou dados do certificado. Se aparecer login, captcha ou pedido de PIN, pare e me peça para resolver; depois continue.
- Não baixe nem abra documentos (PDF): leia só a lista de movimentações.
- Não altere nada no Meu Escritório além de colar o resultado no campo indicado abaixo.

PROCESSOS (${sel.length}) — número | tribunal/sistema | buscar a partir de | link sugerido
${linhas}
Se o link não abrir o processo, use a busca por número na consulta do próprio sistema.

O QUE ANOTAR
- Todas as movimentações com data IGUAL OU POSTERIOR à indicada para cada processo.
- De cada uma: data (e hora, se houver) e a descrição completa como aparece no site, incluindo o complemento ou o texto resumido do ato.

ENTREGAR O RESULTADO
1. Abra (ou volte para) a aba do Meu Escritório: ${appUrl}
2. No campo "Resultado da consulta", cole uma linha por movimentação, neste formato:
{"numero":"0000000-00.0000.0.00.0000","data":"AAAA-MM-DD","hora":"HH:MM","descricao":"texto da movimentação"}
   Processo sem movimentação nova: {"numero":"...","nada":true}
   Processo com problema (não encontrado, sem acesso, captcha, erro): {"numero":"...","erro":"motivo"}
3. Clique em "Carregar movimentações" e me diga quantas foram carregadas e quais processos tiveram problema.
Para não perder o trabalho, carregue em partes: a cada 10 processos consultados, cole e carregue o que já tiver.`;
}
function navImportar(txt){
  let objs = [];
  const t = String(txt || '').trim(); if(!t) return {erro:'Cole o resultado da consulta no campo.'};
  try{ const j = JSON.parse(t); objs = Array.isArray(j) ? j : [j]; }
  catch(e){ t.split(/\n+/).forEach(l => { const s = l.trim().replace(/,$/, ''); if(!s.startsWith('{')) return; try{ objs.push(JSON.parse(s)); }catch(x){} }); }
  if(!objs.length) return {erro:'Não encontrei linhas no formato esperado ({"numero": …}).'};
  const ex = new Set(db.monitor.map(m => m.id)), r = {novos:0, repetidos:0, semProc:[], problemas:[], consultados:new Set()}, hoje = today();
  const ult = {...navUlt()};
  objs.forEach(o => {
    const pr = procPorNumero(o.numero || ''); const dg = digits(o.numero || '');
    if(!pr){ if(dg) r.semProc.push(o.numero); return; }
    if(o.erro){ r.problemas.push(`${mascaraCnj(dg)}: ${o.erro}`); return; }
    r.consultados.add(dg); ult[dg] = hoje;
    if(o.nada || !o.descricao) return;
    let data = String(o.data || '').trim(); const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if(m) data = `${m[3]}-${m[2]}-${m[1]}`;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data)) { r.problemas.push(`${mascaraCnj(dg)}: data inválida em “${String(o.descricao).slice(0, 40)}”`); return; }
    const desc = String(o.descricao).replace(/\s+/g, ' ').trim(), hora = /^\d{1,2}:\d{2}/.test(o.hora || '') ? String(o.hora).slice(0, 5) : '';
    const chave = norm_s(desc).replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 40);
    const id = 'nav:' + dg + ':' + data + 'T' + hora + ':' + chave;
    const jaAnd = db.andamentos.some(a => a.processoId === pr.id && a.data === data && norm_s(a.descricao || '').replace(/[^a-z0-9]+/g, ' ').trim().startsWith(chave.slice(0, 25)));
    if(ex.has(id) || jaAnd){ r.repetidos++; return; }
    ex.add(id);
    db.monitor.push({id, tipo:'movimento', fonte:'Tribunal', status:'nova', numero:mascaraCnj(dg), data, tribunal:navTribunal(pr).sigla, orgao:'', titulo:desc.slice(0, 3000), texto:hora ? 'às ' + hora : '', link:'', processoId:pr.id, criadoEm:data});
    r.novos++;
  });
  db.meta.navUlt = ult; setNavCfg({ultRodada:Date.now()}); save();
  return r;
}
VIEWS.navegador = () => {
  const c = navCfg(), cand = navCandidatos(), tribs = [...new Set(cand.map(x => x.t.sigla))].sort(), selT = c.tribs || tribs, sel = navSelecionados();
  return `<h1>🌐 Atualizar andamentos pelo navegador<span class="sp"></span><a class="btn" href="#/publicacoes">← Publicações</a></h1>
  <div class="card"><h2>Como funciona</h2>
    <ol class="small" style="margin:0;padding-left:18px;line-height:1.6">
      <li>No <b>Chrome</b> deste computador, entre nos sistemas dos tribunais com o seu <b>certificado</b> (e-SAJ, PJe…).</li>
      <li>Escolha abaixo quais processos consultar e clique em <b>“📋 Copiar instruções”</b>.</li>
      <li>Abra o <b>Claude no Chrome</b> (extensão, no painel lateral) e cole as instruções. Ele consulta cada processo <b>só lendo</b> e cola o resultado no campo “Resultado da consulta” desta tela.</li>
      <li>As movimentações aparecem em <a href="#/publicacoes" data-act="tab" data-g="mon" data-tab="mov">⚖️ Movimentações</a> com a etiqueta <span class="tag ok">Tribunal</span> e só viram andamento quando você confirmar.</li></ol>
    <p class="small muted" style="margin:8px 0 0">O Claude nunca digita senha nem PIN, nunca dá ciência em intimações e não abre documentos. Usa a sua assinatura do Claude, não os créditos da API.</p></div>
  <div class="card"><h2>1. Processos desta rodada</h2>
    <div class="toolbar" style="flex-wrap:wrap">${tribs.map(t => `<label class="small" style="display:flex;gap:5px;align-items:center"><input type="checkbox" class="navTrib" value="${esc(t)}" ${selT.includes(t) ? 'checked' : ''}> ${esc(t)} <span class="muted">(${cand.filter(x => x.t.sigla === t).length})</span></label>`).join('')}
      <label class="small">Quantos: <select id="navMax" style="width:auto">${opts([{v:'10', t:'10'}, {v:'20', t:'20'}, {v:'30', t:'30'}, {v:'50', t:'50'}, {v:'todos', t:'todos'}], String(c.max || 20))}</select></label></div>
    <p class="small muted">Os processos consultados há mais tempo vêm primeiro; a cada rodada o sistema continua de onde parou. Rodadas de 20 a 30 processos costumam caber numa sessão do Claude.</p>
    ${sel.length ? `<div class="tablewrap"><table><thead><tr><th>Processo</th><th>Tribunal</th><th>Buscar desde</th><th>Última consulta pelo navegador</th></tr></thead><tbody>
      ${sel.map(x => `<tr><td><a href="#/processo/${x.p.id}">${esc(procLabel(x.p))}</a></td><td>${esc(x.t.sigla)}${x.t.sistema ? ` <span class="muted small">${esc(x.t.sistema)}</span>` : ''}</td><td>${fmtD(navDesde(x.p))}</td><td>${x.ult ? fmtD(x.ult) : '<span class="muted">nunca</span>'}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">Nenhum processo ativo com número CNJ nos tribunais marcados.</div>'}
    <div class="toolbar" style="margin:10px 0 0"><button class="btn primary" data-act="navCopiar" ${sel.length ? '' : 'disabled'}>📋 Copiar instruções para o Claude (${sel.length})</button>
      <details style="flex-basis:100%"><summary class="small">ver as instruções</summary><pre class="navPre">${esc(navInstrucoes())}</pre></details></div></div>
  <div class="card"><h2>2. Resultado da consulta</h2>
    <p class="small muted" style="margin-top:0">O Claude cola aqui uma linha por movimentação. Você também pode colar à mão.</p>
    <textarea id="navIn" rows="7" placeholder='{"numero":"0011859-48.2026.5.15.0005","data":"2026-11-12","hora":"14:30","descricao":"Juntada de petição"}'></textarea>
    <div class="toolbar" style="margin:8px 0 0"><button class="btn primary" data-act="navCarregar">⬇️ Carregar movimentações</button><span id="navRes" class="small">${c.ultRodada ? 'Última rodada: ' + new Date(c.ultRodada).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : ''}</span></div></div>`;
};
document.addEventListener('change', e => {
  if(e.target.classList?.contains('navTrib')){ setNavCfg({tribs:[...document.querySelectorAll('.navTrib:checked')].map(x => x.value)}); render(); }
  if(e.target.id === 'navMax'){ setNavCfg({max:e.target.value}); render(); }
});
Object.assign(A, {
  navCopiar: () => { const t = navInstrucoes();
    (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => toast('📋 Instruções copiadas — cole no Claude no Chrome')).catch(() => { const d = document.querySelector('.navPre'); d?.closest('details')?.setAttribute('open', ''); toast('Não foi possível copiar sozinho: selecione o texto em “ver as instruções” e copie'); }); },
  navCarregar: () => {
    const r = navImportar(document.getElementById('navIn').value), out = document.getElementById('navRes');
    if(r.erro){ toast(r.erro); if(out) out.textContent = r.erro; return; }
    const msg = `✅ ${r.novos} movimentação(ões) nova(s) · ${r.consultados.size} processo(s) consultado(s)` + (r.repetidos ? ` · ${r.repetidos} já registrada(s)` : '')
      + (r.problemas.length ? ` · ⚠️ problemas: ${r.problemas.join('; ')}` : '') + (r.semProc.length ? ` · não cadastrados: ${r.semProc.join(', ')}` : '');
    toast(`✅ ${r.novos} movimentação(ões) nova(s) carregada(s)`);
    render(); const o = document.getElementById('navRes'); if(o) o.innerHTML = esc(msg) + (r.novos ? ' — <a href="#/publicacoes" data-act="tab" data-g="mon" data-tab="mov">ver em Movimentações ›</a>' : '');
  },
});
