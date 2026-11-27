// Lead: ao cumprir a tarefa de retorno (caixinha, “✔ concluir” ou situação “Realizado” no formulário) abre “Contato com o lead cumprido”
// com o próximo contato (data, lembrete, mensagem); cria tarefa NOVA (a cumprida não reabre), registra o contato no histórico; cabe em 390 px
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});
await ctx.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
const cria=nome=>p.evaluate(nome=>{const l=upsert('leads',{nome,telefone:'14999990000',status:'Em contato',proximoContato:today(),lembrete:true,msgContato:'oi'});sincronizarLembreteLead(byId('leads',l.id));save();return {lid:l.id,pid:byId('leads',l.id).prazoId};},nome);
// 1) “✔ concluir”
const a=await cria('Lead Cumprido A');if(!a.pid)ERR.push('tarefa do lead não criada');
await p.evaluate(id=>A.prazoConcluir({id}),a.pid);await p.waitForTimeout(400);
const t1=await p.evaluate(()=>({tit:document.getElementById('mTitle').textContent,foot:[...document.querySelectorAll('#mForm .mfoot button')].map(x=>x.textContent.trim()),msg:mForm.elements.msgContato?.value||'',chk:mForm.elements.lembrete?.checked}));
console.log('form:',t1);if(!/Contato com o lead cumprido/.test(t1.tit))ERR.push('não abriu o formulário ao cumprir');
if(!/Olá, Lead!/.test(t1.msg))ERR.push('mensagem padrão ausente');if(!t1.chk)ERR.push('lembrete não vem marcado');
const larg=await p.evaluate(()=>{let m=0;document.querySelectorAll('#modal *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.right>m)m=r.right;});return Math.round(m);});console.log('largura:',larg);if(larg>390)ERR.push('passa de 390 px');
const d3=await p.evaluate(()=>addDays(today(),3));
await p.fill('[name=relato]','Pediu para ligar depois');await p.fill('[name=proximoContato]',d3);await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(400);
const r1=await p.evaluate(({lid,pid})=>{const l=byId('leads',lid),n=byId('prazos',l.prazoId),v=byId('prazos',pid);return {novo:l.prazoId!==pid,nData:n&&n.data,nPend:n&&!n.concluido,velho:v&&v.concluido,prox:l.proximoContato,conv:db.conversas.filter(c=>c.leadId===lid).map(c=>c.relato)};},a);
console.log('depois:',r1);if(!r1.novo||r1.nData!==d3||!r1.nPend)ERR.push('não criou tarefa nova para o próximo contato');if(!r1.velho)ERR.push('reabriu a tarefa cumprida');
if(r1.prox!==d3)ERR.push('lead sem a data nova');if(!r1.conv.includes('Pediu para ligar depois'))ERR.push('contato não foi para o histórico');
// editar o lead depois não reabre nem duplica
await p.evaluate(lid=>{sincronizarLembreteLead(byId('leads',lid));},a.lid);const n1=await p.evaluate(lid=>db.prazos.filter(x=>x.leadId===lid).length,a.lid);if(n1!==2)ERR.push('sincronizar de novo duplicou ('+n1+')');
// 2) “Agora não”: nada muda, tarefa fica cumprida
const b2=await cria('Lead Cumprido B');await p.evaluate(id=>A.prazoConcluir({id}),b2.pid);await p.waitForTimeout(400);
const cn=await p.evaluate(()=>document.getElementById('mCancel').textContent);if(cn!=='Agora não')ERR.push('botão “Agora não” ausente');
await p.click('#mCancel');await p.waitForTimeout(200);
const r2=await p.evaluate(({lid,pid})=>({c:byId('prazos',pid).concluido,n:db.prazos.filter(x=>x.leadId===lid).length}),b2);if(!r2.c||r2.n!==1)ERR.push('“Agora não” mudou algo');
// editar o lead (mesma data) não reabre a tarefa cumprida
await p.evaluate(lid=>{upsert('leads',{id:lid,area:'Cível'});sincronizarLembreteLead(byId('leads',lid));},b2.lid);
if(!(await p.evaluate(pid=>byId('prazos',pid).concluido,b2.pid)))ERR.push('editar o lead reabriu a tarefa cumprida');
// 3) etapa Fechado: esconde o próximo contato e não cria tarefa
const c3=await cria('Lead Cumprido C');await p.evaluate(id=>A.togglePrazo({id},{checked:true}),c3.pid);await p.waitForTimeout(700);
if(!/Contato com o lead cumprido/.test(await p.evaluate(()=>document.getElementById('mTitle').textContent)))ERR.push('caixinha não abriu o formulário');
await p.selectOption('[name=status]','Fechado');const vis=await p.evaluate(()=>mForm.elements.proximoContato.closest('.fld').style.display);if(vis!=='none')ERR.push('Fechado não escondeu o próximo contato');
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(300);
const r3=await p.evaluate(lid=>({st:byId('leads',lid).status,n:db.prazos.filter(x=>x.leadId===lid&&!x.concluido).length}),c3.lid);if(r3.st!=='Fechado'||r3.n)ERR.push('Fechado: '+JSON.stringify(r3));
// 4) formulário do compromisso com situação Realizado + “Salvar e continuar →” leva aos próximos passos
const d4=await cria('Lead Cumprido D');await p.evaluate(id=>formPrazo(byId('prazos',id)),d4.pid);await p.waitForTimeout(300);
await p.selectOption('[name=situacao]','Realizado');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(800);
if(!/Contato com o lead cumprido/.test(await p.evaluate(()=>document.getElementById('mTitle').textContent)))ERR.push('formulário do compromisso não abriu o próximo contato');
await p.fill('[name=proximoContato]',d3);await p.click('#lcCont');await p.waitForTimeout(500);
if(!/Próximos passos do lead/.test(await p.evaluate(()=>document.getElementById('mTitle').textContent)))ERR.push('Salvar e continuar não abriu os próximos passos');
// 5) tarefa comum (sem lead) não abre nada
await p.click('#mCancel');const t5=await p.evaluate(()=>{const x=upsert('prazos',{titulo:'Tarefa comum',tipo:'Tarefa',data:today(),situacao:'Pendente'});A.prazoConcluir({id:x.id});return document.getElementById('modal').classList.contains('hidden');});
if(!t5)ERR.push('tarefa comum abriu formulário');
console.log('errs',errs);console.log('ERROS',ERR);await b.close();})();
