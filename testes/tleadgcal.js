// Lead e Google Agenda com o envio sozinho DESLIGADO (decisão do usuário): salvar não manda nada; vai quando você pede
// (“Salvar e continuar →” → 📅 Enviar à Google Agenda, ou na ficha). O que já está lá é atualizado (nova data) e apagado (desmarcado).
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});const ops=[];
await ctx.route('**/*',async r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();
  if(u.startsWith('https://script.google.com/')){let out={ok:true};if(r.request().method()==='POST'){const bd=JSON.parse(r.request().postData()||'{}');if(bd.gcal){bd.gcal.ops.forEach(o=>ops.push(o));out={ok:true,gcal:bd.gcal.ops.map(o=>({id:o.id,ok:true,gcalId:'g_'+o.id,gcalCal:''}))};}}
    return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(out)});}
  return r.abort();});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
// configuração antiga com tudo marcado para ir sozinho: mesmo assim nada vai sozinho
await p.evaluate(()=>{db.meta.monitor={...db.meta.monitor,roboUrl:'https://script.google.com/macros/s/X/exec',roboToken:'tok'};
  db.meta.gcal={modo:'direto',ativadoEm:new Date(Date.now()-864e5).toISOString(),auto:{lead:1,Tarefa:1,'Prazo processual':1,'Audiência':1,'Reunião':1}};db.meta.leadGcalMig=false;save();
  window._toasts=[];const o=toast;toast=m=>{_toasts.push(m);o(m);};});
const nome1='Lead Teste Agenda',lid=()=>p.evaluate(n=>db.leads.find(x=>x.nome===n).id,nome1),pzDe=n=>p.evaluate(n=>{const l=db.leads.find(x=>x.nome===n);return l&&byId('prazos',l.prazoId);},n);
await p.evaluate(()=>formLead({}));await p.waitForTimeout(200);
await p.fill('[name=nome]',nome1);await p.fill('[name=telefone]','14999990000');await p.fill('[name=proximoContato]',await p.evaluate(()=>addDays(today(),3)));
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(2500);
await p.evaluate(()=>{upsert('prazos',{titulo:'Reunião nova',tipo:'Reunião',data:addDays(today(),4),hora:'10:00'});upsert('prazos',{titulo:'Prazo novo',tipo:'Prazo processual',data:addDays(today(),6)});});
await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(500);await p.evaluate(()=>gcalRetomar(50));await p.waitForTimeout(800);
console.log('enviados sem pedir:',ops.map(o=>o.titulo),'· aviso:',await p.evaluate(()=>_toasts.slice(-1)[0]));
if(ops.length)ERR.push('algo foi sozinho para a Google Agenda');
if(/Google Agenda/.test(await p.evaluate(()=>_toasts.join('|'))))ERR.push('caixa da Google Agenda desmarcada: o aviso não deve falar da Google Agenda');
if(await p.evaluate(()=>leadLembretesGcal())!==0)ERR.push('migração antiga ainda pede envio');
if(await p.evaluate(()=>gcalPendentes().length))ERR.push('há pendentes sem pedido');
// ficha: botão de enviar
const tag=await p.evaluate(async n=>leadGcalTag(byId('prazos',db.leads.find(x=>x.nome===n).prazoId)),nome1);if(!/enviar à Google Agenda/.test(tag))ERR.push('ficha sem botão de enviar: '+tag);
// pedido: vai na hora e confirma
await p.evaluate(async n=>gcalEnviarAgora(db.leads.find(x=>x.nome===n).prazoId),nome1);await p.waitForTimeout(800);
let pz=await pzDe(nome1);console.log('pedido:',!!pz.gcalId,ops.map(o=>o.acao+':'+o.titulo));
if(!pz.gcalId||!ops.some(o=>o.acao==='salvar'&&/Contato com o lead: Lead Teste Agenda/.test(o.titulo)))ERR.push('pedido não gravou na Google Agenda');
if(!/Salvo na sua Google Agenda/.test(await p.evaluate(()=>_toasts.join('|'))))ERR.push('não confirmou a gravação');
if(!/na Google Agenda/.test(await p.evaluate(p=>leadGcalTag(p),pz)))ERR.push('ficha não mostra ✔ na Google Agenda');
// mudar a data atualiza o mesmo evento (sem pedir de novo)
ops.length=0;const id1=await lid();await p.evaluate(id=>{upsert('leads',{id,proximoContato:addDays(today(),5)});sincronizarLembreteLead(byId('leads',id));},id1);
await p.waitForTimeout(2200);await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(400);
console.log('reagendado:',ops.map(o=>o.acao+':'+o.data+(o.gcalId?' (mesmo evento)':'')));if(ops.length!==1||!ops[0].gcalId)ERR.push('nova data não atualizou o mesmo evento');
// desmarcar a caixa apaga da Google Agenda
ops.length=0;await p.evaluate(id=>{upsert('leads',{id,lembrete:false});sincronizarLembreteLead(byId('leads',id));},id1);
await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(400);console.log('desmarcado:',ops.map(o=>o.acao));if(!ops.some(o=>o.acao==='apagar'))ERR.push('desmarcar não tirou da Google Agenda');
// marcar de novo cria o lembrete, mas não manda sozinho
ops.length=0;await p.evaluate(id=>{upsert('leads',{id,lembrete:true});sincronizarLembreteLead(byId('leads',id));},id1);
await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(400);if(ops.some(o=>o.acao==='salvar'))ERR.push('remarcado foi sozinho');
// erro recente não impede o pedido; pedido durante outra gravação não se perde
await p.evaluate(()=>setGcalEst({erro:'erro passageiro',tent:Date.now()}));await p.evaluate(async n=>gcalEnviarAgora(db.leads.find(x=>x.nome===n).prazoId),nome1);await p.waitForTimeout(800);
if(!(await pzDe(nome1)).gcalId)ERR.push('erro recente impediu o pedido');
await p.evaluate(()=>{const o=roboChamar;roboChamar=(...a)=>new Promise(r=>setTimeout(r,1200)).then(()=>o(...a));const x=db.prazos.find(y=>y.titulo==='Reunião nova');gcalEnviarAgora(x.id);
  const l=upsert('leads',{nome:'Lead Durante Envio',status:'Novo',proximoContato:addDays(today(),2),lembrete:true});sincronizarLembreteLead(byId('leads',l.id));gcalEnviarAgora(byId('leads',l.id).prazoId);});
await p.waitForTimeout(4500);const dur=await pzDe('Lead Durante Envio');console.log('durante outro envio:',!!dur.gcalId);if(!dur.gcalId)ERR.push('pedido durante outro envio se perdeu');
// pedido que ficou pendente (sem internet / app fechado) é retomado
await p.evaluate(()=>{const l=upsert('leads',{nome:'Lead Pendente',status:'Novo',proximoContato:addDays(today(),2),lembrete:true});sincronizarLembreteLead(byId('leads',l.id));upsert('prazos',{id:byId('leads',l.id).prazoId,gcalPedido:true});clearTimeout(gcalTimer);});
await p.evaluate(()=>gcalRetomar(100));await p.waitForTimeout(2000);const pend=await pzDe('Lead Pendente');console.log('pendente retomado:',!!pend.gcalId);if(!pend.gcalId)ERR.push('pedido pendente não foi retomado');
// configuração: o envio sozinho não aparece; o resumo explica
await p.evaluate(()=>formGoogleAgenda());await p.waitForTimeout(200);
const cfgTxt=await p.evaluate(()=>mForm.innerText);if(/Enviar sozinho/.test(cfgTxt)||!/Nada vai sozinho/.test(cfgTxt))ERR.push('configuração ainda oferece envio sozinho');
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(800);
if(!/só quando você pedir/.test(await p.evaluate(()=>gcalResumo())))ERR.push('resumo sem a explicação');
console.log('ERROS',[...ERR,...errs]);await b.close();})();
