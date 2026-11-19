const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');
const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:900}});await ctx.route('https://comunicaapi.pje.jus.br/**',r=>r.abort());
await ctx.grantPermissions(['notifications','clipboard-read','clipboard-write'],{origin:'file://'}).catch(()=>{});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.evaluate(`(function(){const t=today();${seed}})()`);await p.evaluate(()=>{save();render();});
await p.waitForTimeout(3000);
console.log('ícones:', await p.evaluate(()=>[...document.querySelectorAll('#tbar .ti')].map(b=>b.textContent.trim()).join(' ')), '| badge:', await p.evaluate(()=>{const b=document.getElementById('notifBd');return b.hidden?'oculto':b.textContent;}));
// ---- notificações
await p.click('#ntBtn');await p.waitForTimeout(200);
console.log('notifs:', await p.evaluate(()=>[...document.querySelectorAll('#ntPop .nt')].map(n=>(n.classList.contains('new')?'*':'')+n.querySelector('.t').textContent).join(' | ')));
await p.screenshot({path:SS+'n-notif.png'});
await p.click('#ntLer');await p.waitForTimeout(100);
console.log('após ler, novas:', await p.evaluate(()=>document.querySelectorAll('#ntPop .nt.new').length));
await p.click('[data-nta=novidades]');console.log('aba novidades:', await p.evaluate(()=>document.querySelectorAll('#ntPop .nt').length));
await p.click('#ntFechar');await p.waitForTimeout(100);
console.log('badge depois:', await p.evaluate(()=>{const b=document.getElementById('notifBd');return b.hidden?'oculto':b.textContent;}));
// notificação do navegador (captura)
const env=await p.evaluate(()=>{Object.defineProperty(Notification,'permission',{get:()=>'granted'});const out=[];window.ntEnviar=(t,c,h,tag)=>out.push(t);ntEnviar.__x=1;window.__out=out;
  const ev=db.prazos.find(x=>x.hora);const d=new Date(Date.now()+10*60000);ev.data=today();ev.hora=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');ev.concluido=false;save();
  db.monitor.push({id:'pubX',tipo:'publicacao',status:'nova',numero:'1',titulo:'Intimação',data:today()});
  return Notification.permission;});
await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('escritorio_notif')||'{}');delete s.enviados;localStorage.setItem('escritorio_notif',JSON.stringify(s)); ntVerificar(); });
console.log('permissão:',env,'| enviados:', await p.evaluate(()=>JSON.stringify(window.__out)));
await p.evaluate(()=>ntVerificar());console.log('sem repetir:', await p.evaluate(()=>window.__out.length));
// ---- calculadora
await p.click('#clBtn');await p.waitForTimeout(200);
await p.fill('#clData','2026-11-18');await p.fill('#clDias','15');await p.dispatchEvent('#clDias','input');
console.log('calc pub:', (await p.innerText('#clRes')).replace(/\n/g,' / ').slice(0,200));
await p.selectOption('#clModo','disp');console.log('calc disp:', (await p.innerText('#clRes')).split('\n').slice(0,3).join(' / '));
await p.screenshot({path:SS+'n-calc.png'});
await p.click('[data-cla=correcao]');console.log('aba correção:', (await p.innerText('#clCorpo')).replace(/\n/g,' ').slice(0,40));
await p.click('[data-cla=prazo]');await p.click('#clCriar');await p.waitForTimeout(200);
console.log('criar prazo:', await p.textContent('#mTitle'), await p.inputValue('[name=data]'));
await p.click('#mCancel');
// ---- leak: abrir gcal config e depois outro formulário
await p.evaluate(()=>formGoogleAgenda());await p.click('#mCancel');await p.evaluate(()=>formPrazo({}));await p.fill('[name=titulo]','x');await p.dispatchEvent('[name=titulo]','input');await p.click('#mCancel');
// ---- assistente (cliente simulado)
await p.evaluate(()=>{localStorage.setItem('escritorio_ia_key','sk-ant-teste');
  window.iaClient=async()=>({Anthropic:{AuthenticationError:class{},PermissionDeniedError:class{},RateLimitError:class{},BadRequestError:class{},APIConnectionError:class{},APIError:class{}},
    client:{messages:{stream:(req)=>{window.__req=req;const h={};return {on:(e,f)=>{h[e]=f;},finalMessage:async()=>{const t='**Resumo:** processo em fase de instrução.\n- Próximo passo: audiência.';for(const c of t.match(/.{1,8}/gs)) h.text&&h.text(c);return {content:[{type:'text',text:t}],usage:{input_tokens:3000,output_tokens:400},stop_reason:'end_turn'};}};}}}});});
await p.evaluate(()=>go('#/processo/'+MP.p1.id));await p.waitForTimeout(300);
await p.click('#asBtn');await p.waitForTimeout(200);
console.log('contexto:', await p.evaluate(()=>document.querySelector('#asCtxSel').selectedOptions[0].textContent), '| crédito:', (await p.innerText('.asCred')).slice(0,80));
await p.click('[data-assug]');await p.click('#asEnviar');await p.waitForTimeout(500);
console.log('req:', await p.evaluate(()=>JSON.stringify({m:__req.model,eff:__req.output_config.effort,ctx:__req.messages[0].content.includes('PROCESSO:'),cpf:/CPF/.test(__req.messages[0].content)})));
console.log('resposta:', (await p.innerText('.mA')).split('\n')[0], '| ações:', await p.evaluate(()=>[...document.querySelectorAll('.mA .acts button')].map(b=>b.textContent).join(', ')));
console.log('gasto:', await p.evaluate(()=>JSON.stringify(db.iauso)), (await p.innerText('.asCred')).slice(0,60));
await p.click('#asSaldo');await p.fill('[name=valor]','10');await p.fill('[name=cotacao]','5.5');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(200);
await p.click('#asBtn');await p.waitForTimeout(100);if(!await p.$('#asDr')) await p.click('#asBtn');
console.log('saldo:', (await p.innerText('.asCred')).replace(/\n/g,' '));
await p.screenshot({path:SS+'n-ia.png'});
// sem contexto
await p.uncheck('#asCtxOn');await p.fill('#asIn','Oi');await p.press('#asIn','Enter');await p.waitForTimeout(400);
console.log('2ª msg sem ctx ok:', await p.evaluate(()=>__req.messages.length));
// salvar como andamento
await p.evaluate(()=>{document.querySelectorAll('[data-asa=and]')[0].click();});await p.waitForTimeout(200);
console.log('andamento:', await p.textContent('#mTitle'), (await p.inputValue('[name=descricao]')).slice(0,30));await p.click('#mCancel');
// abrir no claude
const [pop]=await Promise.all([ctx.waitForEvent('page'),p.evaluate(()=>{asAbrir();}).then(()=>p.click('#asClaude'))]);console.log('claude url:', pop.url().slice(0,40));await pop.close();
// ---- importar antigos
await p.evaluate(()=>{if(document.getElementById('asDr')) asAbrir();});
await p.evaluate(()=>go('#/importar'));await p.waitForTimeout(300);
await p.fill('#impTexto',`Processo 1001234-56.2015.8.26.0114 Procedimento Comum Cível\nAutor: Fulano\n0010999-11.2014.5.15.0001 Reclamação Trabalhista\n${await p.evaluate(()=>MP.p1.numero)}\n00109991120145150001 repetido`);
await p.click('[data-act=impAnalisar]');await p.waitForTimeout(200);
console.log('análise:', (await p.innerText('.card:nth-of-type(2) .toolbar')).replace(/\n/g,' '));
await p.click('[data-act=impAddColados]');await p.waitForTimeout(200);
console.log('fila:', await p.evaluate(()=>db.importar.map(i=>i.numero+' '+i.tribunal).join(' | ')));
await p.screenshot({path:SS+'n-imp.png',fullPage:true});
await p.click('[data-act=impCadastrar]');await p.waitForTimeout(300);console.log('cadastrar:', await p.textContent('#mTitle'), await p.inputValue('[name=numero]'));await p.click('#mCancel');
// ---- horas faturável/valor
await p.evaluate(()=>{upsert('horas',{data:today(),min:120,atividade:'Petição',fat:true});upsert('horas',{data:today(),min:60,atividade:'Estudo / pesquisa',fat:false});go('#/horas');});await p.waitForTimeout(300);
await p.fill('#fhValor','300');console.log('valor:', await p.textContent('#fhValorRes'), '| tag:', await p.evaluate(()=>[...document.querySelectorAll('td .tag')].map(t=>t.textContent).join()));
// mobile
const m=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const mp=await m.newPage();mp.on('pageerror',e=>errs.push('M '+e.message));
await mp.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await mp.evaluate(`(function(){const t=today();${seed}})()`);await mp.evaluate(()=>{save();render();});await mp.waitForTimeout(500);
console.log('mobile overflow:', await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth), '| ícones visíveis:', await mp.evaluate(()=>[...document.querySelectorAll('#tbar .ti')].filter(b=>getComputedStyle(b).display!=='none').map(b=>b.textContent.trim()[0]+b.textContent.trim()[1]).join(' ')));
await mp.screenshot({path:SS+'n-mob.png',clip:{x:0,y:0,width:390,height:200}});
await mp.click('#asBtn');await mp.waitForTimeout(200);await mp.screenshot({path:SS+'n-mob-ia.png'});
await mp.click('#asFechar');await mp.click('#ntBtn');await mp.waitForTimeout(200);await mp.screenshot({path:SS+'n-mob-notif.png'});
console.log('errs',errs);await b.close();})();
