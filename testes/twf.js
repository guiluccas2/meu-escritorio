const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://comunicaapi.pje.jus.br/**',r=>r.abort());await ctx.route('https://script.google.com/**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.meta.wfV1=false;wfMigrar();go('#/workflows');});await p.waitForTimeout(400);
console.log('menu:', await p.evaluate(()=>!!document.querySelector('#nav a[data-v=workflows]')), '| migrados:', await p.evaluate(()=>wfs().map(w=>w.titulo).join(', ')));
await p.screenshot({path:SS+'wf_lista.png'});
// novo workflow pela UI: fase -> Sentença ; tarefa 5 dias úteis depois + tag
await p.click('[data-act=wfNovo]');await p.waitForTimeout(200);
await p.fill('#wfTit','Sentença publicada');
await p.selectOption('[data-gev="0"]','proc_fase');await p.waitForTimeout(100);
const fases=await p.evaluate(()=>OPT.faseProc);console.log('fases:',fases.slice(0,6).join('|'));
const alvo=fases[fases.length-1];await p.selectOption('[data-gk=para][data-gi="0"]',alvo);
await p.click('#wfPAdd');await p.fill('[data-pk=titulo][data-pi="0"]','Analisar recurso de {cliente}');await p.fill('[data-pk=qtd][data-pi="0"]','5');await p.selectOption('[data-pk=unid][data-pi="0"]','du');
await p.click('#wfPAdd');await p.selectOption('[data-pk=acao][data-pi="1"]','campo');await p.waitForTimeout(100);
console.log('passo campo html:', await p.evaluate(()=>[...document.querySelectorAll('.wfPasso')[1].querySelectorAll('label')].map(l=>l.firstChild.textContent.trim()).join('|')));
await p.screenshot({path:SS+'wf_editor.png',fullPage:false});
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(300);
console.log('salvo:', await p.evaluate(()=>JSON.stringify(wfs().at(-1)).slice(0,400)));
// dispara
const r=await p.evaluate(async(alvo)=>{const pr=MP.p1;const n0=db.prazos.length;upsert('processos',{...pr,fase:alvo});await new Promise(r=>setTimeout(r,300));
  const nv=db.prazos.slice(n0);return {criados:nv.map(x=>x.titulo+' '+x.data).join('; '),log:db.wflog.length,toast:document.querySelector('#toastU')?.textContent}},alvo);
console.log('disparo:',JSON.stringify(r));
const r2=await p.evaluate(async(alvo)=>{const pr=MP.p1;const n0=db.prazos.length;upsert('processos',{...byId('processos',pr.id),obs:'x'});await new Promise(r=>setTimeout(r,300));return db.prazos.length-n0},alvo);
console.log('sem repetir:',r2);
// desfazer
await p.evaluate(()=>{const lg=db.wflog.at(-1);wfDesfazer(lg.id);});console.log('após desfazer tarefa existe:', await p.evaluate(()=>db.prazos.some(x=>x.titulo.startsWith('Analisar recurso'))));
// audiência -> lembretes do workflow migrado
const r3=await p.evaluate(async()=>{const c=upsert('prazos',{titulo:'Audiência teste',tipo:'Audiência',data:addDays(today(),20),hora:'14:00',processoId:MP.p1.id,situacao:'Pendente'});await new Promise(r=>setTimeout(r,300));const x=byId('prazos',c.id);return (x.lembretes||[]).map(l=>lembDesc(l)+'/'+l.tipo+(l.wf?'⚙️':'')).join('; ')});
console.log('audiência lembretes:',r3);
// abre o compromisso e vê marca
await p.evaluate(()=>{const c=db.prazos.find(x=>x.titulo==='Audiência teste');formPrazo(c);});await p.waitForTimeout(300);
console.log('marca ⚙️ no form:', await p.evaluate(()=>document.querySelectorAll('#lbLista .tag').length), await p.evaluate(()=>document.querySelector('#gLemb')?.textContent.includes('Workflows')));
await p.evaluate(()=>closeModal());
// manual
await p.evaluate(()=>{db.meta.workflows.push({id:'wm',titulo:'Boas-vindas',ativo:true,gatilhos:[{ev:'manual',colM:'pessoas'}],passos:[{id:'a',acao:'atendimento',titulo:'Boas-vindas a {cliente}',desc:'ok'},{id:'b',acao:'tag',onde:'cliente',tags:['c1']}]});save();go('#/pessoa/'+MP.p1.clienteId);});await p.waitForTimeout(300);
await p.click('[data-act=wfManual]');await p.waitForTimeout(200);await p.click('[data-wfrun]');await p.waitForTimeout(300);
console.log('manual:', await p.evaluate(()=>{const ps=byId('pessoas',MP.p1.clienteId);return db.conversas.filter(c=>c.pessoaId===ps.id&&(c.assunto||'').startsWith('Boas')).length+' conv, tags='+(ps.tags||[]).join(',')}));
// campo_mudou em compromisso
await p.evaluate(()=>{db.meta.workflows.push({id:'wc',titulo:'Cumprida',ativo:true,gatilhos:[{ev:'campo_mudou',col:'prazos',campo:'situacao',valor:'Cumprido'}],passos:[{id:'c',acao:'notif',qtd:0,ref:'gatilho',titulo:'Avisar cliente'}]});save();});
const r4=await p.evaluate(async()=>{const c=db.prazos.find(x=>x.titulo==='Audiência teste');const n0=db.prazos.length;upsert('prazos',{...c,situacao:'Cumprido'});await new Promise(r=>setTimeout(r,300));return db.prazos.slice(n0).map(x=>x.titulo).join(';')});
console.log('campo_mudou:',r4, '| situações:', await p.evaluate(()=>OPT.situacao.join('|')));
await p.evaluate(()=>go('#/workflows'));await p.waitForTimeout(300);await p.screenshot({path:SS+'wf_lista2.png',fullPage:true});
await p.setViewportSize({width:390,height:844});await p.click('[data-act=wfEditar]');await p.waitForTimeout(300);await p.screenshot({path:SS+'wf_mob.png'});
console.log('overflow mob:', await p.evaluate(()=>document.documentElement.scrollWidth));
console.log('ERROS:',errs);await b.close();})();
