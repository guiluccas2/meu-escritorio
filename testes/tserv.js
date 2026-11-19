// Serviços: cadastro (P0152.S1), lista própria, fora da lista de processos, ficha, gerar no financeiro, cobrança → processo, conversão em lote, workflows, Drive, entrada rápida
const {chromium,devices}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
const v=(s,a)=>p.evaluate(s,a), sub=async()=>{await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(350);};
await p.evaluate(()=>{db.meta.workflows=[{id:'w1',titulo:'Serviço novo',ativo:true,gatilhos:[{ev:'serv_criado'}],passos:[{id:'a',acao:'compromisso',ctipo:'Tarefa',titulo:'Enviar minuta para {cliente}',qtd:5,unid:'dc',dir:'depois',ref:'gatilho'}]},
  {id:'w2',titulo:'Processo novo',ativo:true,gatilhos:[{ev:'proc_criado'}],passos:[{id:'b',acao:'compromisso',ctipo:'Tarefa',titulo:'Conferir petição',qtd:0,ref:'gatilho'}]}];save();});
console.log('menu:',await v(()=>!!document.querySelector('#nav a[data-v=servicos]')));
// novo serviço
await p.evaluate(()=>formServico({clienteId:MP.ed.id}));await p.waitForTimeout(300);
await p.selectOption('[name=tipoServico]','Elaboração de contrato');await p.waitForTimeout(100);
console.log('conta sugerida:',await v(()=>document.getElementById('sConta').selectedOptions[0].textContent),'| cobrança visível:',await v(()=>document.getElementById('gsCob').style.display!=='none'));
await p.fill('[name=titulo]','Contrato de compra e venda — imóvel Rua X');await p.fill('[name=valorServico]','2500');await p.selectOption('[name=formaHon]','parcelado');await p.selectOption('[name=plano]','pr_e3060');await sub();await p.waitForTimeout(400);
const s1=await v(()=>db.processos.find(x=>x.servico).id);
console.log('conta e tags gravadas:',await v(id=>byId('processos',id).contaHon+' tags='+JSON.stringify(byId('processos',id).tags),s1));console.log('código:',await v(id=>procCode(byId('processos',id))+' | label: '+procLabel(byId('processos',id)),s1),'| status geral:',await v(id=>byId('processos',id).status,s1));
console.log('workflow serviço:',await v(()=>db.prazos.filter(x=>/minuta|petição/i.test(x.titulo)).map(x=>x.titulo).join(', ')));
// segundo serviço: consultoria (conta 1.1.04, valor único)
await p.evaluate(()=>formServico({clienteId:MP.ed.id}));await p.waitForTimeout(300);await p.selectOption('[name=tipoServico]','Consultoria');await p.waitForTimeout(100);
console.log('consultoria:',await v(()=>document.getElementById('sConta').selectedOptions[0].textContent+' / '+mForm.elements.formaHon.value));await sub();
await p.evaluate(()=>formServico({clienteId:MP.ed.id}));await p.waitForTimeout(300);await p.selectOption('[name=tipoServico]','Assessoria mensal');await p.waitForTimeout(100);
console.log('assessoria:',await v(()=>document.getElementById('sConta').selectedOptions[0].textContent+' / '+mForm.elements.formaHon.value));await p.fill('[name=valorServico]','800');await sub();
console.log('códigos:',await v(()=>db.processos.filter(x=>x.servico).map(procCode).join(', ')),'| novo processo seq:',await v(()=>nextSeq(MP.ed.id)));
// listas
await p.evaluate(()=>go('#/processos'));await p.waitForTimeout(300);console.log('serviço na lista de processos?',await v(()=>document.getElementById('list').textContent.includes('compra e venda')));
await p.evaluate(()=>go('#/servicos'));await p.waitForTimeout(300);console.log('lista serviços:',await v(()=>document.querySelectorAll('#list tbody tr').length),'| nav on:',await v(()=>document.querySelector('#nav a.on')?.dataset.v));
await p.screenshot({path:SS+'serv_lista.png',fullPage:true});
// ficha + gerar no financeiro (parcelado)
await p.evaluate(id=>{tabs.serv='fin';go('#/processo/'+id)},s1);await p.waitForTimeout(300);console.log('ficha:',await v(()=>document.querySelector('#view h1').textContent.slice(0,60)),'| nav:',await v(()=>document.querySelector('#nav a.on')?.dataset.v));
await p.click('[data-act=servFin]');await p.waitForTimeout(400);console.log('form fin:',await v(()=>mForm.elements.plano.value+' '+document.querySelector('#fConta').selectedOptions[0].textContent+' '+mForm.elements.valor.value));await sub();
console.log('contas geradas:',await v(id=>db.financeiro.filter(l=>l.processoId===id).map(l=>l.valor+' '+l.vencimento+' g='+!!l.grupo).join(' | '),s1));
await p.screenshot({path:SS+'serv_ficha.png',fullPage:true});
// assessoria mensal → recorrência
const s3=await v(()=>db.processos.filter(x=>x.servico).find(x=>x.tipoServico==='Assessoria mensal').id);
await p.evaluate(id=>servGerarFinanceiro(id),s3);await p.waitForTimeout(300);console.log('assessoria recorr:',await v(()=>mForm.elements.recorr.checked));await sub();
console.log('mensalidades:',await v(id=>db.financeiro.filter(l=>l.processoId===id).length,s3));
// cobrança → converter em processo
await p.evaluate(()=>{const dv=upsert('pessoas',{nome:'Devedor Ltda',tipo:'Parte contrária'});formServico({clienteId:MP.hi.id,tipoServico:'Cobrança extrajudicial'});window._dv=dv.id;});await p.waitForTimeout(300);
console.log('cobrança visível:',await v(()=>document.getElementById('gsCob').style.display!=='none'));await p.selectOption('[name=devedorId]',await v(()=>window._dv));await p.fill('[name=valorDivida]','15000');await sub();
const sc=await v(()=>db.processos.find(x=>x.servico&&/Cobran/.test(x.tipoServico)).id);
await p.evaluate(id=>go('#/processo/'+id),sc);await p.waitForTimeout(300);await p.click('[data-act=servConv]');await p.waitForTimeout(600);
console.log('convertido:',await v(id=>{const s=byId('processos',id),pr=byId('processos',s.convertidoEm);return s.statusServ+' / '+s.status+' → '+procCode(pr)+' '+pr.titulo+' partes='+pr.partes.map(x=>pessoaNome(x.pessoaId)+':'+x.polo).join(',')+' causa='+pr.valorCausa},sc));
await p.evaluate(()=>closeModal());
console.log('workflow processo disparou p/ processo convertido:',await v(()=>db.prazos.some(x=>x.titulo==='Conferir petição')));
// conversão em lote
await p.evaluate(()=>{upsert('processos',{clienteId:MP.el.id,titulo:'Notificação extrajudicial',tipoProc:'Extrajudicial',status:'Ativo',seq:nextSeq(MP.el.id),partes:[],testemunhas:[]});go('#/servicos')});await p.waitForTimeout(300);
console.log('botão lote:',await v(()=>document.querySelector('[data-act=servLote]')?.textContent));await p.click('[data-act=servLote]');await p.waitForTimeout(300);await sub();
console.log('após lote:',await v(()=>db.processos.filter(x=>x.servico&&x.clienteId===MP.el.id).map(x=>procCode(x)+' '+x.tipoServico+' '+x.statusServ).join(',')));
// entrada rápida e Drive
console.log('rápido 152.S1:',await v(()=>{const r=parseRapido('reunião 152.S1 amanhã');return procCode(byId('processos',r?.processoId))||'não achou'}));
console.log('Drive alvo:',await v(id=>JSON.stringify(arqAlvo({processoId:id})),s1));
// ficha do cliente
await p.evaluate(()=>go('#/pessoa/'+MP.ed.id));await p.waitForTimeout(300);console.log('ficha cliente serviços:',await v(()=>[...document.querySelectorAll('.card h2')].find(h=>h.textContent.includes('Serviços'))?.textContent.trim()));
console.log('verificação:',await v(()=>vincProblemas().filter(x=>/Serviços|Listas/.test(x.area)).map(x=>x.titulo).join(' | ')||'ok'));
const m=await (await b.newContext({...devices['iPhone 13']})).newPage();await m.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await m.waitForTimeout(500);await m.evaluate(`(function(){const t=today();${seed}})()`);
await m.evaluate(()=>{upsert('processos',{servico:true,clienteId:MP.ed.id,tipoServico:'Consultoria',titulo:'Consultoria trabalhista',statusServ:'Em andamento',status:'Ativo',seqServ:'1',partes:[],testemunhas:[]});go('#/servicos')});await m.waitForTimeout(300);
console.log('mob lista:',await m.evaluate(()=>document.documentElement.scrollWidth));await m.evaluate(()=>go('#/processo/'+db.processos.find(x=>x.servico).id));await m.waitForTimeout(300);console.log('mob ficha:',await m.evaluate(()=>document.documentElement.scrollWidth));
await m.evaluate(()=>formServico({}));await m.waitForTimeout(300);await m.evaluate(()=>document.querySelectorAll('#mForm details').forEach(d=>d.open=true));console.log('mob form:',await m.evaluate(()=>document.documentElement.scrollWidth));
console.log('ERROS',errs);await b.close();})();
