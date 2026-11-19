const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);
await p.evaluate(()=>{db.meta.workflows=[];});await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.meta.workflows=[{id:'w1',titulo:'Diligência marcada',ativo:true,gatilhos:[{ev:'cmp_criado',tipo:'Diligência'},{ev:'proc_fase',para:'Recursal'},{ev:'campo_mudou',col:'processos',campo:'rito',valor:'Sumaríssimo'}],
  passos:[{id:'a',acao:'compromisso',ctipo:'Diligência',titulo:'x',qtd:0,unid:'dc',ref:'gatilho'},{id:'b',acao:'tag',onde:'processo',tags:['t1']},{id:'c',acao:'campo',onde:'processo',campo:'fase',valor:'Recursal'},{id:'d',acao:'whats',para:[]}]}];
  db.meta.gcal={...(db.meta.gcal||{}),cores:{'Diligência':'5'}};save();});
console.log('campos do processo p/ workflow:',await p.evaluate(()=>wfCamposDe('processos').map(x=>x[0]).join(',')));
console.log('problemas iniciais:',await p.evaluate(()=>JSON.stringify(wfProblemas(wfs()[0]))));
// renomear Diligência -> Diligência externa  e Recursal -> Recursos
await p.evaluate(()=>{const its=listaItens('tipoPrazo').map(x=>({...x}));its.find(x=>x.v==='Diligência').v='Diligência externa';renomearOpcao('tipoPrazo','Diligência','Diligência externa');db.meta.listas={...db.meta.listas,tipoPrazo:its};
  const f=listaItens('faseProc').map(x=>({...x}));f.find(x=>x.v==='Recursal').v='Recursos';renomearOpcao('faseProc','Recursal','Recursos');db.meta.listas={...db.meta.listas,faseProc:f};save();});
console.log('após renomear:',await p.evaluate(()=>{const w=wfs()[0];return [w.gatilhos[0].tipo,w.gatilhos[1].para,w.passos[0].ctipo,w.passos[2].valor,JSON.stringify(db.meta.gcal.cores)].join(' | ')}));
// excluir tag t1, remover opção Sumaríssimo do rito
await p.evaluate(()=>{db.meta.tagsProc=tagsProc().filter(t=>t.id!=='t1');db.meta.listas={...db.meta.listas,rito:listaItens('rito').filter(x=>x.v!=='Sumaríssimo')};MP.p1.tags=['t1'];save();});
console.log('problemas depois:',await p.evaluate(()=>JSON.stringify(wfProblemas(wfs()[0]))));
await p.evaluate(()=>go('#/workflows'));await p.waitForTimeout(400);console.log('badge wf:',await p.evaluate(()=>document.getElementById('bWf').textContent+' hidden='+document.getElementById('bWf').hidden));
await p.screenshot({path:SS+'vinc_wf.png'});
// órfãos + prazo sem data
await p.evaluate(()=>{upsert('prazos',{titulo:'Prazo sem data',tipo:'Prazo processual',situacao:'Pendente'});upsert('andamentos',{processoId:'naoexiste',data:today(),descricao:'x'});});
await p.evaluate(()=>go('#/config'));await p.waitForTimeout(600);
console.log('verificação:',await p.evaluate(()=>vincProblemas().map(x=>(x.grave?'🔴':'🟡')+x.titulo).join(' || ')));
console.log('badge config:',await p.evaluate(()=>document.querySelector('#nav a[data-v=config] .count')?.textContent));
await p.screenshot({path:SS+'vinc_cfg.png'});
await p.click('[data-act=verCorrigir][data-k=orfaos]');await p.waitForTimeout(300);await p.click('[data-act=verCorrigir][data-k=tags]');await p.waitForTimeout(300);
console.log('após corrigir:',await p.evaluate(()=>vincProblemas().map(x=>x.titulo).join(' || ')));
// editor mostra valor inválido marcado
await p.evaluate(()=>formWorkflow(wfs()[0]));await p.waitForTimeout(300);console.log('editor ⚠️:',await p.evaluate(()=>[...document.querySelectorAll('#mForm option')].filter(o=>o.textContent.includes('⚠️')).map(o=>o.textContent).join(', ')));
console.log('ERROS',errs);await b.close();})();
