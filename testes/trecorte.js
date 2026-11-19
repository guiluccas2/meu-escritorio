// Recorte Digital — botão do navegador (favorito) e colar o texto do SITE: leitor da tela “Visualizar tudo”, origem conferida, sem duplicar
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const ERR=[];
const pub=(disp,pubD,jornal,trib,cad,vara,tit,num,txt)=>`<div class="pub" style="display:grid;grid-template-columns:1fr 1fr"><div><div><b>Data de disponibilização:</b> ${disp}</div><div><b>Jornal:</b> ${jornal}</div><div><b>Caderno:</b> ${cad}</div><div><b>Título:</b> ${tit}</div><div><b>Página:</b> 00001</div></div>
<div><div><b>Data de publicação:</b> ${pubD}</div><div>1.</div><div><b>Tribunal:</b> ${trib}</div><div><b>Vara:</b> ${vara}</div><div><b>Número do processo:</b> ${num}</div></div><div style="grid-column:1/3"><i>${tit}</i><br>${txt}</div><div>✎ ☆ ⤓ 🖶</div><div class="cmt"><div>Receber avisos por e-mail</div><label>Sim</label><label>Não</label><div>Prioridade</div><div>Baixíssima</div><div>Baixa</div><div>Normal</div><div>Alta</div><div>Altíssima</div><a href="#">Alterar</a><div>|</div><a href="#">Excluir</a><div>Incluir agendamento</div><div>Novo comentário</div></div><div class="popAg"><div>Data / horário</div><div>Anotações</div><div>1º aviso</div><div>[ Selecione ]</div><div>Na hora do evento</div><div>30 minutos de antecedência</div><div>2 dias de antecedência</div><div>2º aviso</div></div></div>`;
const DET=`<!doctype html><html><head><meta charset="utf-8"><title>Histórico</title></head><body><nav>Página Principal Acesso Publicações Estados Extras Agenda Painel</nav><h2>Histórico - Publicações por Data</h2><div>Detalhamento da(s) 2 publicações selecionadas <a href="#">Voltar para Seleção</a></div><p>Sua pesquisa retornou <b>2</b> publicações. Exibindo resultados de 1 a 2.</p>`
 +pub('19/11/2026','23/11/2026','Diário da Justiça de São Paulo','DJEN - Diário de Justiça Eletrônico Nacional - TJSP','Tribunal de Justiça de São Paulo - DJEN','Foro de Bauru - 2ª Vara de Família e Sucessões','Intimação','1099991-01.2025.8.26.0071','PROCESSO: 1099991-01.2025.8.26.0071 - CUMPRIMENTO DE SENTENcA - || Processo Sigiloso. Para visualizacao do documento, consulte os autos digitais. ||| POLO ATIVO: SIGILO-1 POLO PASSIVO: SIGILO-2 ADVOGADO: <b>GUILHERME LUCCAS GARCIA</b> - OAB: 355980/SP Acesso ao documento: https://www.dje.tjsp.jus.br Identificador do documento: 000000001')
 +pub('18/11/2026','19/11/2026','Diário Eletrônico da Justiça do Trabalho','TRT 15ª Região','Judiciário - TRT15','2ª Câmara','Pauta de Julgamento','0099992-02.2025.5.15.0090','Pauta da Sessão Ordinária Híbrida de Julgamento da 2ª Câmara do dia 01/12/2026, às 10h35. RECORRENTE CLIENTE EXEMPLO ADVOGADO GUILHERME LUCCAS GARCIA (OAB: 355980/SP)')
 +'<div>Selecionar todas · Exportar todas · Enviar todas · Imprimir todas</div></body></html>';
const tipos={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000},serviceWorkers:'block'});
await ctx.route('**/*',r=>{const u=new URL(r.request().url());
  if(u.host==='guiluccas2.github.io'&&u.pathname.startsWith('/meu-escritorio/')){const f=path.resolve(__dirname,'..',decodeURIComponent(u.pathname.slice(16))||'index.html');if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});return r.fulfill({body:fs.readFileSync(f),contentType:tipos[path.extname(f)]||'application/octet-stream'});}
  if(u.host==='recortedigital.oabsp.org.br')return r.fulfill({body:DET,contentType:'text/html; charset=utf-8'});
  if(u.host==='evil.example')return r.fulfill({body:'<html><body>outro site</body></html>',contentType:'text/html'});
  return r.abort();});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('https://guiluccas2.github.io/meu-escritorio/index.html');await p.waitForTimeout(700);await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.monitor=[];db.meta.workflows=[];upsert('processos',{clienteId:MP.ed.id,titulo:'Cumprimento de sentença',numero:'1099991-01.2025.8.26.0071',status:'Ativo',seq:'2',partes:[],testemunhas:[]});
  upsert('processos',{clienteId:MP.hi.id,titulo:'Recurso ordinário',numero:'0099992-02.2025.5.15.0090',status:'Arquivado definitivamente',seq:'2',partes:[],testemunhas:[]});save();});
await p.waitForTimeout(400);
// o formulário mostra o botão (favorito) com o endereço do app
await p.evaluate(()=>{go('#/publicacoes');render();A.pubImportar();});await p.waitForTimeout(200);
const href=await p.getAttribute('#rsBookmarklet','href');if(!href||!href.startsWith('javascript:'))ERR.push('sem botão do navegador');
const code=decodeURIComponent(href.slice(11));if(!code.includes('"https://guiluccas2.github.io/meu-escritorio/"'))ERR.push('endereço do app errado no botão');
// colar o texto da tela do site (innerText real do navegador)
const site=await ctx.newPage();await site.goto('https://recortedigital.oabsp.org.br/historico/Geral.aspx');
const txt=await site.evaluate(()=>document.body.innerText);
await p.fill('textarea[name=txt]',txt);await p.dispatchEvent('textarea[name=txt]','input');await p.waitForTimeout(150);
const prev=await p.textContent('#recPrev');console.log('prévia:',prev);if(!/2 publicação/.test(prev))ERR.push('prévia não reconheceu as 2');
const its=await p.evaluate(t=>recorteSiteParse(t).map(i=>({n:i.numero,d:i.disp,p:i.pub,dia:i.diario,t:i.tribunal,ti:i.titulo,l:i.link,tx:i.texto})),txt);
console.log(its.map(i=>`${i.n} ${i.d}/${i.p} ${i.dia} ${i.t} [${i.ti}] ${i.l}`));
if(its.length!==2||its[1].t!=='TRT15'||its[1].dia!=='DEJT'||its[0].t!=='TJSP'||its[0].l!=='https://www.dje.tjsp.jus.br'||its[0].ti!=='Intimação')ERR.push('leitura do site');
if(its.some(i=>/Enviar todas|Data de publica|Identificador|aviso|antecedência|Selecione|Anotações|Prioridade|Baixíssima|coment|Receber avisos|Excluir/.test(i.tx)))ERR.push('lixo no texto: '+its[0].tx);
await p.keyboard.press('Escape');
// botão do navegador: roda na página do Recorte, abre o app e manda as publicações
const msgs=[];site.on('dialog',d=>{msgs.push(d.message());d.accept();});
const popP=ctx.waitForEvent('page');await site.evaluate(code);const pop=await popP;pop.on('pageerror',e=>errs.push('pop: '+e.message));
for(let i=0;i<40&&!msgs.length;i++)await site.waitForTimeout(250);
console.log('botão →',msgs);if(!/2 publicação\(ões\) lida\(s\), 2 nova/.test(msgs[0]||''))ERR.push('botão: '+msgs[0]);
const noApp=await pop.evaluate(()=>db.monitor.filter(m=>m.tipo==='publicacao').map(m=>m.numero+' '+m.tribunal+' '+m.fonte+' '+(m.processoId?'vinculada':'SEM processo')));console.log('no app:',noApp);
if(noApp.length!==2||noApp.some(x=>/SEM processo/.test(x)))ERR.push('publicações não vinculadas');
// de novo: nada duplica
msgs.length=0;await site.evaluate(code);for(let i=0;i<40&&!msgs.length;i++)await site.waitForTimeout(250);
console.log('2ª vez →',msgs);if(!/0 nova/.test(msgs[0]||''))ERR.push('duplicou');
// mensagem de outro site é ignorada
const ev=await ctx.newPage();await ev.goto('https://evil.example/');
await ev.evaluate(()=>{const w=window.open('https://guiluccas2.github.io/meu-escritorio/#/publicacoes','meuEscRecorte');let n=0;const k=setInterval(()=>{try{w.postMessage({t:'meuEscRecorte',id:'x',txt:'Data de disponibilização: 19/11/2026\nNúmero do processo: 1099999-99.2025.8.26.0071\nfalso'},'*');}catch(e){}if(++n>8)clearInterval(k);},250);});
await ev.waitForTimeout(2600);const tot=await pop.evaluate(()=>db.monitor.length);if(tot!==2)ERR.push('aceitou mensagem de outro site');
// fora do site do Recorte, o botão só avisa
const ms2=[];ev.on('dialog',d=>{ms2.push(d.message());d.accept();});await ev.evaluate(code);if(!/Use este botão no site do Recorte/.test(ms2[0]||''))ERR.push('botão fora do site');
// publicações já salvas com o texto da janela “Agendar” são limpas (e as novas, ao entrar)
const limpeza=await pop.evaluate(()=>{const m=db.monitor.find(x=>x.tipo==='publicacao');m.texto+='\nReceber avisos por e-mail\nSim\nNão\nPrioridade\nBaixa\nAlterar\n|\nExcluir\nNovo comentário\nData / horário\nAnotações\n1º aviso\n[ Selecione ]\nNa hora do evento\n30 minutos de antecedência\n2º aviso\nNa hora do evento';
  const n=rsLimparSalvas();const novo={id:'teste-sujo',tipo:'publicacao',fonte:'Recorte OAB · DJEN',numero:'1099999-99.2025.8.26.0071',data:'2026-11-10',texto:'Intime-se.\nData / horário\nAnotações\n1º aviso\n10 dias de antecedência'};pubIncluir(novo);
  return {n,ok:!/aviso|antecedência|Anotações|Prioridade|Excluir|coment|\nSim/.test(m.texto+novo.texto),resto:m.texto.slice(-60)};});
console.log('limpeza:',limpeza);if(limpeza.n!==1||!limpeza.ok)ERR.push('limpeza das salvas');
// segurança do corte: texto de verdade com uma linha solta “Prioridade” fica intacto; janela antes do texto não apaga o texto
const seg=await pop.evaluate(()=>{const t1='Intime-se a parte autora para, no prazo de 15 dias, manifestar-se.\nPrioridade\nIdoso - art. 1.048 CPC';
  return {solta:rsLimpar(t1)===t1&&!rsSujo(t1),antes:/Intime-se/.test(rsLimpar('Receber avisos por e-mail\nPrioridade\nIntime-se a parte autora para manifestar-se no prazo de 5 dias.'))};});
console.log('segurança do corte:',seg);if(!seg.solta||!seg.antes)ERR.push('corte apagou texto de verdade');
// texto cortado pelo site (“…”): marca “texto incompleto”; quando chega o inteiro (mesmo id), troca; versão inteira escondida na página: fica só a inteira
const corte=await pop.evaluate(()=>{const id='rsite:10999910120258260071:2026-11-19:cortado',ini='Intime-se a parte autora para, no prazo de 15 dias, manifestar-se sobre a contestação e documentos juntados pela parte ré, sob pena de';
  db.monitor.push({id,tipo:'publicacao',fonte:'Recorte OAB · DJEN',status:'nova',numero:'1099991-01.2025.8.26.0071',data:'2026-11-19',tribunal:'TJSP',texto:ini+' …',criadoEm:'2026-11-19'});
  go('#/publicacoes');render();const marca=/texto incompleto/.test(document.getElementById('view').innerHTML);
  pubIncluir({id,tipo:'publicacao',texto:ini+' preclusão. ADVOGADO: GUILHERME LUCCAS GARCIA - OAB: 355980/SP. Intime-se.'});const it=byId('monitor',id);render();
  const oculto=recorteSiteParse('Data de disponibilização: 19/11/2026\nNúmero do processo: 1099991-01.2025.8.26.0071\n'+ini+' …\n'+ini+' preclusão. ADVOGADO: GUILHERME LUCCAS GARCIA. Intime-se.')[0].texto;
  return {marca,trocou:/preclusão/.test(it.texto)&&!/…/.test(it.texto),semMarca:!/texto incompleto/.test(document.getElementById('view').innerHTML),oculto:!/…/.test(oculto)&&/preclusão/.test(oculto)};});
console.log('texto cortado:',corte);if(!corte.marca||!corte.trocou||!corte.semMarca||!corte.oculto)ERR.push('texto cortado: '+JSON.stringify(corte));
// publicação salva antes com o começo repetido (cortada + inteira) é corrigida
const rep=await pop.evaluate(()=>{const ini='Pauta da Sessão Ordinária Híbrida de Julgamento da 2ª Câmara do dia 01/12/2026, às 10h35. O procurador que pretender realizar a suste';
  db.monitor.push({id:'rep1',tipo:'publicacao',fonte:'Recorte OAB · DEJT',numero:'0099992-02.2025.5.15.0090',data:'2026-11-18',texto:ini+' …\n'+ini+'ntação oral deverá se inscrever. ADVOGADO GUILHERME LUCCAS GARCIA',criadoEm:'2026-11-18'});
  rsLimparSalvas();const t=byId('monitor','rep1').texto;return {uma:(t.match(/O procurador/g)||[]).length===1,inteiro:/GUILHERME/.test(t)};});
console.log('começo repetido:',rep);if(!rep.uma||!rep.inteiro)ERR.push('começo repetido');
// linha de situação e celular
await pop.evaluate(()=>{go('#/publicacoes');render();});const sit=await pop.evaluate(()=>document.getElementById('view').innerText.match(/Recorte OAB:[^\n]*/)?.[0]||'');console.log('situação:',sit);if(!/botão \d/.test(sit))ERR.push('situação sem botão');
await pop.setViewportSize({width:390,height:800});await pop.evaluate(()=>A.pubImportar());await pop.waitForTimeout(200);
const larg=await pop.evaluate(()=>document.documentElement.scrollWidth);if(larg>390)ERR.push('celular: largura '+larg);
await pop.screenshot({path:'/tmp/claude-0/trecorte_cel.png'});
console.log('ERROS',[...ERR,...errs]);await b.close();process.exit(0);})();
