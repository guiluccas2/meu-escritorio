// Tela inicial: Agenda do dia mostra os atrasados (vermelho) antes dos do dia (laranja); Pauta do dia em retrato com os vencidos primeiro;
// ⚖️ sessão em julgamento agora em verde; 💰 a receber vencido com destaque (fundo + selo); indicador “Prazos para hoje” em laranja; cabe em 390 px
const {chromium}=require('playwright');const path=require('path');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://**',r=>r.abort());
const url='file://'+path.resolve(__dirname,'..','index.html'),errs=[];
const abrir=async vw=>{const p=await ctx.newPage();if(vw)await p.setViewportSize(vw);p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());await p.clock.setFixedTime(new Date('2026-11-27T09:00:00'));await p.goto(url);await p.waitForTimeout(700);return p;};
let p=await abrir();
await p.evaluate(()=>{const t=today();db.prazos=[];db.conversas=[];db.leads=[];db.financeiro=[];db.meta.workflows=[];db.meta.painel={...(db.meta.painel||{}),reag:{ativo:false,tipos:{}}};
  const c=upsert('pessoas',{nome:'Cliente Teste',tipo:'PF'});const pr=upsert('processos',{clienteId:c.id,numero:'1000000-00.2026.8.26.0100',status:'Ativo',tipoProc:'Judicial'});
  upsert('prazos',{titulo:'Ligar para o cliente (vencido)',tipo:'Tarefa',contatoCom:'Cliente',pessoaId:c.id,data:addDays(t,-2),situacao:'Pendente',concluido:false});
  upsert('prazos',{titulo:'Contestação hoje',tipo:'Prazo processual',data:t,situacao:'Pendente',concluido:false});
  upsert('prazos',{titulo:'Reunião hoje',tipo:'Reunião',data:t,hora:'15:00',situacao:'Pendente',concluido:false});
  upsert('prazos',{titulo:'Réplica próxima semana',tipo:'Prazo processual',data:addDays(t,3),situacao:'Pendente',concluido:false});
  upsert('prazos',{titulo:'Sessão virtual',tipo:'Audiência',subtipo:'Sessão de julgamento',processoId:pr.id,data:addDays(t,-1),dataFim:addDays(t,2),situacao:'Pendente',concluido:false});
  upsert('conversas',{pessoaId:c.id,dataHora:addDays(t,-5)+'T10:00',resumo:'x',proximaData:addDays(t,-1),proximaAcao:'Retornar sobre o acordo'});
  upsert('financeiro',{natureza:'entrada',descricao:'Honorários atrasados',valor:500,vencimento:addDays(t,-3),pessoaId:c.id});
  upsert('financeiro',{natureza:'entrada',descricao:'Honorários futuros',valor:300,vencimento:addDays(t,5),pessoaId:c.id});
  upsert('financeiro',{natureza:'entrada',descricao:'Êxito ao final',valor:900,vencimento:'',pessoaId:c.id});
  calSel=null;save();go('#/painel');});
await p.waitForTimeout(300);
const ag=await p.evaluate(()=>[...document.querySelectorAll('.card.agenda .agItem')].map(x=>(x.classList.contains('late')?'R':x.classList.contains('today')?'L':'-')+':'+x.querySelector('.grow>b').textContent));
console.log('agenda:',JSON.stringify(ag));
if(ag[0]!=='R:Ligar para o cliente (vencido)'||!ag.some(x=>x==='R:Retorno: Retornar sobre o acordo')||!ag.some(x=>x==='L:Contestação hoje')||!ag.some(x=>x==='L:Reunião hoje'))ERR.push('agenda do dia: '+JSON.stringify(ag));
if(ag.filter(x=>x.endsWith('Ligar para o cliente (vencido)')).length!==1)ERR.push('atrasado repetido');
const cor=await p.evaluate(()=>{const c=s=>getComputedStyle(document.querySelector(s)).color;return {late:c('.card.agenda .agItem.late .grow>b'),hoje:c('.card.agenda .agItem.today .grow>b'),bad:getComputedStyle(document.documentElement).getPropertyValue('--bad').trim()};});
if(cor.late===cor.hoje)ERR.push('cores iguais '+JSON.stringify(cor));
const qd=await p.evaluate(()=>{const li=t=>[...document.querySelectorAll('.li')].find(x=>x.textContent.includes(t));return {atr:li('Ligar para o cliente')?.className,hoje:li('Contestação hoje')?.className,prox:li('Réplica próxima')?.className,
  julg:li('Em julgamento agora')?.className,fin:li('Honorários atrasados')?.className,finTag:/vencido/.test(li('Honorários atrasados')?.textContent||''),finFut:li('Honorários futuros')?.className,exito:!!li('Êxito ao final'),
  stat:[...document.querySelectorAll('.stat')].find(x=>/Prazos para hoje/.test(x.textContent))?.className};});
console.log('quadros:',JSON.stringify(qd));
if(!/late/.test(qd.atr)||!/today/.test(qd.hoje)||/late|today/.test(qd.prox))ERR.push('cores dos prazos');
if(!/ativo/.test(qd.julg))ERR.push('sessão ativa em verde');
if(!/finVenc/.test(qd.fin)||!qd.finTag||/finVenc/.test(qd.finFut))ERR.push('financeiro vencido');
if(qd.exito)ERR.push('conta sem vencimento no quadro do financeiro');
if(!/hoje/.test(qd.stat))ERR.push('indicador hoje: '+qd.stat);
// pauta do dia: retrato e vencidos primeiro
const pa=await p.evaluate(()=>{const f=REL_FONTES.pautaDia();return {r:f.retrato,s:f.secoes.map(s=>s.titulo+':'+s.linhas.length),html:/portrait/.test(relDoc(f))};});
console.log('pauta:',JSON.stringify(pa));
if(!pa.r||!pa.html)ERR.push('pauta em retrato');
if(!/^🔴 Vencidos.*:1$/.test(pa.s[0])||!/^🔴 Retornos atrasados:1$/.test(pa.s[1])||!pa.s.some(x=>/^📅 Compromissos.*:3$/.test(x)))ERR.push('pauta: '+JSON.stringify(pa.s));
// outro dia (passado): sem atrasados na agenda
await p.evaluate(()=>{calSel=addDays(today(),-10);render();});await p.waitForTimeout(150);
if(await p.$('.card.agenda .agItem.late'))ERR.push('atrasados em outro dia');
await p.close();
p=await abrir({width:390,height:844});await p.evaluate(()=>go('#/painel'));await p.waitForTimeout(200);
const w=await p.evaluate(()=>document.documentElement.scrollWidth);if(w>390)ERR.push('celular: '+w);
await p.close();
if(errs.length)ERR.push('erros: '+errs.join(' | '));
console.log('ERROS',JSON.stringify(ERR));await b.close();})();
