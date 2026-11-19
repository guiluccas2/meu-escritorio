/* ===== 📰 Mais fontes de publicações + compartilhar =====
   • Recorte Digital da OAB/SP (cobre DJEN, DEJT/TRT e diários estaduais), em 3 vias:
     1) principal: o robô entra no site do Recorte (6h, 8h, 10h, 12h, 14h e 18h) e lê “Visualizar tudo” (recorteSiteParse_ no robô);
     2) secundária: o robô lê o e-mail diário do recorte no Gmail (recorteParse);
     3) reserva: botão do navegador (favorito) na tela do Recorte → manda o texto para o app por postMessage (rsBotaoFn / ouvinte RS_ORIGEM),
        ou colar o texto (do e-mail ou do site) em “📥 Importar recorte”. Tudo entra como “Recorte OAB · …” e passa por pubIncluir.
   • DJEN além da OAB: busca pelo NOME do advogado e pelo NÚMERO de cada processo (ativos e inativos), em rodízio e espaçado (não sobrecarrega o DJEN).
   • A mesma publicação vinda de fontes diferentes aparece uma vez só (pubIncluir: mesmo processo + mesma disponibilização + texto parecido).
   • Problemas nas buscas (site mudou, formato do e-mail mudou, parâmetro recusado, falha persistente): aviso no sistema + e-mail (pelo robô).
   • Cada publicação: PDF / Word / Excel, WhatsApp e e-mail ao cliente (resumo + link). Em lote: “📄 Relatório” sobre a lista da tela. */

/* ----- leitura do e-mail do Recorte Digital ----- */
const brIso = s => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
const hashTxt = s => { let h = 0; for(const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
function recorteTribunal(fonte, num){ const f = norm_s(fonte || '');
  let m = f.match(/regional do trabalho\D*(\d+)/) || f.match(/\btrt\s*-?\s*(\d+)/); if(m) return 'TRT' + (+m[1]);
  m = f.match(/regional federal\D*(\d+)/) || f.match(/\btrf\s*-?\s*(\d+)/); if(m) return 'TRF' + (+m[1]);
  if(/justica de sao paulo|tjsp/.test(f)) return 'TJSP'; if(/superior do trabalho/.test(f)) return 'TST'; if(/superior tribunal de justica/.test(f)) return 'STJ';
  const t = typeof tribunalDoNumero === 'function' ? tribunalDoNumero(num) : ''; return t ? t.replace('-', '') : ''; }
function recorteParse(txt){
  const t = String(txt || '').replace(/\r/g, '').split('\n').filter(l => !/^\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2}\s+Webmail ::/.test(l) && !/^https:\/\/webmail\./.test(l.trim())).join('\n');
  const blocos = t.split(/PUBLICA[ÇC][ÃA]O\s+\d+\s*\/\s*\d+/i).slice(1);
  return blocos.map(b => { const g = re => ((b.match(re) || [])[1] || '').trim();
    const num = g(/Processo:\s*([\d.\-]{20,25})/i) || g(/Processo:\s*([^\n]{3,40})/i), disp = brIso(g(/Data da Disponibiliza[çc][ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/i)), pub = brIso(g(/Data da Publica[çc][ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/i)), fonte = g(/Fonte:\s*([^\n]+)/i);
    let corpo = (b.split(/Fonte:[^\n]*\n/i)[1] || '').split(/Total de Publica[çc][õo]es:/i)[0];
    const link = g(/Acesso ao documento:\s*(\S+)/i), idDoc = g(/Identificador do documento:\s*(\S+)/i);
    corpo = corpo.replace(/^.*Acesso ao documento:.*$/gim, '').replace(/^.*Identificador do documento:.*$/gim, '').replace(/\n{3,}/g, '\n\n').trim();
    const titulo = (corpo.split('\n').find(l => l.trim()) || '').trim().slice(0, 80), d = digits(num);
    return {numero:mascaraCnj(num) || 'sem número', disp, pub, fonte, diario:/DJEN/i.test(fonte) ? 'DJEN' : /Regional do Trabalho|Superior do Trabalho/i.test(fonte) ? 'DEJT' : 'Diário oficial', tribunal:recorteTribunal(fonte, num),
      titulo:((titulo.match(/^(Pauta de Julgamento|Intima[çc][ãa]o|Despacho|Senten[çc]a|Ac[óo]rd[ãa]o|Edital|Decis[ãa]o|Ato Ordinat[óo]rio|Cita[çc][ãa]o)/i) || [])[1] || ''), texto:corpo, link, idDoc, id:`rec:${d}:${disp}:${hashTxt(corpo.slice(0, 300))}`}; })
    .filter(x => x.disp && (digits(x.numero).length === 20 || String(x.texto || '').length > 20));
}

/* ----- leitura da tela “Visualizar tudo” do site do Recorte (texto copiado ou enviado pelo botão do navegador) — o mesmo leitor do robô ----- */
// linhas da janela “Agendar” que o site do Recorte põe escondida em cada publicação — não fazem parte do texto (o mesmo filtro do robô)
const RS_LIXO = /^\s*(Data \/ hor[áa]rio|Anota[çc][õo]es|\d+\s*[ºo°ª]\s*aviso|\[\s*Selecione\s*\]|Selecione|Na hora do evento|\d+\s*(minutos?|horas?|dias?|semanas?)\s*de anteced[êe]ncia|Agendar|Agendamento|Comentar publica[çc][ãa]o|Exportar esta publica[çc][ãa]o|Imprimir publica[çc][ãa]o|Exibir conte[úu]do completo|Salvar|Cancelar|Confirmar|Fechar|OK)\s*$/i;
const RS_LIXO_FIM = /(?:\s*(?:Data \/ hor[áa]rio|Anota[çc][õo]es|\d+\s*[ºo°ª]\s*aviso|\[\s*Selecione\s*\]|Na hora do evento|\d+\s*(?:minutos?|horas?|dias?|semanas?)\s*de anteced[êe]ncia)){2,}\s*$/gim;
const rsLimpar = t => String(t || '').split('\n').filter(l => !RS_LIXO.test(l)).join('\n').replace(RS_LIXO_FIM, '').replace(/\n{3,}/g, '\n\n').trim();
const rsSujo = t => /(^|\n)\s*(Data \/ hor[áa]rio|\d+\s*[ºo°ª]\s*aviso|Na hora do evento)\s*(\n|$)/i.test(t || '') || new RegExp(RS_LIXO_FIM.source, 'im').test(t || '');
const RS_ROT = ['Data de disponibiliza[çc][ãa]o', 'Data de publica[çc][ãa]o', 'Jornal', 'Tribunal', 'Caderno', 'Vara', 'T[íi]tulo', 'N[úu]mero do processo', 'P[áa]gina'];
function recorteSiteParse(txt){
  const reRot = RS_ROT.map(r => new RegExp('^\\s*(?:' + r + ')\\s*:\\s*(.*)$', 'i')), reTodos = new RegExp('\\s*((?:' + RS_ROT.join('|') + ')\\s*:)', 'gi');
  const t = String(txt || '').replace(/\r/g, '').replace(/ /g, ' ');
  return t.split(/(?=Data de disponibiliza[çc][ãa]o\s*:)/i).filter(b => /^Data de disponibiliza[çc][ãa]o\s*:/i.test(b)).map(b => {
    b = b.split(/Selecionar todas|Exportar todas|Enviar todas|Imprimir todas|Voltar para Sele/i)[0];
    const lin = b.replace(reTodos, '\n$1').split('\n'), v = {}, usada = {};
    lin.forEach((l, i) => { if(usada[i]) return; const k = reRot.findIndex(re => re.test(l)); if(k < 0 || k in v) return; let val = l.match(reRot[k])[1].trim(); usada[i] = 1;
      if(!val && i + 1 < lin.length && !reRot.some(re => re.test(lin[i + 1])) && (k > 1 && k < 7 || (k < 2 ? /^\s*\d{2}\/\d{2}\/\d{4}\s*$/ : /^\s*[\d.\-\/]{5,30}\s*$/).test(lin[i + 1])) && (k < 2 || k > 6 || lin[i + 1].length < 120)){ val = lin[i + 1].trim(); usada[i + 1] = 1; } v[k] = val; });
    const corpo = lin.filter((l, i) => !usada[i] && !/^\s*\d+\.\s*$/.test(l) && !RS_LIXO.test(l)).join('\n').replace(RS_LIXO_FIM, '').replace(/\n{3,}/g, '\n\n').trim();
    const num = (String(v[7] || '').match(/[\d.\-]{20,25}/) || corpo.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/) || [String(v[7] || '').trim()])[0], d = digits(num), disp = brIso(v[0]), fonteTxt = [v[3], v[4], v[2]].join(' ');
    const link = (corpo.match(/Acesso ao documento:\s*(\S+)/i) || [])[1] || '', texto = corpo.replace(/Acesso ao documento:\s*\S+/i, '').replace(/Identificador do documento:\s*\S+/i, '').replace(/[ \t]+$/gm, '').trim();
    return {numero:mascaraCnj(num) || 'sem número', disp, pub:brIso(v[1]), fonte:[v[4] || v[2], v[5]].filter(Boolean).join(' - '), diario:/DJEN|Nacional/i.test(fonteTxt) ? 'DJEN' : /Trabalho|DEJT|\bTRT/i.test(fonteTxt) ? 'DEJT' : 'Diário oficial',
      tribunal:recorteTribunal(fonteTxt, num), titulo:String(v[6] || '').slice(0, 80), texto, link, id:'rsite:' + d + ':' + disp + ':' + hashTxt(texto.slice(0, 300))}; })
    .filter(x => x.disp && (digits(x.numero).length === 20 || String(x.texto || '').length > 20));
}
const recorteLer = txt => [...recorteParse(txt), ...recorteSiteParse(txt)];

// limpa as publicações que já entraram com o texto da janela “Agendar” (inclusive as do DJEN juntadas com as do Recorte)
function rsLimparSalvas(){ if(ARM.carregando) return setTimeout(rsLimparSalvas, 2000); let n = 0;
  db.monitor.forEach(m => { if(m.tipo === 'publicacao' && rsSujo(m.texto)){ m.texto = rsLimpar(m.texto); n++; } }); if(n) save(); return n; }
setTimeout(rsLimparSalvas, 3000);
/* ----- uma publicação só, mesmo vindo de várias fontes ----- */
const pubToks = s => new Set(norm_s(s || '').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 3).slice(0, 60));
const pubParecido = (a, b) => { const A = pubToks(a), B = pubToks(b); if(!A.size || !B.size) return true; let n = 0; A.forEach(w => { if(B.has(w)) n++; }); return n / Math.min(A.size, B.size) >= 0.5; };
function pubIncluir(novo){
  if(byId('monitor', novo.id)) return false;
  if(novo.tipo === 'publicacao' && rsSujo(novo.texto)) novo.texto = rsLimpar(novo.texto); // leituras antigas do robô (texto da janela “Agendar” do site)
  if(novo.tipo === 'publicacao'){ const d = digits(novo.numero), ig = db.monitor.find(m => m.tipo === 'publicacao' && digits(m.numero) === d && m.data === novo.data && pubParecido(m.texto, novo.texto));
    if(ig){ ig.fontes = [...new Set([...(ig.fontes || [ig.fonte || 'DJEN']), novo.fonte])]; if(!ig.link && novo.link) ig.link = novo.link; if(!ig.pubEm && novo.pubEm) ig.pubEm = novo.pubEm;
      if(String(novo.texto || '').length > String(ig.texto || '').length + 40) ig.texto = novo.texto; (ig.idsAlt = ig.idsAlt || []).push(novo.id); return false; } }
  db.monitor.push(novo); return true;
}
const pubDataPub = it => it.pubEm || pubDataPublicacao(it.data, ehFederal(it.numero));
const pubFontes = it => (it.fontes || [it.fonte || 'DJEN']).join(' + ');
function recorteImportar(txt){
  const its = recorteLer(txt); if(!its.length) return {lidas:0, novas:0};
  const novos = []; its.forEach(i => { const pr = procPorNumero(i.numero), o = {id:i.id, tipo:'publicacao', fonte:`Recorte OAB · ${i.diario}`, status:'nova', numero:i.numero, data:i.disp, pubEm:i.pub || '', tribunal:i.tribunal, orgao:i.fonte, titulo:i.titulo,
    texto:i.texto.slice(0, 30000), link:i.link, processoId:pr?.id || '', criadoEm:i.disp}; if(pubIncluir(o)) novos.push(o); });
  if(novos.length || its.length){ save(); if(novos.length && typeof wfPublicacoes === 'function') wfPublicacoes(novos); }
  return {lidas:its.length, novas:novos.length};
}
function formImportarRecorte(){
  openForm({title:'📥 Importar recorte digital da OAB', fields:[{type:'html', html:`<div class="small muted">O robô já lê o Recorte sozinho (no site e no e-mail). Use aqui só se precisar: abra o <b>e-mail do recorte</b> ou a tela <b>Visualizar tudo</b> do site, selecione tudo (Ctrl+A), copie (Ctrl+C) e cole abaixo. O que já foi recebido não se repete.</div>
      <details class="rsBot"><summary class="small"><b>🔖 Botão do navegador</b> (computador): manda as publicações do site com um clique</summary><div class="small">
        1. Arraste este botão para a barra de favoritos (não clique nele aqui): <a id="rsBookmarklet" class="btn" href="${esc(rsBotaoHref())}" onclick="return false" draggable="true">➜ Meu Escritório</a><br>
        2. No site do Recorte Digital, abra Histórico › Por data › <b>Visualizar tudo</b> e clique no favorito “➜ Meu Escritório”.<br>
        O sistema abre numa aba e recebe as publicações. Não guarda dados de acesso e só lê a página. Se arrastar não funcionar: crie um favorito qualquer e cole como endereço o código de <button type="button" class="mini" data-act="rsCopiar">copiar código</button>.</div></details>`},
    {k:'txt', label:'Texto do e-mail ou da tela do recorte', type:'textarea', rows:12, full:true}, {type:'html', html:'<div id="recPrev" class="small"></div>'}],
    after:f => { const pv = () => { const n = recorteLer(f.elements.txt.value); f.querySelector('#recPrev').innerHTML = f.elements.txt.value.trim() ? (n.length ? `✔ ${n.length} publicação(ões) reconhecida(s): ${n.map(x => `${esc(x.numero)} (${esc(x.tribunal)}, ${fmtD(x.disp)})`).join(' · ')}` : '<span style="color:var(--bad)">Nenhuma publicação reconhecida neste texto.</span>') : ''; }; onForm(f, 'input', pv); },
    onSave:o => { const r = recorteImportar(o.txt); if(!r.lidas){ toast('Nenhuma publicação reconhecida no texto'); return false; } toast(`📥 ${r.lidas} lida(s) · ${r.novas} nova(s) · ${r.lidas - r.novas} já existia(m)`); render(); }});
}

/* ----- botão do navegador (favorito): roda NA PÁGINA do Recorte, só lê o texto e manda para o app (postMessage, origem conferida dos dois lados) ----- */
const RS_ORIGEM = 'https://recortedigital.oabsp.org.br';
function rsBotaoFn(A){ var O = new URL(A).origin;
  if(!/(^|\.)recortedigital\.oabsp\.org\.br$/.test(location.hostname)){ alert('Use este botão no site do Recorte Digital da OAB/SP, na tela das publicações (Visualizar tudo).'); return; }
  var t = document.body.innerText; for(var i = 0; i < frames.length; i++){ try{ t += '\n' + frames[i].document.body.innerText; }catch(e){} }
  if(!/Data de disponibiliza..o\s*:/i.test(t)){ alert('Abra a lista das publicações (Histórico › Por data › Visualizar tudo) e clique de novo.'); return; }
  var id = String(Date.now()), w = window.open(A + '#/publicacoes', 'meuEscRecorte'), n = 0, ok = 0;
  if(!w){ alert('O navegador bloqueou a janela do Meu Escritório. Permita janelas para este site e clique de novo.'); return; }
  var f = function(e){ if(e.origin !== O || !e.data || e.data.t !== 'meuEscOk' || e.data.id !== id) return; ok = 1; removeEventListener('message', f); alert('Meu Escritório: ' + e.data.lidas + ' publicação(ões) lida(s), ' + e.data.novas + ' nova(s).'); };
  addEventListener('message', f);
  var k = setInterval(function(){ if(ok || ++n > 60){ clearInterval(k); if(!ok) alert('O Meu Escritório não respondeu. Copie a página (Ctrl+A, Ctrl+C) e cole em Publicações › Importar recorte.'); return; }
    try{ w.postMessage({t:'meuEscRecorte', id:id, txt:t}, O); }catch(e){} }, 500); }
const rsBotaoHref = () => 'javascript:' + encodeURIComponent('(' + rsBotaoFn.toString() + ')(' + JSON.stringify(location.origin + location.pathname.replace(/[^/]*$/, '')) + ')');
const rsRecebidos = {};
window.addEventListener('message', e => {
  const d = e.data; if(e.origin !== RS_ORIGEM || !d || d.t !== 'meuEscRecorte' || typeof d.txt !== 'string' || ARM.carregando) return; // carregando: o botão tenta de novo
  let r = rsRecebidos[d.id];
  if(!r){ r = rsRecebidos[d.id] = recorteImportar(d.txt.slice(0, 3e6)); setMonLocal({recorteBotaoUlt:new Date().toISOString()});
    toast(r.lidas ? `🔖 Recorte: ${r.lidas} lida(s) · ${r.novas} nova(s)` : '🔖 Recorte: nenhuma publicação reconhecida na página'); if(location.hash.startsWith('#/publicacoes')) render(); else go('#/publicacoes'); }
  try{ e.source.postMessage({t:'meuEscOk', id:d.id, lidas:r.lidas, novas:r.novas}, RS_ORIGEM); }catch(x){}
});
A.rsCopiar = () => { const h = rsBotaoHref(); (navigator.clipboard ? navigator.clipboard.writeText(h) : Promise.reject()).then(() => toast('Código copiado — cole como endereço do favorito')).catch(() => prompt('Copie o código:', h)); };

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
