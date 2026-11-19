/* ===== 📰 Mais fontes de publicações + compartilhar =====
   • Recorte Digital da OAB/SP (cobre DJEN, DEJT/TRT e diários estaduais): o robô lê os e-mails do recorte no Gmail (encaminhados do e-mail da OAB)
     e entrega como itens “Recorte OAB · …”; também dá para colar o texto do e-mail em “📥 Importar recorte” (recorteParse — o mesmo do robô).
   • DJEN além da OAB: busca pelo NOME do advogado e pelo NÚMERO de cada processo (ativos e inativos), em rodízio e espaçado (não sobrecarrega o DJEN).
   • A mesma publicação vinda de fontes diferentes aparece uma vez só (pubIncluir: mesmo processo + mesma disponibilização + texto parecido).
   • Problemas nas buscas (site mudou, formato do e-mail mudou, parâmetro recusado, falha persistente): aviso no sistema + e-mail (pelo robô).
   • Cada publicação: PDF / Word / Excel, WhatsApp e e-mail ao cliente (resumo + link). Em lote: “📄 Relatório” sobre a lista da tela. */

/* ----- leitura do e-mail do Recorte Digital ----- */
const brIso = s => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
const hashTxt = s => { let h = 0; for(const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
function recorteTribunal(fonte, num){ const f = norm_s(fonte || '');
  let m = f.match(/regional do trabalho\D*(\d+)/); if(m) return 'TRT' + (+m[1]);
  m = f.match(/regional federal\D*(\d+)/); if(m) return 'TRF' + (+m[1]);
  if(/justica de sao paulo|tjsp/.test(f)) return 'TJSP'; if(/superior do trabalho/.test(f)) return 'TST'; if(/superior tribunal de justica/.test(f)) return 'STJ';
  const t = typeof tribunalDoNumero === 'function' ? tribunalDoNumero(num) : ''; return t ? t.replace('-', '') : ''; }
function recorteParse(txt){
  const t = String(txt || '').replace(/\r/g, '').split('\n').filter(l => !/^\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2}\s+Webmail ::/.test(l) && !/^https:\/\/webmail\./.test(l.trim())).join('\n');
  const blocos = t.split(/PUBLICA[ÇC][ÃA]O\s+\d+\s*\/\s*\d+/i).slice(1);
  return blocos.map(b => { const g = re => ((b.match(re) || [])[1] || '').trim();
    const num = g(/Processo:\s*([\d.\-]{20,25})/i), disp = brIso(g(/Data da Disponibiliza[çc][ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/i)), pub = brIso(g(/Data da Publica[çc][ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/i)), fonte = g(/Fonte:\s*([^\n]+)/i);
    let corpo = (b.split(/Fonte:[^\n]*\n/i)[1] || '').split(/Total de Publica[çc][õo]es:/i)[0];
    const link = g(/Acesso ao documento:\s*(\S+)/i), idDoc = g(/Identificador do documento:\s*(\S+)/i);
    corpo = corpo.replace(/^.*Acesso ao documento:.*$/gim, '').replace(/^.*Identificador do documento:.*$/gim, '').replace(/\n{3,}/g, '\n\n').trim();
    const titulo = (corpo.split('\n').find(l => l.trim()) || '').trim().slice(0, 80), d = digits(num);
    return {numero:mascaraCnj(num), disp, pub, fonte, diario:/DJEN/i.test(fonte) ? 'DJEN' : /Regional do Trabalho|Superior do Trabalho/i.test(fonte) ? 'DEJT' : 'Diário oficial', tribunal:recorteTribunal(fonte, num),
      titulo:((titulo.match(/^(Pauta de Julgamento|Intima[çc][ãa]o|Despacho|Senten[çc]a|Ac[óo]rd[ãa]o|Edital|Decis[ãa]o|Ato Ordinat[óo]rio|Cita[çc][ãa]o)/i) || [])[1] || ''), texto:corpo, link, idDoc, id:`rec:${d}:${disp}:${hashTxt(corpo.slice(0, 300))}`}; })
    .filter(x => digits(x.numero).length === 20 && x.disp);
}

/* ----- uma publicação só, mesmo vindo de várias fontes ----- */
const pubToks = s => new Set(norm_s(s || '').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 3).slice(0, 60));
const pubParecido = (a, b) => { const A = pubToks(a), B = pubToks(b); if(!A.size || !B.size) return true; let n = 0; A.forEach(w => { if(B.has(w)) n++; }); return n / Math.min(A.size, B.size) >= 0.5; };
function pubIncluir(novo){
  if(byId('monitor', novo.id)) return false;
  if(novo.tipo === 'publicacao'){ const d = digits(novo.numero), ig = db.monitor.find(m => m.tipo === 'publicacao' && digits(m.numero) === d && m.data === novo.data && pubParecido(m.texto, novo.texto));
    if(ig){ ig.fontes = [...new Set([...(ig.fontes || [ig.fonte || 'DJEN']), novo.fonte])]; if(!ig.link && novo.link) ig.link = novo.link; if(!ig.pubEm && novo.pubEm) ig.pubEm = novo.pubEm;
      if(String(novo.texto || '').length > String(ig.texto || '').length + 40) ig.texto = novo.texto; (ig.idsAlt = ig.idsAlt || []).push(novo.id); return false; } }
  db.monitor.push(novo); return true;
}
const pubDataPub = it => it.pubEm || pubDataPublicacao(it.data, ehFederal(it.numero));
const pubFontes = it => (it.fontes || [it.fonte || 'DJEN']).join(' + ');
function recorteImportar(txt){
  const its = recorteParse(txt); if(!its.length) return {lidas:0, novas:0};
  const novos = []; its.forEach(i => { const pr = procPorNumero(i.numero), o = {id:i.id, tipo:'publicacao', fonte:`Recorte OAB · ${i.diario}`, status:'nova', numero:i.numero, data:i.disp, pubEm:i.pub || '', tribunal:i.tribunal, orgao:i.fonte, titulo:i.titulo,
    texto:i.texto.slice(0, 30000), link:i.link, processoId:pr?.id || '', criadoEm:i.disp}; if(pubIncluir(o)) novos.push(o); });
  if(novos.length || its.length){ save(); if(novos.length && typeof wfPublicacoes === 'function') wfPublicacoes(novos); }
  return {lidas:its.length, novas:novos.length};
}
function formImportarRecorte(){
  openForm({title:'📥 Importar recorte digital da OAB', fields:[{type:'html', html:'<div class="small muted">Abra o e-mail do Recorte Digital, selecione tudo (Ctrl+A), copie (Ctrl+C) e cole aqui. As publicações já recebidas pelo DJEN não são repetidas. <b>Com o robô lendo o Gmail, isto acontece sozinho</b> — use aqui só se precisar.</div>'},
    {k:'txt', label:'Texto do e-mail do recorte', type:'textarea', rows:12, full:true}, {type:'html', html:'<div id="recPrev" class="small"></div>'}],
    after:f => { const pv = () => { const n = recorteParse(f.elements.txt.value); f.querySelector('#recPrev').innerHTML = f.elements.txt.value.trim() ? (n.length ? `✔ ${n.length} publicação(ões) reconhecida(s): ${n.map(x => `${esc(x.numero)} (${esc(x.tribunal)}, ${fmtD(x.disp)})`).join(' · ')}` : '<span style="color:var(--bad)">Nenhuma publicação reconhecida neste texto.</span>') : ''; }; onForm(f, 'input', pv); },
    onSave:o => { const r = recorteImportar(o.txt); if(!r.lidas){ toast('Nenhuma publicação reconhecida no texto'); return false; } toast(`📥 ${r.lidas} lida(s) · ${r.novas} nova(s) · ${r.lidas - r.novas} já existia(m)`); render(); }});
}

/* ----- DJEN pelo nome e pelo número dos processos ----- */
const espera = ms => new Promise(z => setTimeout(z, ms));
async function djenBuscarExtra(motivo){
  const cfg = monCfg(); if(!cfg.ativo || monBusy.djenX) return {novos:0}; monBusy.djenX = true;
  const L = monLocal(), t = today(), achados = []; let erro = '';
  const pega = async (params, rot) => { const r = await djenFetch('https://comunicaapi.pje.jus.br/api/v1/comunicacao?' + new URLSearchParams(params), null);
    if(r.status === 400 || r.status === 422){ const e = new Error(`o DJEN recusou a busca por ${rot} (pode ter mudado)`); e.param = rot; throw e; }
    if(!r.ok) throw new Error(r.status === 429 ? 'o DJEN está sobrecarregado' : 'o DJEN respondeu com erro ' + r.status); return (await r.json()).items || []; };
  try{
    if(cfg.nomes.length && (motivo === 'manual' || Date.now() - (L.djenNomeUlt || 0) > 2 * 3600e3)){
      const ini = L.djenNomeAte && L.djenNomeAte > addDays(t, -30) ? L.djenNomeAte : addDays(t, -10);
      for(const nome of cfg.nomes) for(let pag = 1; pag <= 10; pag++){ const it = await pega({nomeAdvogado:nome, dataDisponibilizacaoInicio:ini, dataDisponibilizacaoFim:t, pagina:pag, itensPorPagina:100}, 'nome');
        it.forEach(x => achados.push(pubDoDjen(x, 'djen:' + (x.id || x.hash), {numero:'nome', uf:''}))); if(it.length < 100) break; }
      setMonLocal({djenNomeAte:t, djenNomeUlt:Date.now(), djenNomeErro:''});
    }
    if(cfg.porProc){ const feitos = {...(L.djenProcFeito || {})}, nums = [...new Set(db.processos.filter(p => !p.servico).map(p => digits(p.numero)).filter(d => d.length === 20))];
      const fila = nums.filter(d => Date.now() - (feitos[d] || 0) > 20 * 3600e3).slice(0, motivo === 'manual' ? 40 : 20);
      for(const d of fila){ const it = await pega({numeroProcesso:d, dataDisponibilizacaoInicio:addDays(t, -10), dataDisponibilizacaoFim:t, pagina:1, itensPorPagina:100}, 'número do processo');
        it.forEach(x => { const o = pubDoDjen(x, 'djen:' + (x.id || x.hash), {numero:'processo', uf:''}); if(!pubCitaVoce(o, cfg)) o.outraParte = true; achados.push(o); }); feitos[d] = Date.now(); await espera(1200); }
      Object.keys(feitos).forEach(d => { if(!nums.includes(d)) delete feitos[d]; }); setMonLocal({djenProcFeito:feitos, djenProcErro:''});
    }
  }catch(e){ erro = /fetch|network|load/i.test(e.message) ? 'sem conexão com o DJEN' : e.message; setMonLocal(e.param === 'nome' ? {djenNomeErro:erro} : e.param ? {djenProcErro:erro} : {djenXErro:erro}); }
  const novos = achados.filter(pubIncluir); monBusy.djenX = false;
  if(novos.length){ save(); if(typeof wfPublicacoes === 'function') wfPublicacoes(novos); if(motivo !== 'silencioso') toast(`📰 ${novos.length} publicação(ões) nova(s) (busca por nome / processo)`); renderSeguro(); }
  return {novos:novos.length, erro};
}
// a publicação cita o advogado (nome ou OAB)? — as encontradas pelo número do processo podem ser só para a outra parte
function pubCitaVoce(it, cfg = monCfg()){ const t = norm_s(it.texto || ''); return cfg.oabs.some(o => t.includes(digits(o.numero))) || cfg.nomes.some(n => t.includes(norm_s(n))); }
{ const o = monitorAuto; monitorAuto = function(){ o(); const c = monCfg(), L = monLocal(); if(c.ativo && Date.now() - (L.djenXTent || 0) > 10 * 60e3){ setMonLocal({djenXTent:Date.now()}); setTimeout(() => djenBuscarExtra('auto'), 20e3); } }; }

/* ----- avisos de problema (sistema + e-mail pelo robô) ----- */
function monAlertas(){
  const L = monLocal(), c = monCfg(), out = [], h = 3600e3;
  if(c.ativo && L.djenErro && Date.now() - (L.djenUlt || 0) > 12 * h) out.push({k:'djen', t:'A busca no DJEN está falhando', s:L.djenErro});
  if(L.djenNomeErro) out.push({k:'djenNome', t:'A busca do DJEN pelo seu nome parou', s:L.djenNomeErro});
  if(L.djenProcErro) out.push({k:'djenProc', t:'A busca do DJEN pelo número dos processos parou', s:L.djenProcErro});
  if(c.roboUrl && L.roboErro && Date.now() - (L.roboUlt || 0) > 24 * h) out.push({k:'robo', t:'O robô não responde há mais de 1 dia', s:L.roboErro});
  (L.roboAlertas || []).forEach(a => out.push({k:'r:' + a.chave, t:a.titulo, s:a.texto}));
  return out;
}
{ const o = ntAvisos; ntAvisos = function(){ const av = o(); monAlertas().forEach(a => av.push({id:'pubfonte_' + a.k, sig:a.t + a.s, ic:'🛑', t:a.t, s:a.s, href:'#/publicacoes', nivel:'bad', tipo:'aviso'})); return av; }; }
// e-mail de aviso: o robô envia para a conta Google dele (a sua), no máximo 1 por problema por dia
function monAlertasEmail(){
  const c = monCfg(); if(!c.roboUrl) return; const L = monLocal(), env = {...(L.alertaEnv || {})}, t = today();
  monAlertas().filter(a => !a.k.startsWith('r:') && env[a.k] !== t).forEach(a => { env[a.k] = t; roboChamar(null, {alerta:{chave:a.k, titulo:a.t, texto:a.s}}).catch(() => {}); });
  setMonLocal({alertaEnv:env});
}
setInterval(monAlertasEmail, 30 * 60e3); setTimeout(monAlertasEmail, 60e3);

/* ----- compartilhar / exportar ----- */
function pubResumo(it){
  const pr = monProc(it), txt = String(it.texto || '').replace(/\s+/g, ' ').trim(), frase = txt.length > 320 ? txt.slice(0, 320).replace(/\s\S*$/, '') + '…' : txt;
  return {pr, frase, link:it.link || (/DEJT|TRT/.test(it.fonte + it.tribunal) ? 'https://dejt.jt.jus.br' : 'https://comunica.pje.jus.br'),
    cab:`${it.titulo || 'Publicação'} — processo ${it.numero}${it.tribunal ? ' (' + it.tribunal + ')' : ''}. Disponibilizada em ${fmtD(it.data)}, publicada em ${fmtD(pubDataPub(it))}.`};
}
function pubMensagem(it){ const r = pubResumo(it), cli = byId('pessoas', r.pr?.clienteId);
  return `Olá${cli ? ', ' + cli.nome.split(' ')[0] : ''}! Saiu uma publicação no seu processo nº ${it.numero}:\n\n${r.cab}\n\nResumo: ${r.frase}\n\nPara ver na íntegra: ${r.link}\n\nQualquer dúvida, estou à disposição.`; }
function pubHtml(it){ const r = pubResumo(it), c = monCfg(), marca = s => { let h = esc(s); [...c.nomes, ...c.oabs.map(o => digits(o.numero))].forEach(n => { h = h.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`); }); return h.replace(/\n/g, '<br>'); };
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Publicação ${esc(it.numero)}</title><style>body{font:12px/1.5 Arial,sans-serif;color:#111;margin:22px}h1{font-size:16px;margin:0 0 6px}table{border-collapse:collapse;margin:8px 0 12px}td{padding:3px 10px 3px 0;vertical-align:top}td:first-child{color:#555}mark{background:#fff36b}.txt{border-top:1px solid #ccc;padding-top:10px;text-align:justify}@page{size:A4;margin:16mm}</style></head><body>
    <h1>${esc(it.titulo || 'Publicação')}</h1><table><tr><td>Processo</td><td><b>${esc(it.numero)}</b>${r.pr ? ' — ' + esc(procLabel(r.pr)) : ''}</td></tr>${r.pr ? `<tr><td>Cliente</td><td>${esc(pessoaNome(r.pr.clienteId))}</td></tr>` : ''}
    <tr><td>Diário / fonte</td><td>${esc(pubFontes(it))} · ${esc(it.tribunal || '')}${it.orgao ? ' — ' + esc(it.orgao) : ''}</td></tr><tr><td>Disponibilização</td><td>${fmtD(it.data)}</td></tr><tr><td>Publicação</td><td>${fmtD(pubDataPub(it))}</td></tr>
    <tr><td>Início do prazo</td><td>${fmtD(pubInicioPrazo(it.data, ehFederal(it.numero)))}</td></tr>${it.link ? `<tr><td>Link</td><td>${esc(it.link)}</td></tr>` : ''}</table><div class="txt">${marca(it.texto || '')}</div>
    <p style="color:#777;font-size:10px;margin-top:16px">Emitido em ${new Date().toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'})}</p></body></html>`; }
const pubMenu = it => `<details class="relMenu"><summary class="mini">↗ Compartilhar / exportar ▾</summary><div><button class="mini" data-act="pubSh" data-id="${esc(it.id)}" data-f="pdf">📄 PDF / imprimir</button><button class="mini" data-act="pubSh" data-id="${esc(it.id)}" data-f="doc">📝 Word</button><button class="mini" data-act="pubSh" data-id="${esc(it.id)}" data-f="xls">📊 Excel</button><button class="mini" data-act="pubSh" data-id="${esc(it.id)}" data-f="wa">🟢 WhatsApp</button><button class="mini" data-act="pubSh" data-id="${esc(it.id)}" data-f="mail">✉️ E-mail</button></div></details>`;
const pubLinhaRel = it => ({it, pr:monProc(it)});
const PUB_COLS = [['Disponibilização', x => fmtD(x.it.data)], ['Publicação', x => fmtD(pubDataPub(x.it))], ['Processo', x => x.it.numero], ['Pasta', x => x.pr ? procCode(x.pr) : ''], ['Cliente', x => x.pr ? pessoaNome(x.pr.clienteId) : ''],
  ['Tribunal', x => x.it.tribunal || ''], ['Fonte', x => pubFontes(x.it)], ['Órgão', x => x.it.orgao || ''], ['Tipo', x => x.it.titulo || ''], ['Texto', x => x.it.texto || ''], ['Link', x => x.it.link || ''], ['Situação', x => x.it.status || '']];
REL_FONTES.pubs = () => { const l = (window._pubList || []).map(pubLinhaRel); return {titulo:'Publicações', sub:`${l.length} publicação(ões)`, linhas:l, colunas:PUB_COLS}; };
A.pubSh = (d, el) => { el.closest('details')?.removeAttribute('open'); const it = byId('monitor', d.id); if(!it) return;
  if(d.f === 'xls') return relGerar({titulo:'Publicação ' + it.numero, linhas:[pubLinhaRel(it)], colunas:PUB_COLS}, 'xls');
  if(d.f === 'pdf' || d.f === 'doc') return relGerar({titulo:'Publicação ' + it.numero, linhas:[1], colunas:[], htmlPronto:pubHtml(it)}, d.f);
  const msg = pubMensagem(it), cli = byId('pessoas', monProc(it)?.clienteId);
  if(d.f === 'wa'){ const tel = digits(telsDe(cli || {})[0]?.numero || cli?.telefone || ''); window.open(`https://wa.me/${tel ? (tel.startsWith('55') ? tel : '55' + tel) : ''}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener'); return; }
  location.href = `mailto:${encodeURIComponent(cli?.email || '')}?subject=${encodeURIComponent('Publicação no processo ' + it.numero)}&body=${encodeURIComponent(msg)}`; };
A.pubImportar = () => formImportarRecorte();
