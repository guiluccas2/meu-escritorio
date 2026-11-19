// Publicações: recorte da OAB (robô e colar texto), DJEN por nome e por processo, sem duplicar, avisos de problema, compartilhar/exportar
const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const rec=fs.readFileSync(__dirname+'/recorte-exemplo.txt','utf8');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});
const log=[];let djenFalha=false;
await ctx.route('https://comunicaapi.pje.jus.br/**',async r=>{const u=new URL(r.request().url());const q=Object.fromEntries(u.searchParams);log.push('djen:'+(q.numeroOab?'oab':q.nomeAdvogado?'nome':q.numeroProcesso?'proc':'?'));
  if(djenFalha) return r.fulfill({status:400,body:'{}'});
  const base={siglaTribunal:'TJSP',nomeOrgao:'2ª Vara de Família',tipoComunicacao:'Intimação',data_disponibilizacao:'2026-11-19',link:'https://comunica.pje.jus.br/x'};
  let items=[];
  if(q.numeroOab) items=[{...base,id:111,numeroprocessocommascara:'1099991-01.2025.8.26.0071',texto:'PROCESSO: 1099991-01.2025.8.26.0071 - CUMPRIMENTO DE SENTENcA Processo Sigiloso. Para visualizacao do documento, consulte os autos digitais. POLO ATIVO: SIGILO-1 POLO PASSIVO: SIGILO-2 ADVOGADO: GUILHERME LUCCAS GARCIA - OAB: 355980/SP'}];
  if(q.nomeAdvogado) items=[{...base,id:222,numeroprocessocommascara:'1000001-11.2026.8.26.0100',texto:'Edital. Intimem-se. ADVOGADO GUILHERME LUCCAS GARCIA'}];
  if(q.numeroProcesso==='10999910120258260071') items=[{...base,id:333,numeroprocessocommascara:'1099991-01.2025.8.26.0071',texto:'Intime-se a parte requerida, por seu advogado FULANO DE TAL OAB 999999/SP, para pagar.'}];
  await r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({items})});});
await ctx.route('https://script.google.com/**',async r=>{const req=r.request();let out={ok:true};
  if(req.method()==='POST'){const bd=JSON.parse(req.postData()||'{}');if(bd.alerta)log.push('alertaEmail:'+bd.alerta.chave);}
  else{const q=new URL(req.url()).searchParams;if(q.get('acao')==='itens'){out={ok:true,versao:7,recorteUlt:'2026-11-19T09:40:00Z',alertas:[{chave:'recorte-formato',titulo:'Recorte Digital: e-mail com publicações não reconhecidas',texto:'teste'}],itens:[
    {id:'rec:00999920220255150090:2026-11-18:x',tipo:'publicacao',fonte:'Recorte OAB · DEJT',numero:'0099992-02.2025.5.15.0090',data:'2026-11-18',tribunal:'TRT15',orgao:'Tribunal Regional do Trabalho - 15ª Região - SP - 2ª CÂMARA',titulo:'Pauta de Julgamento',texto:'Pauta de Julgamento ... ADVOGADO GUILHERME LUCCAS GARCIA (OAB: 355980/SP)',link:'',capturadoEm:'2026-11-19T09:41:00Z',pubEm:'2026-11-19'},
    {id:'rec:10999910120258260071:2026-11-19:y',tipo:'publicacao',fonte:'Recorte OAB · DJEN',numero:'1099991-01.2025.8.26.0071',data:'2026-11-19',tribunal:'TJSP',orgao:'Tribunal de Justiça de São Paulo - DJEN',titulo:'Intimação',texto:'Intimação PROCESSO: 1099991-01.2025.8.26.0071 - CUMPRIMENTO DE SENTENcA Processo Sigiloso. Para visualizacao do documento, consulte os autos digitais. POLO ATIVO: SIGILO-1 POLO PASSIVO: SIGILO-2 ADVOGADO: GUILHERME LUCCAS GARCIA - OAB: 355980/SP ADVOGADO: EXEMPLO',link:'https://www.dje.tjsp.jus.br',capturadoEm:'2026-11-19T09:41:00Z',pubEm:'2026-11-23'}]};}}
  await r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(out)});});
await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.monitor=[];db.meta.workflows=[];const pr=upsert('processos',{clienteId:MP.ed.id,titulo:'Cumprimento de sentença',numero:'1099991-01.2025.8.26.0071',status:'Ativo',seq:'2',partes:[],testemunhas:[]});
  upsert('processos',{clienteId:MP.hi.id,titulo:'Recurso ordinário',numero:'0099992-02.2025.5.15.0090',status:'Arquivado definitivamente',seq:'2',partes:[],testemunhas:[]});
  db.meta.monitor={...db.meta.monitor,roboUrl:'https://script.google.com/macros/s/X/exec',roboToken:'tok',ativo:true};save();window.open=(u)=>{window._aberto=u;return null};});
const v=(s,a)=>p.evaluate(s,a);
// DJEN por OAB + extra (nome e processo)
await v(async()=>{await djenBuscar('manual');await djenBuscarExtra('manual');});
console.log('djen consultas:',[...new Set(log)].join(','));
console.log('após DJEN:',await v(()=>db.monitor.map(m=>m.numero+' '+m.tribunal+(m.outraParte?' [não cita]':'')+' ['+pubFontes(m)+']').join(' | ')));
// robô traz recorte: TRT15 novo + TJSP repetido
await v(async()=>{await roboSincronizar('manual');});
console.log('após recorte:',await v(()=>db.monitor.filter(m=>m.tipo==='publicacao').map(m=>m.numero.slice(0,7)+' '+m.tribunal+' disp '+m.data+' pub '+pubDataPub(m)+' ['+pubFontes(m)+']').join(' | ')));
console.log('contagem 1099991 (OAB+recorte+processo):',await v(()=>db.monitor.filter(m=>m.numero.startsWith('1099991')).length));
// colar o texto do recorte de novo → nada novo
console.log('importar texto:',await v(t=>JSON.stringify(recorteImportar(t)),rec));
// tela
await v(()=>go('#/publicacoes'));await p.waitForTimeout(400);console.log('DEBUG view:',await v(()=>document.getElementById('view').innerText.slice(0,300).replace(/\n/g,' / ')), await v(()=>{try{VIEWS.publicacoes();return 'ok'}catch(e){return e.message}}));
console.log('tags fonte na tela:',await v(()=>[...document.querySelectorAll('#view .li .tag')].map(t=>t.textContent).filter(t=>/Recorte|DJEN|cita/.test(t)).join(' · ')));
console.log('avisos:',await v(()=>ntAvisos().filter(a=>/^pubfonte/.test(a.id)).map(a=>a.t).join(' | ')));
await p.screenshot({path:require('os').tmpdir()+'/pub_tela.png',fullPage:true});
// compartilhar
const id=await v(()=>db.monitor.find(m=>m.tribunal==='TRT15').id);
await v(id=>{const b=document.querySelector(`[data-act=pubSh][data-id="${id}"][data-f=wa]`);b.click();},id);console.log('whatsapp:',decodeURIComponent(await v(()=>window._aberto||'')).slice(0,170).replace(/\n/g,' / '));
await v(()=>{window._dl=[];window.download=(n,c)=>window._dl.push({n,c:String(c)});});
await v(id=>document.querySelector(`[data-act=pubSh][data-id="${id}"][data-f=doc]`).click(),id);console.log('word:',await v(()=>{const d=window._dl.at(-1);return d.n+' destaque='+/<mark>/.test(d.c)}));
await v(()=>{document.querySelector('[data-act=rel][data-k=pubs][data-f=xls]').click()});console.log('lote excel:',await v(()=>window._dl.at(-1).n+' · '+window._dl.at(-1).c.split('\n').length+' linhas'));
// falha do DJEN na busca por nome → aviso + e-mail
djenFalha=true;await v(async()=>{setMonLocal({djenNomeUlt:0});await djenBuscarExtra('manual');monAlertasEmail();});await p.waitForTimeout(500);
console.log('aviso de falha:',await v(()=>monAlertas().map(a=>a.k).join(',')),'| e-mail pedido ao robô:',log.filter(x=>x.startsWith('alertaEmail')).join(','));
// configuração preserva campos
await v(()=>A.monConfig());await p.waitForTimeout(300);console.log('config nomes:',await v(()=>mForm.elements.nomes.value),'porProc:',await v(()=>mForm.elements.porProc.checked));await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(200);
console.log('após salvar config, nomes:',await v(()=>monCfg().nomes.join(';')));
console.log('ERROS',errs);await b.close();})();
