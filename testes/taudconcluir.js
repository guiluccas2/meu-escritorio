// Concluir audiência: abre o formulário (ata, resumo → andamento, fase/situação do processo, próximos compromissos: nova audiência, perícia, testemunhas, terceiros…);
// cancelar mantém pendente; formulário com situação “Realizado” também abre; ⚡ Rápido fora da Agenda; cabe em 390 px
const {chromium}=require('playwright');const path=require('path');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);
const ids=await p.evaluate(()=>{const c=upsert('pessoas',{nome:'Cliente Audiência',tipo:'Cliente',pasta:'P0901'});const pr=upsert('processos',{titulo:'Ação Audiência',clienteId:c.id,seq:'1',status:'Ativo',fase:'Conhecimento'});
  const a=upsert('prazos',{titulo:'Audiência de instrução',tipo:'Audiência',processoId:pr.id,pessoaId:c.id,data:addDays(today(),-1),hora:'14:00',situacao:'Pendente',concluido:false});
  const a2=upsert('prazos',{titulo:'Audiência de conciliação',tipo:'Audiência',processoId:pr.id,pessoaId:c.id,data:today(),situacao:'Pendente',concluido:false});
  const t=upsert('prazos',{titulo:'Tarefa simples',tipo:'Tarefa',data:today(),situacao:'Pendente',concluido:false});save();return {c:c.id,pr:pr.id,a:a.id,a2:a2.id,t:t.id};});
// Agenda sem o ⚡ Rápido; caixinha de uma tarefa comum continua concluindo direto
await p.evaluate(()=>go('#/agenda'));await p.waitForTimeout(400);
if(await p.evaluate(()=>!!document.getElementById('rapidoIn')))ERR.push('⚡ Rápido ainda aparece na Agenda');
await p.evaluate(()=>go('#/painel'));await p.waitForTimeout(400);
await p.click(`[data-act=togglePrazo][data-id="${ids.t}"]`);await p.waitForTimeout(400);
if(!await p.evaluate(id=>byId('prazos',id).concluido,ids.t))ERR.push('tarefa comum não concluiu direto');
// caixinha da audiência abre o formulário; cancelar mantém pendente
await p.click(`[data-act=togglePrazo][data-id="${ids.a}"]`);await p.waitForTimeout(300);
let tit=await p.evaluate(()=>document.getElementById('mTitle').textContent);console.log('abriu:',tit);if(!/Concluir audiência/.test(tit))ERR.push('concluir audiência não abriu o formulário');
const larg=await p.evaluate(()=>document.documentElement.scrollWidth);if(larg>390)ERR.push('formulário não cabe em 390 px: '+larg);
await p.click('#mCancel');await p.waitForTimeout(200);
if(await p.evaluate(id=>byId('prazos',id).concluido,ids.a))ERR.push('cancelar concluiu a audiência');
// preencher: resumo, situação do processo e próximos compromissos (nova audiência, perícia, testemunhas, terceiros)
await p.evaluate(id=>A.prazoConcluir({id}),ids.a);await p.waitForTimeout(300);
await p.fill('[name=resumo]','Ouvidas duas testemunhas; juiz determinou perícia médica.');
await p.selectOption('[name=situacaoProc]','Aguardando perícia');
const add=async(txt,data)=>{await p.click(`[data-apadd]:has-text("${txt}")`);const n=await p.$$('.audProx');const l=n[n.length-1];if(data)await (await l.$('.apData')).fill(data);};
const d=await p.evaluate(()=>addDays(today(),30));
await add('Nova audiência',d);await add('Perícia',d);await add('testemunhas',d);await add('terceiros','');await add('Outro','');
const larg2=await p.evaluate(()=>document.documentElement.scrollWidth);if(larg2>390)ERR.push('linhas de compromisso não cabem em 390 px: '+larg2);
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(700);
const r=await p.evaluate(ids=>{const a=byId('prazos',ids.a),pr=byId('processos',ids.pr),cr=db.prazos.filter(x=>x.criadoDe==='audiencia:'+ids.a);
  return {sit:a.situacao,conc:a.concluido,rel:(a.relacionados||[]).length,proc:pr.situacaoProc,and:db.andamentos.filter(x=>x.processoId===ids.pr).map(x=>x.descricao),
    criados:cr.map(x=>x.tipo+':'+x.titulo+':'+(x.contatoCom||'')+':'+(x.data||'')+':'+x.processoId.length+':'+(x.relacionados||[]).includes(ids.a)),tela:document.getElementById('mTitle').textContent};},ids);
console.log(r);
if(r.sit!=='Realizado'||!r.conc)ERR.push('audiência não ficou realizada');if(r.proc!=='Aguardando perícia')ERR.push('situação do processo não mudou');
if(!r.and.some(x=>/Ouvidas duas testemunhas/.test(x)))ERR.push('resumo não virou andamento');
if(r.criados.length!==4)ERR.push('esperava 4 compromissos criados (linha sem “o quê” é ignorada): '+r.criados.length);
if(!r.criados.some(x=>/^Audiência:Audiência de continuação/.test(x))||!r.criados.some(x=>/^Perícia:/.test(x))||!r.criados.some(x=>/Testemunha/.test(x))||!r.criados.some(x=>/Parte contrária/.test(x)))ERR.push('tipos dos compromissos criados errados');
if(r.criados.some(x=>!/:true$/.test(x)))ERR.push('compromisso criado sem vínculo com a audiência/processo');if(r.rel<4)ERR.push('audiência sem os vínculos de volta');
if(!/Audiência concluída/.test(r.tela)||!(await p.$('[data-appp]')))ERR.push('sem a tela de próximos passos dos criados');
await p.click('[data-appp]');await p.waitForTimeout(300);if(!/Próximos passos/.test(await p.evaluate(()=>document.getElementById('mTitle').textContent)))ERR.push('próximos passos do criado não abriu');
await p.evaluate(()=>closeModal());
// formulário do compromisso com situação “Realizado” também abre o “Concluir audiência”
await p.evaluate(id=>formPrazo(byId('prazos',id)),ids.a2);await p.waitForTimeout(200);await p.selectOption('[name=situacao]','Realizado');
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(700);
tit=await p.evaluate(()=>document.getElementById('mTitle').textContent);console.log('pelo formulário:',tit);if(!/Concluir audiência/.test(tit))ERR.push('situação Realizado no formulário não abriu o Concluir audiência');
// cancelada
await p.check('[name=audSit][value=Cancelado]');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(400);
if(await p.evaluate(id=>byId('prazos',id).situacao,ids.a2)!=='Cancelado')ERR.push('cancelada não gravou');
// redesignada leva ao formulário com a nova data
await p.evaluate(()=>{const x=upsert('prazos',{titulo:'Audiência 3',tipo:'Audiência',data:today(),situacao:'Pendente',concluido:false});formAudConcluir(x.id);});await p.waitForTimeout(200);
await p.click('[name=audSit][value=Redesignado]');await p.waitForTimeout(300);
const rd=await p.evaluate(()=>({t:document.getElementById('mTitle').textContent,s:mForm.elements.situacao&&mForm.elements.situacao.value}));console.log('redesignada:',rd);
if(rd.t!=='Editar compromisso'||rd.s!=='Redesignado')ERR.push('redesignada não levou ao formulário com a nova data');
console.log('ERROS',[...ERR,...errs]);await b.close();})();
