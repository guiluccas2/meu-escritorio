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
// envio direto desligado: o aviso diz isso
await p.evaluate(()=>{db.meta.gcal={...db.meta.gcal,modo:'link'};save();formLead({});});await p.waitForTimeout(200);
await p.fill('[name=nome]','Lead Sem Direto');await p.fill('[name=proximoContato]',await p.evaluate(()=>addDays(today(),3)));await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(300);
const t2=await p.evaluate(()=>_toasts.slice(-3).join(' | '));console.log('sem envio direto:',t2);if(!/desligado/.test(t2))ERR.push('não avisou que o envio direto está desligado');
console.log('ERROS',[...ERR,...errs]);await b.close();})();
