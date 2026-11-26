// Ficha do processo / serviço / cliente: aba “Prazos e compromissos” com seções (prazos processuais · audiências e perícias · outros · concluídos recolhidos); cabe em 390 px
const {chromium}=require('playwright');const path=require('path');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);
const ids=await p.evaluate(()=>{const c=upsert('pessoas',{nome:'Cliente Seções',tipo:'Cliente',pasta:'P0900'});const pr=upsert('processos',{titulo:'Ação Seções',clienteId:c.id,seq:'1',status:'Ativo'});
  const sv=upsert('processos',{titulo:'Serviço Seções',clienteId:c.id,servico:true,seqServ:'1',statusServ:'Em andamento',status:'Ativo'});const d=n=>addDays(today(),n);
  [['Contestação','Prazo processual',{dataFatal:d(5)}],['Manifestação fatal','Tarefa',{dataFatal:d(8)}],['Audiência de instrução','Audiência',{}],['Perícia médica','Perícia',{}],['Reunião com o cliente','Reunião',{}],['Ligar para o cliente','Tarefa',{}],['Réplica antiga','Prazo processual',{concluido:true,situacao:'Realizado'}]]
    .forEach(([t,tp,x],i)=>upsert('prazos',{titulo:t,tipo:tp,processoId:pr.id,pessoaId:c.id,data:d(i+1),concluido:false,...x}));
  upsert('prazos',{titulo:'Entrega do parecer',tipo:'Tarefa',processoId:sv.id,data:d(3)});save();return {c:c.id,pr:pr.id,sv:sv.id};});
await p.evaluate(id=>{tabs.proc='prz';go('#/processo/'+id);},ids.pr);await p.waitForTimeout(400);
const r=await p.evaluate(()=>{const sec=s=>[...document.querySelectorAll(`.przSec[data-sec="${s}"] .li b, .przSec[data-sec="${s}"] .li a`)].map(x=>x.textContent).join('|');
  return {aba:[...document.querySelectorAll('.tabs *')].map(x=>x.textContent).join('|'),btn:document.body.innerText.includes('📅 Novo compromisso'),prazo:sec('prazo'),aud:sec('aud'),outro:sec('outro'),feito:sec('feito'),
    aberto:document.querySelector('details.przSec[data-sec="feito"]')?.open,larg:document.documentElement.scrollWidth};});
console.log(r);
if(!/Prazos e compromissos/.test(r.aba))ERR.push('aba sem o nome “Prazos e compromissos”');if(!r.btn)ERR.push('botão sem “Novo compromisso”');
if(!/Contestação/.test(r.prazo)||!/Manifestação fatal/.test(r.prazo)||/Audiência|Reunião/.test(r.prazo))ERR.push('seção de prazos processuais errada');
if(!/Audiência de instrução/.test(r.aud)||!/Perícia médica/.test(r.aud)||/Contestação/.test(r.aud))ERR.push('seção de audiências e perícias errada');
if(!/Reunião com o cliente/.test(r.outro)||!/Ligar para o cliente/.test(r.outro))ERR.push('seção de outros compromissos errada');
if(!/Réplica antiga/.test(r.feito)||r.aberto)ERR.push('concluídos fora da seção recolhida');if(r.larg>390)ERR.push('não cabe em 390 px: '+r.larg);
// serviço
await p.evaluate(id=>{tabs.serv='prz';go('#/processo/'+id);},ids.sv);await p.waitForTimeout(400);
const s=await p.evaluate(()=>({aba:document.querySelector('.tabs')?.innerText||'',outro:document.querySelector('.przSec[data-sec="outro"]')?.innerText||''}));console.log('serviço:',s);
if(!/Prazos e compromissos/.test(s.aba)||!/Entrega do parecer/.test(s.outro))ERR.push('serviço sem a aba/seções');
// cliente
await p.evaluate(id=>go('#/pessoa/'+id),ids.c);await p.waitForTimeout(400);
if(!/Prazos e compromissos pendentes/.test(await p.evaluate(()=>document.body.innerText)))ERR.push('ficha do cliente sem o novo nome');
console.log('ERROS',[...ERR,...errs]);await b.close();})();
