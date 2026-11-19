// Robô: leitura do site do Recorte Digital (simulado). Login real (estrutura baixada do site) + telas internas simuladas a partir dos prints.
const fs = require('fs'), vm = require('vm'), ERR = [];
const login = fs.readFileSync(__dirname + '/fixtures/recorte-login.html', 'utf8');
const lat = s => Buffer.from(s, 'latin1');
const H = '<html><head><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"><title>Hist&oacute;rico</title></head><body><form method="post" action="./PorData.aspx" id="form1"><input type="hidden" name="__VIEWSTATE" value="vs+/="><input type="hidden" name="__EVENTTARGET" value=""><input type="hidden" name="__EVENTARGUMENT" value="">';
const F = '</form></body></html>';
const menu = '<ul><li><a href="Geral.aspx">Página Principal</a></li><li><a href="Agenda.aspx">Agenda</a></li><li><a href="javascript:__doPostBack(\'ctl00$lnkSair\',\'\')">Sair</a></li></ul>';
const pub = (disp, pubD, jornal, trib, cad, vara, tit, num, txt) => `<div class="pub"><div class="col"><div><b>Data de disponibilização:</b> ${disp}</div><div><b>Jornal:</b> ${jornal}</div><div><b>Caderno:</b> ${cad}</div><div><b>Título:</b> ${tit}</div><div><b>Página:</b> 00001</div></div>
<div class="col"><div><b>Data de publicação:</b> ${pubD}</div><div>1.</div><div><b>Tribunal:</b> ${trib}</div><div><b>Vara:</b> ${vara}</div><div><b>Número do processo:</b> ${num}</div></div><div class="txt"><i>${tit}</i><br>${txt}</div>
<div class="cmt"><div>Receber avisos por e-mail</div><label>Sim</label><label>Não</label><div>Prioridade</div><div>Baixíssima</div><div>Baixa</div><div>Normal</div><div>Alta</div><div>Altíssima</div><a href="#">Alterar</a><div>|</div><a href="#">Excluir</a><div>Incluir agendamento</div><div>Novo comentário</div></div><div style="display:none" id="popupAgendamento"><div>Data / horário</div><input name="ctl00$popupAgendamento$txbData" type="text"><div>Anotações</div><textarea name="ctl00$popupAgendamento$txbAnot"></textarea><div>1º aviso</div><select name="ctl00$popupAgendamento$ddl1"><option>[ Selecione ]</option><option>Na hora do evento</option><option>30 minutos de antecedência</option><option>1 dia de antecedência</option></select><div>2º aviso</div><span>Na hora do evento</span><div>10 dias de antecedência</div></div><div class="ic"><a href="javascript:__doPostBack('ctl00$rpt$ctl01$lnkAnotar','')" title="Anotar"><img></a><a href="javascript:__doPostBack('ctl00$rpt$ctl01$lnkEnviar','')" title="Enviar"><img></a></div></div>`;
const P1 = pub('19/11/2026', '23/11/2026', 'Diário da Justiça de São Paulo', 'DJEN - Diário de Justiça Eletrônico Nacional - TJSP', 'Tribunal de Justiça de São Paulo - DJEN', 'Foro de Bauru - 2ª Vara de Família e Sucessões', 'Intimação', '1099991-01.2025.8.26.0071',
  'PROCESSO: 1099991-01.2025.8.26.0071 - CUMPRIMENTO DE SENTENcA - || Processo Sigiloso. Para visualizacao do documento, consulte os autos digitais. ||| POLO ATIVO: SIGILO-1 POLO PASSIVO: SIGILO-2 ADVOGADO: <b>GUILHERME LUCCAS GARCIA</b> - OAB: 355980/SP Acesso ao documento: https://www.dje.tjsp.jus.br Identificador do documento: 000000001');
const P2full = pub('18/11/2026', '19/11/2026', 'Diário Eletrônico da Justiça do Trabalho', 'TRT 15ª Região', 'Judiciário - TRT15', '2ª Câmara', 'Pauta de Julgamento', '0099992-02.2025.5.15.0090', 'Pauta da Sessão Ordinária Híbrida de Julgamento da 2ª Câmara do dia 01/12/2026, às 10h35. RECORRENTE CLIENTE EXEMPLO ADVOGADO GUILHERME LUCCAS GARCIA (OAB: 355980/SP)');
const P2cut = pub('18/11/2026', '19/11/2026', 'Diário Eletrônico da Justiça do Trabalho', 'TRT 15ª Região', 'Judiciário - TRT15', '2ª Câmara', 'Pauta de Julgamento', '0099992-02.2025.5.15.0090', 'Pauta da Sessão Ordinária Híbrida de Julgamento da 2ª Câmara do dia 01/12/2026, às 10h35. O procurador que pretender realizar a suste<b>...</b></span><div>Novo comentário</div><div>5.</div>');
const btns = k => ['Comentar publicação|imbComentar', 'Agendar|imbAgendar', 'Selecionar|imbSelecionar', 'Exportar esta publicação|imbExportarPublicacao', 'Imprimir publicação|imbImprimir', 'Exibir conteúdo completo|imbConteudoCompleto'].map(x => '<input type="image" name="ctl00$ContentPlaceHolder1$ListaPublicacaoResultado$gdvPublicacoes$ctl0' + k + '$' + x.split('|')[1] + '" title="' + x.split('|')[0] + '" src="i.png">').join('');
const P3 = pub('17/11/2026', '18/11/2026', 'Diário da Justiça de São Paulo', 'DJEN - Diário de Justiça Eletrônico Nacional - TJSP', 'Tribunal de Justiça de São Paulo - DJEN', 'Foro de Bauru - 1ª Vara Cível', 'Despacho', '1099993-03.2025.8.26.0071', 'Manifeste-se o autor sobre a contestação. ADVOGADO: GUILHERME LUCCAS GARCIA - OAB: 355980/SP');
const P4 = pub('17/11/2026', '18/11/2026', 'Diário da Justiça de São Paulo', 'DJEN - Diário de Justiça Eletrônico Nacional - TJSP', 'Tribunal de Justiça de São Paulo - DJEN', 'Foro de Bauru - Juizado Especial', 'Edital', '', 'EDITAL DE INTIMAÇÃO com prazo de 15 dias. ADVOGADO: GUILHERME LUCCAS GARCIA - OAB: 355980/SP');
const tela = { porData: H + menu + '<h2>Histórico - Publicações por Data</h2><select name="ctl00$ddlTipo"><option value="P">Data de publicação</option><option value="D" selected>Data de disponibilização</option></select> entre: <input name="ctl00$txtIni" type="text" value="01/10/2026"><input name="ctl00$txtFim" type="text" value="19/11/2026"><select name="ctl00$ddlUF"><option value="">Todos</option><option value="SP">SP</option></select><a id="btnC" href="javascript:__doPostBack(\'ctl00$btnConsultar\',\'\')">Consultar <i class="seta"></i></a> <a href="#">Limpar filtro</a>' + F };
let estado = {}, violacao = [], senhaCerta = {oab:'355980', cpf:'123.456.789-09', rg:'12345678'}, modo = 'ok';
function site(url, o){
  const u = new URL(url), ck = (o.headers && o.headers.Cookie) || '', auth = /AUTH=ok/.test(ck), body = o.payload ? Object.fromEntries(new URLSearchParams(o.payload)) : {};
  const r = (code, html, h = {}) => { const utf = u.pathname === '/'; return {code, buf: utf ? Buffer.from(html || '', 'utf8') : lat(html || ''), h: Object.assign({'Content-Type':'text/html; charset=' + (utf ? 'utf-8' : 'iso-8859-1')}, h)}; };
  if(o.payload){ const alvo = body.__EVENTTARGET || ''; if(/Enviar|Anotar|Sair|Agenda|Selecionar|lnkAval|Popup|Concluir|Votar/i.test(alvo + ' ' + (body.__EVENTTARGET ? '' : Object.keys(body).filter(k => /\$btn/.test(k)).join(' ')))) violacao.push(alvo || Object.keys(body).join(',')); }
  if(u.pathname === '/' && !o.payload) return r(200, login, {'Set-Cookie':'ASP.NET_SessionId=abc; path=/; HttpOnly'});
  if(u.pathname === '/' && o.payload){ estado.tentativas = (estado.tentativas || 0) + 1;
    if(!body.__VIEWSTATE || body.btnEntrar !== 'Entrar') return r(200, login);
    if(body.txbOAB === senhaCerta.oab && body.txbCPF === senhaCerta.cpf && body.txbCI === senhaCerta.rg && body.ddlSiglaUF === 'SP') return r(302, '', {Location:'http://recortedigital.oabsp.org.br/historico/Login.aspx', 'Set-Cookie':['.ASPXAUTH=ok; path=/; HttpOnly']});
    return r(200, login.replace('<input type="submit"', '<span id="lblMsg">Dados inválidos. Verifique.</span><input type="submit"')); }
  if(!auth) return r(302, '', {Location:'http://www.oabsp.org.br'});
  if(u.pathname === '/historico/Login.aspx') return r(200, '<html><head><title>Recorte Digital</title></head><body><script>window.location.href = "Geral.aspx";</script></body></html>');
  if(u.pathname === '/historico/Geral.aspx') return r(200, H + menu + (modo === 'mudou' ? '<p>Nova versão do site</p>' : '<div id="popAviso"><input type="submit" name="ctl00$btnPopupAvisoProximo" value="Próximo"><input type="submit" name="ctl00$btnPopupAvisoFechar" value="Fechar"><input type="submit" name="ctl00$btnPopupCompromissosAgendaConcluirTodos" value="Concluir todos"></div><div class="cards"><a href="PorData.aspx"><div class="card"><img src="cal.png"><p>Por data</p></div></a><a href="Ultimas.aspx"><div class="card"><p>Últimas publicações</p></div></a></div>') + '<p>Qual sua avaliação?</p><input type="submit" name="ctl00$btnVotar" value="Votar">' + F);
  if(u.pathname === '/historico/PorData.aspx' && !o.payload) return r(200, tela.porData);
  if(u.pathname === '/historico/PorData.aspx'){
    if(body.__EVENTTARGET === 'ctl00$btnConsultar'){ estado.consulta = body; if(modo === 'vazio') return r(200, tela.porData.replace('</form>', '<p>Nenhuma publicação encontrada no período.</p></form>'));
      return r(200, H + menu + '<h3>Resumo por data de disponibilização</h3><input type="checkbox" name="ctl00$chk1" checked> DJ SP (3)<input type="submit" name="ctl00$btnSel" value="Visualizar selecionados"><input type="submit" name="ctl00$btnTudo" value="Visualizar tudo">' + F); }
    const img = Object.keys(body).find(k => /\.x$/.test(k)); if(img){ if(!/imbConteudoCompleto/.test(img)) violacao.push(img); else { estado.exp = estado.exp || {}; estado.exp[(img.match(/\$(ctl\d+)\$/) || [])[1]] = 1; estado.cliquesCompleto = (estado.cliquesCompleto || 0) + 1; if(modo === 'janela') return r(200, H + '<div id="pnlConteudoCompleto"><span>Pauta de Julgamento Pauta da Sessão Ordinária Híbrida de Julgamento da 2ª Câmara do dia 01/12/2026, às 10h35. O procurador que pretender realizar a sustentação oral deverá se inscrever. RECORRENTE CLIENTE EXEMPLO ADVOGADO GUILHERME LUCCAS GARCIA (OAB: 355980/SP)</span></div><input type="submit" name="ctl00$btnFechar" value="Fechar">' + F); body['ctl00$btnTudo'] = 'Visualizar tudo'; } }
    if(body['ctl00$btnTudo'] === 'Visualizar tudo' || body.__EVENTARGUMENT === 'Page$2'){ const p2 = body.__EVENTARGUMENT === 'Page$2';
      return r(200, H + menu + '<div>Detalhamento da(s) 3 publicações selecionadas</div><a href="javascript:__doPostBack(\'ctl00$btnVoltar\',\'\')">Voltar para Seleção</a><p>Sua pesquisa retornou <b>' + (modo === 'extra' ? 5 : 3) + '</b> publicações. Exibindo resultados de ' + (p2 ? '3 a 3' : '1 a 2') + '.</p>' + (p2 ? (modo === 'extra' ? P3 + P3 + P4 : P3) + btns(2) : P1 + btns(2) + ((estado.exp || {}).ctl03 ? P2full : modo === 'oculto' ? P2cut.replace('suste<b>...</b></span>', 'suste<b>...</b></span></div><div style="display:none">Pauta da Sessão Ordinária Híbrida de Julgamento da 2ª Câmara do dia 01/12/2026, às 10h35. O procurador que pretender realizar a sustentação oral deverá se inscrever. RECORRENTE CLIENTE EXEMPLO ADVOGADO GUILHERME LUCCAS GARCIA (OAB: 355980/SP)') : P2cut) + btns(3))
        + (p2 ? '' : '<table><tr><td><span>1</span></td><td><a href="javascript:__doPostBack(\'ctl00$ContentPlaceHolder1$ListaPublicacaoResultado$gdvPublicacoes\',\'Page$2\')">2</a></td></tr></table>') + '<div><a href="javascript:__doPostBack(\'ctl00$lnkSelTodas\',\'\')">Selecionar todas</a><a href="javascript:__doPostBack(\'ctl00$lnkEnviarTodas\',\'\')">Enviar todas</a><a href="javascript:__doPostBack(\'ctl00$lnkImpr\',\'\')">Imprimir todas</a></div>' + F); }
  }
  return r(404, 'não encontrado');
}
const ctx = { console, Logger:{log:(...a) => ctx._log.push(a.join(' '))}, _log:[], Utilities:{formatDate:(d) => new Date(d).toISOString().slice(0, 10), sleep(){}}, Session:{getEffectiveUser:() => ({getEmail:() => 'robo@exemplo'})},
  UrlFetchApp:{fetch(url, o){ const x = site(url, o); return {getResponseCode:() => x.code, getAllHeaders:() => x.h, getContentText:cs => new TextDecoder(/utf-?8/i.test(cs || '') ? 'utf-8' : 'latin1').decode(x.buf)}; }} };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(__dirname + '/../robo/robo-escritorio.gs', 'utf8') + '\n;this.rsColetar_=rsColetar_;this.recorteSiteParse_=recorteSiteParse_;this.rsTexto_=rsTexto_;', ctx);
const cred = {oab:'355980', uf:'SP', cpf:'12345678909', rg:'12345678'};
// 1) leitura completa (CPF sem pontos: o robô tenta com a máscara do site)
let r = ctx.rsColetar_(cred, '2026-11-15', '2026-11-19');
console.log('lidas', r.itens.length, 'total', r.total, r.itens.map(i => `${i.numero} ${i.disp}/${i.pub} ${i.diario} ${i.tribunal} [${i.titulo}] ${i.fonte}`));
if(r.itens.length !== 3 || r.total !== 3) ERR.push('esperava 3 publicações');
const trt = r.itens.find(i => i.tribunal === 'TRT15'); console.log('TRT15 completo?', /CLIENTE EXEMPLO/.test(trt && trt.texto || ''), '· cliques em Exibir conteúdo completo:', estado.cliquesCompleto, '· completados', r.expandidos, '· ainda cortados', r.cortados);
if(!trt || !/CLIENTE EXEMPLO/.test(trt.texto) || /suste …/.test(trt.texto) || r.expandidos !== 1 || r.cortados !== 0) ERR.push('texto cortado não foi completado'); if(!trt || trt.diario !== 'DEJT' || trt.disp !== '2026-11-18' || trt.pub !== '2026-11-19') ERR.push('TRT15/DEJT errado');
const tj = r.itens.find(i => i.numero === '1099991-01.2025.8.26.0071'); if(!tj || tj.link !== 'https://www.dje.tjsp.jus.br' || /Identificador/.test(tj.texto) || !/GUILHERME LUCCAS GARCIA/.test(tj.texto) || tj.titulo !== 'Intimação') ERR.push('TJSP: link/texto/título ' + JSON.stringify(tj));
if(/Enviar todas|Data de publica|aviso|antecedência|Data \/ horário|Anotações|Selecione|Prioridade|Baixíssima|coment|Receber avisos|\bSim\b|Excluir/.test(r.itens.map(i => i.texto).join(' '))) ERR.push('lixo no texto: ' + r.itens[0].texto);
if(estado.consulta['ctl00$ddlTipo'] !== 'D' || estado.consulta['ctl00$txtIni'] !== '15/11/2026' || estado.consulta['ctl00$txtFim'] !== '19/11/2026') ERR.push('consulta errada ' + JSON.stringify(estado.consulta));
if(violacao.length) ERR.push('CLIQUE PROIBIDO: ' + violacao);
console.log('tentativas de login', estado.tentativas, '· consulta', estado.consulta['ctl00$ddlTipo'], estado.consulta['ctl00$txtIni'], estado.consulta['ctl00$txtFim']);
// 2) dados errados: erro de login, sem expor CPF
estado = {}; try{ ctx.rsColetar_({...cred, rg:'999'}, '2026-11-15', '2026-11-19'); ERR.push('login errado passou'); }catch(e){ console.log('login errado →', e.tipo, e.message); if(e.tipo !== 'login') ERR.push('tipo ' + e.tipo); if(/123/.test(e.message)) ERR.push('mensagem expõe CPF'); if(estado.tentativas > 2) ERR.push('tentativas demais'); }
// 3) site mudou
modo = 'mudou'; try{ ctx.rsColetar_(cred, '2026-11-15', '2026-11-19'); ERR.push('mudou passou'); }catch(e){ console.log('site mudou →', e.tipo, e.message); if(e.tipo !== 'mudou') ERR.push('tipo ' + e.tipo); }
// 4) sem publicações
modo = 'vazio'; r = ctx.rsColetar_(cred, '2026-11-15', '2026-11-19'); console.log('período vazio →', r.itens.length); if(r.itens.length) ERR.push('vazio');
// 5) diagnóstico não mostra valores
modo = 'ok'; const diag = []; ctx.rsColetar_(cred, '2026-11-15', '2026-11-19', diag); const dg = diag.join('\n'); if(/12345678|355980/.test(dg)) ERR.push('diagnóstico expõe dados'); console.log(dg.split('\n').slice(0, 4).join('\n')); console.log('passos:', diag.map(d => d.split('\n')[0].split(' · ')[0]).join(' → '));
// 6) recusa de clique proibido
try{ vm.runInContext("rsConfere_({rot:'Enviar todas', tipo:'postback'})", ctx); ERR.push('Enviar todas não foi recusado'); }catch(e){ console.log('Enviar todas →', e.message); }
// 7) rotina agendada: grava em Itens sem repetir, avisa e para de tentar quando o login é recusado
const store = {RECORTE_OAB:'355980', RECORTE_UF:'SP', RECORTE_CPF:'12345678909', RECORTE_RG:'12345678'}, emails = [], linhas = [];
Object.assign(ctx, {PropertiesService:{getScriptProperties:() => ({getProperty:k => store[k] == null ? null : store[k], setProperty:(k, v) => { store[k] = v; }, deleteProperty:k => { delete store[k]; }})},
  MailApp:{getRemainingDailyQuota:() => 50, sendEmail:o => emails.push(o.subject)}});
vm.runInContext(`abas_ = () => {}; log_ = () => {}; hoje_ = () => '2026-11-19'; idsExistentes_ = () => { const o = {}; _linhas.forEach(r => o[r[0]] = 1); return o; };
  aba_ = () => ({getLastRow:() => _linhas.length + 1, getRange:(r, c, n, m) => ({setValues:v => v.forEach(x => _linhas.push(x)), getValues:() => _linhas.slice(r - 2, r - 2 + n).map(x => x.slice(c - 1, c - 1 + m)), setValue:v => { _linhas[r - 2][c - 1] = v; }})});`, Object.assign(ctx, {_linhas:linhas}));
modo = 'ok'; let n1 = vm.runInContext('lerRecorteSite()', ctx), n2 = vm.runInContext('lerRecorteSite()', ctx);
console.log('rotina: 1ª', n1, 'nova(s) · 2ª', n2, '· colunas', linhas[0] && linhas[0].length, '· fonte', linhas[1] && linhas[1][2]);
if(n1 !== 3 || n2 !== 0 || linhas.length !== 3 || linhas[0].length !== 12) ERR.push('gravação na planilha');
{ const k = linhas.findIndex(x => /0099992/.test(x[3])); linhas[k][8] = 'Pauta de Julgamento\nPauta da Sessão Ordinária Híbrida de Julgamento da 2ª Câmara do dia 01/12/2026, às 10h35. RECORRENTE …'; linhas[k][10] = 'antigo'; estado.exp = {};
  vm.runInContext('lerRecorteSite()', ctx); console.log('planilha: cortado substituído?', /CLIENTE EXEMPLO/.test(linhas[k][8]), '· reenviado ao app?', linhas[k][10] !== 'antigo');
  if(!/CLIENTE EXEMPLO/.test(linhas[k][8]) || linhas[k][10] === 'antigo' || linhas.length !== 3) ERR.push('planilha não completou o texto'); }
modo = 'mudou'; vm.runInContext('lerRecorteSite()', ctx); if(!JSON.parse(store.ALERTAS || '{}')['recorte-site-mudou']) ERR.push('sem aviso de site mudou');
modo = 'ok'; vm.runInContext('lerRecorteSite()', ctx); if(JSON.parse(store.ALERTAS || '{}')['recorte-site-mudou']) ERR.push('aviso não foi resolvido');
store.RECORTE_RG = '999'; estado = {}; vm.runInContext('lerRecorteSite()', ctx); const t1 = estado.tentativas; vm.runInContext('lerRecorteSite()', ctx);
if(!store.RECORTE_SITE_BLOQ || estado.tentativas !== t1) ERR.push('não parou de tentar após login recusado');
console.log('login recusado: bloqueado =', store.RECORTE_SITE_BLOQ, '· tentativas', estado.tentativas, '· e-mails:', emails);
if(emails.some(e => /123|355980/.test(e))) ERR.push('e-mail expõe dados');
try{ vm.runInContext("rsConfere_({rot:'Próximo', tipo:'submit', nome:'ctl00$btnPopupAvisoProximo'})", ctx); ERR.push('Próximo do aviso não foi recusado'); }catch(e){ console.log('Próximo do aviso →', e.message); }
// 8) diagnóstico: resultado na 1ª linha, curto e sem números de processo/dados
ctx._log.length = 0; store.RECORTE_RG = '12345678'; modo = 'ok'; vm.runInContext('diagnosticarRecorte()', ctx); const lg = ctx._log.join('\n');
console.log('diagnóstico:', ctx._log[0], '· tamanho', lg.length); console.log(ctx._log[1].split('\n').slice(-6).join('\n'));
if(!/^RESULTADO: 3 /.test(ctx._log[0]) || lg.length > 7500 || /1099991|0099992|12345678|355980/.test(lg)) ERR.push('diagnóstico: ' + ctx._log[0]);
// 9) publicação sem número CNJ entra (prazo!) e a repetida na lista conta como lida
modo = 'extra'; r = ctx.rsColetar_(cred, '2026-11-15', '2026-11-19'); modo = 'ok';
console.log('extra → lidas', r.lidas, 'de', r.total, '· diferentes', r.itens.length, '· repetidas', r.repetidas, '· sem número', r.semNumero, r.itens.filter(i => i.numero === 'sem número').map(i => i.titulo));
if(r.lidas !== 5 || r.total !== 5 || r.itens.length !== 4 || r.repetidas !== 1 || r.semNumero !== 1) ERR.push('sem número / repetida');
// 10) versão inteira escondida na página (o “•••” só mostra): lê a inteira sem clicar e conta no diagnóstico
modo = 'oculto'; estado = {}; r = ctx.rsColetar_(cred, '2026-11-15', '2026-11-19'); modo = 'ok';
const tro = r.itens.find(i => i.tribunal === 'TRT15'); console.log('oculto → inteiros escondidos', r.ocultos, '· cliques', estado.cliquesCompleto || 0, '· cortados', r.cortados, '· cita você?', /GUILHERME/.test(tro.texto), '· começo repetido?', (tro.texto.match(/O procurador que pretender/g) || []).length > 1);
if(r.ocultos !== 1 || estado.cliquesCompleto || r.cortados || !/GUILHERME/.test(tro.texto) || (tro.texto.match(/O procurador que pretender/g) || []).length > 1) ERR.push('versão inteira escondida');
// 11) o clique devolve só o texto inteiro (janela): o robô acha o texto pelo começo
modo = 'janela'; estado = {}; r = ctx.rsColetar_(cred, '2026-11-15', '2026-11-19'); modo = 'ok';
const tj2 = r.itens.find(i => i.tribunal === 'TRT15'); console.log('janela → completados', r.expandidos, '· cortados', r.cortados, '· cita você?', /GUILHERME/.test(tj2.texto), '· fim:', JSON.stringify(tj2.texto.slice(-30)));
if(r.expandidos !== 1 || r.cortados || !/GUILHERME/.test(tj2.texto) || /Novo comentário/.test(tj2.texto)) ERR.push('janela do texto completo');
// 12) diagnóstico (esqueleto) sem nenhum texto das publicações
estado = {}; modo = 'ok'; ctx._log.length = 0; vm.runInContext('diagnosticarRecorte()', ctx); const esq = ctx._log.join('\n');
if(/CLIENTE|Pauta da Sess|procurador|Intima|GUILHERME/.test(esq.replace(/LINHAS[^\n]*/g, ''))) ERR.push('esqueleto mostra texto: ' + esq.slice(0, 300));
console.log('esqueleto ok?', !/CLIENTE|procurador/.test(esq.replace(/LINHAS[^\n]*/g, '')), esq.split('\n').find(l => /^ESQUELETO/.test(l)));
console.log('ERROS', ERR); process.exit(ERR.length ? 1 : 0);
