// Lead com “Criar lembrete na agenda (e na Google Agenda)”: o lembrete vai para a Google Agenda mesmo com o tipo “lembrete de lead” desmarcado nas configurações
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});const ops=[];
await ctx.route('**/*',async r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();
  if(u.startsWith('https://script.google.com/')){let out={ok:true};if(r.request().method()==='POST'){const bd=JSON.parse(r.request().postData()||'{}');if(bd.gcal){bd.gcal.ops.forEach(o=>ops.push(o));out={ok:true,gcal:bd.gcal.ops.map(o=>({id:o.id,ok:true,gcalId:'g_'+o.id,gcalCal:''}))};}}
    return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(out)});}
  return r.abort();});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.meta.monitor={...db.meta.monitor,roboUrl:'https://script.google.com/macros/s/X/exec',roboToken:'tok'};
  db.meta.gcal={modo:'direto',ativadoEm:new Date(Date.now()-864e5).toISOString(),auto:{lead:0,Tarefa:0}};db.meta.leadGcalMig=true;save();});
// cadastra o lead pelo formulário, com próximo contato e a caixa marcada
await p.evaluate(()=>{window._toasts=[];const o=toast;toast=m=>{_toasts.push(m);o(m);};formLead({});});await p.waitForTimeout(200);
await p.fill('[name=nome]','Lead Teste Agenda');await p.fill('[name=telefone]','14999990000');
await p.fill('[name=proximoContato]',await p.evaluate(()=>addDays(today(),3)));
console.log('caixa marcada:',await p.isChecked('[name=lembrete]'));
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(400);
const toastTxt=await p.evaluate(()=>_toasts.join(' | '));console.log('aviso:',toastTxt);
await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(500);
const st=await p.evaluate(()=>{const l=db.leads.find(x=>x.nome==='Lead Teste Agenda'),pz=byId('prazos',l.prazoId);return {temPrazo:!!pz,gcalId:pz&&pz.gcalId,pedido:pz&&pz.gcalPedido};});
console.log('lembrete:',st,'· enviados à Google Agenda:',ops.map(o=>o.acao+':'+o.titulo));
if(!st.temPrazo||!st.gcalId||!ops.some(o=>o.acao==='salvar'&&/Contato com o lead: Lead Teste Agenda/.test(o.titulo)))ERR.push('lembrete do lead não foi para a Google Agenda');
if(!/Google Agenda/.test(toastTxt))ERR.push('aviso não fala da Google Agenda');
// mudar a data do próximo contato atualiza o mesmo evento (não cria outro)
ops.length=0;await p.evaluate(()=>{const l=db.leads.find(x=>x.nome==='Lead Teste Agenda');upsert('leads',{id:l.id,proximoContato:addDays(today(),5)});sincronizarLembreteLead(byId('leads',l.id));});
await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(400);
console.log('reagendado:',ops.map(o=>o.acao+':'+o.data+(o.gcalId?' (mesmo evento)':'')));if(ops.length!==1||!ops[0].gcalId)ERR.push('reagendar criou outro evento');
// desmarcar a caixa tira da agenda e da Google Agenda
ops.length=0;await p.evaluate(()=>{const l=db.leads.find(x=>x.nome==='Lead Teste Agenda');upsert('leads',{id:l.id,lembrete:false});sincronizarLembreteLead(byId('leads',l.id));});
await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(400);console.log('desmarcado:',ops.map(o=>o.acao));if(!ops.some(o=>o.acao==='apagar'))ERR.push('desmarcar não tirou da Google Agenda');
// lembrete tirado da Google Agenda à mão não volta sozinho
ops.length=0;await p.evaluate(()=>{const l=db.leads.find(x=>x.nome==='Lead Teste Agenda');upsert('leads',{id:l.id,lembrete:true});sincronizarLembreteLead(byId('leads',l.id));const pz=byId('prazos',byId('leads',l.id).prazoId);upsert('prazos',{id:pz.id,gcalNao:true,gcalPedido:false});sincronizarLembreteLead(byId('leads',l.id));});
await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(400);console.log('tirado à mão:',ops.map(o=>o.acao));if(ops.some(o=>o.acao==='salvar'))ERR.push('voltou para a Google Agenda depois de tirado à mão');
// lembretes antigos (de antes da correção) passam a ir uma vez
ops.length=0;const n=await p.evaluate(()=>{const l=upsert('leads',{nome:'Lead Antigo',status:'Novo',proximoContato:addDays(today(),2),lembrete:true});const pz=upsert('prazos',{titulo:'📞 Contato com o lead: Lead Antigo',tipo:'Tarefa',data:addDays(today(),2),leadId:l.id,concluido:false});l.prazoId=pz.id;db.meta.leadGcalMig=false;return leadLembretesGcal();});
await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(400);console.log('antigos enviados:',n,ops.map(o=>o.titulo));if(n!==1||!ops.some(o=>/Lead Antigo/.test(o.titulo)))ERR.push('lembrete antigo não foi');
// sem chamar a sincronização à mão: salvar o lead já grava na Google Agenda e confirma no aviso
const novoLead=async(nome)=>{await p.evaluate(()=>formLead({}));await p.waitForTimeout(200);await p.fill('[name=nome]',nome);await p.fill('[name=proximoContato]',await p.evaluate(()=>addDays(today(),1)));await p.click('#mForm .mfoot button[type=submit]');};
const naAgenda=nome=>p.evaluate(n=>{const l=db.leads.find(x=>x.nome===n),pz=l&&byId('prazos',l.prazoId);return !!(pz&&pz.gcalId);},nome);
ops.length=0;await novoLead('Lead Sozinho');await p.waitForTimeout(2500);
console.log('sozinho:',await naAgenda('Lead Sozinho'),await p.evaluate(()=>_toasts.slice(-1)[0]));
if(!await naAgenda('Lead Sozinho'))ERR.push('salvar o lead não gravou sozinho na Google Agenda');
if(!/salvo na Google Agenda/.test(await p.evaluate(()=>_toasts.join('|'))))ERR.push('não confirmou que gravou na Google Agenda');
// houve erro há poucos minutos (antes esperava 10 min em silêncio): salvar o lead grava mesmo assim
await p.evaluate(()=>setGcalEst({erro:'erro passageiro',tent:Date.now()}));await novoLead('Lead Depois Do Erro');await p.waitForTimeout(2500);
console.log('depois de um erro:',await naAgenda('Lead Depois Do Erro'));if(!await naAgenda('Lead Depois Do Erro'))ERR.push('erro recente impediu o envio do lead');
// sincronização já em andamento na hora de salvar (antes o pedido era descartado)
await p.evaluate(()=>{const o=roboChamar;window._lento=true;roboChamar=(...a)=>new Promise(r=>setTimeout(r,1200)).then(()=>o(...a));upsert('prazos',{titulo:'Outro compromisso',tipo:'Reunião',data:addDays(today(),4),hora:'10:00'});gcalSincronizar(true);});
await novoLead('Lead Durante Envio');await p.waitForTimeout(5000);
console.log('durante outro envio:',await naAgenda('Lead Durante Envio'));if(!await naAgenda('Lead Durante Envio'))ERR.push('lead salvo durante outro envio não foi para a Google Agenda');
// app fechado / sem internet logo depois de salvar: o pendente é enviado ao voltar ao app
await p.evaluate(()=>{const l=upsert('leads',{nome:'Lead Pendente',status:'Novo',proximoContato:addDays(today(),2),lembrete:true});sincronizarLembreteLead(byId('leads',l.id));clearTimeout(gcalTimer);});
console.log('pendentes antes:',await p.evaluate(()=>gcalPendentes().map(x=>x.titulo)));
await p.evaluate(()=>gcalRetomar(100));await p.waitForTimeout(1500);
console.log('pendente retomado:',await naAgenda('Lead Pendente'));if(!await naAgenda('Lead Pendente'))ERR.push('lembrete pendente não foi retomado');
// ficha do lead mostra se está na Google Agenda / pendente com botão
const fichaOk=await p.evaluate(()=>{const l=db.leads.find(x=>x.nome==='Lead Pendente'),pz=byId('prazos',l.prazoId);const a=leadGcalTag(pz);const b=leadGcalTag({...pz,gcalId:''});return /na Google Agenda/.test(a)&&/pendente/.test(b)&&/enviar agora/.test(b);});
await p.evaluate(()=>{go('#/lead/'+db.leads.find(x=>x.nome==='Lead Pendente').id);});await p.waitForTimeout(300);
const fichaTxt=await p.evaluate(()=>document.querySelector('#view')?.innerText||document.body.innerText);
console.log('ficha:',fichaOk,/na Google Agenda/.test(fichaTxt));if(!fichaOk||!/na Google Agenda/.test(fichaTxt))ERR.push('ficha do lead não mostra a situação na Google Agenda');
// envio direto desligado: o aviso diz isso
await p.evaluate(()=>{db.meta.gcal={...db.meta.gcal,modo:'link'};save();formLead({});});await p.waitForTimeout(200);
await p.fill('[name=nome]','Lead Sem Direto');await p.fill('[name=proximoContato]',await p.evaluate(()=>addDays(today(),3)));await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(300);
const t2=await p.evaluate(()=>_toasts.slice(-3).join(' | '));console.log('sem envio direto:',t2);if(!/desligado/.test(t2))ERR.push('não avisou que o envio direto está desligado');
console.log('ERROS',[...ERR,...errs]);await b.close();})();
