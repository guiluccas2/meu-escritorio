// Leads (etapas Novo · Documento · Análise · Atendimento · Follow-up · Fechado · Perdido):
// migração das etapas antigas · cadastro em blocos · “✔ concluir” a tarefa do lead só conclui ao SALVAR (cancelar = continua pendente)
// · tarefa nova para o próximo contato · tentativas sem resposta · formulário curto da tarefa do lead · botões na Agenda do dia · 390 px
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});
await ctx.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
const larg=async(q='#modal *')=>p.evaluate(q=>{let m=0;document.querySelectorAll(q).forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.right>m)m=r.right;});return Math.round(m);},q);
const tit=()=>p.evaluate(()=>document.getElementById('modal').classList.contains('hidden')?'':document.getElementById('mTitle').textContent);
// 0) migração das etapas antigas (lista personalizada, leads, ordem fixada e workflow)
const mig=await p.evaluate(()=>{const d=norm({leads:[{id:'a',status:'Em contato'},{id:'b',status:'Reunião agendada'},{id:'c',status:'Proposta enviada'},{id:'d',status:'Minha etapa'}],
  meta:{listas:{statusLead:[{v:'Novo'},{v:'Em contato'},{v:'Reunião agendada'},{v:'Proposta enviada'},{v:'Minha etapa'},{v:'Fechado'},{v:'Perdido'}]},leadOrdem:{'Reunião agendada':'cadAsc'},
  workflows:[{id:'w',gatilhos:[{ev:'lead_etapa',etapa:'Proposta enviada'}],passos:[{acao:'campo',onde:'lead',campo:'status',valor:'Em contato'}]}]}});
  return {st:d.leads.map(x=>x.status).join(','),lista:d.meta.listas.statusLead.map(x=>x.v).join(','),ord:JSON.stringify(d.meta.leadOrdem),wf:d.meta.workflows[0].gatilhos[0].etapa+'/'+d.meta.workflows[0].passos[0].valor};});
console.log('migração:',mig);
if(mig.st!=='Novo,Atendimento,Follow-up,Minha etapa')ERR.push('migração dos leads');if(mig.lista!=='Novo,Documento,Análise,Atendimento,Follow-up,Minha etapa,Fechado,Perdido')ERR.push('migração da lista: '+mig.lista);
if(mig.ord!=='{"Atendimento":"cadAsc"}')ERR.push('migração da ordem fixada');if(mig.wf!=='Follow-up/Novo')ERR.push('migração do workflow');
if((await p.evaluate(()=>OPT.statusLead.join(',')))!=='Novo,Documento,Análise,Atendimento,Follow-up,Fechado,Perdido')ERR.push('etapas padrão');
// 1) Novo lead em blocos; etapa Documento mostra documentos; mensagem segue a etapa; conversa colada vai recolhida ao histórico
await p.evaluate(()=>formLead({}));await p.waitForTimeout(250);
const gr=await p.evaluate(()=>[...document.querySelectorAll('#mForm details.fgrupo>summary')].map(x=>x.textContent.trim()));console.log('blocos:',gr);
if(!/Dados do lead/.test(gr[0])||!/Contato inicial/.test(gr[1])||!/Andamento/.test(gr[2])||!/Próximo contato/.test(gr[3]))ERR.push('ordem dos blocos do lead');
if(await p.$('[name=valorEstimado]')||await p.$('[name=pessoaId]')||await p.$('[name=perdido]'))ERR.push('campos retirados ainda aparecem');
await p.fill('[name=nome]','Maria Souza');await p.fill('[name=telefone]','14999990000');await p.fill('[name=assunto]','Aposentadoria negada');
await p.fill('[name=descricao]','Pediu aposentadoria e foi negada');await p.fill('[name=orientacao]','Pedi o CNIS');
await p.click('.ldColar summary');await p.fill('[name=ldConversa]','[10:00] Maria: oi');
const vis=n=>p.evaluate(n=>{const e=mForm.elements[n];const f=(e instanceof RadioNodeList?e[0]:e).closest('.fld');return f.offsetParent!==null;},n);
if(await vis('docsPedidos'))ERR.push('documentos aparece fora da etapa Documento');
await p.click('label.chk:has(input[name=status][value="Documento"])');if(!(await vis('docsPedidos')))ERR.push('Documento não mostrou os documentos pedidos');
await p.fill('[name=docsPedidos]','CNIS');const m1=await p.inputValue('[name=msgContato]');console.log('mensagem Documento:',m1);if(!/Conseguiu separar os documentos \(CNIS\)/.test(m1))ERR.push('mensagem não seguiu a etapa');
await p.click('label.chk:has(input[name=status][value="Perdido"])');if(!(await vis('motivoPerda'))||await vis('proximoContato'))ERR.push('Perdido: motivo/próximo contato');
await p.click('label.chk:has(input[name=status][value="Documento"])');
const L1=await larg();console.log('largura novo lead:',L1);if(L1>390)ERR.push('novo lead passa de 390 px');
await p.fill('[name=proximoContato]',await p.evaluate(()=>addDays(today(),2)));
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(400);
const r1=await p.evaluate(()=>{const l=db.leads.find(x=>x.nome==='Maria Souza');const c=db.conversas.find(x=>x.leadId===l.id);return {st:l.status,docs:l.docsPedidos,as:l.assunto,or:l.orientacao,pz:!!byId('prazos',l.prazoId),rel:c&&c.relato,conv:c&&c.conversa,id:l.id};});
console.log('lead salvo:',r1);if(r1.st!=='Documento'||r1.docs!=='CNIS'||!r1.pz)ERR.push('lead não salvou etapa/documentos/lembrete');
if(!/Orientação: Pedi o CNIS/.test(r1.rel||'')||r1.conv!=='[10:00] Maria: oi')ERR.push('contato inicial/conversa colada');
const ficha=await p.evaluate(()=>document.body.innerText);if(!/Minha orientação/.test(ficha)||!/conversa completa colada/.test(ficha))ERR.push('ficha sem orientação/conversa colada');
// 2) funil: 7 colunas e cartão com assunto e documentos
await p.evaluate(()=>go('#/leads'));await p.waitForTimeout(400);
const fun=await p.evaluate(()=>({cols:[...document.querySelectorAll('.kcol')].map(c=>c.dataset.col).join(','),card:document.querySelector('.kcard').innerText}));
console.log('funil:',fun.cols,'|',fun.card.replace(/\s+/g,' '));if(fun.cols!=='Novo,Documento,Análise,Atendimento,Follow-up,Fechado,Perdido')ERR.push('colunas do funil');if(!/Aposentadoria negada/.test(fun.card)||!/aguarda: CNIS/.test(fun.card))ERR.push('cartão sem assunto/documentos');
// 3) concluir pela Agenda do dia: botões; abre a tela; CANCELAR não conclui
const pid=await p.evaluate(id=>{const l=byId('leads',id);upsert('leads',{id,proximoContato:today()});sincronizarLembreteLead(byId('leads',id));return byId('leads',id).prazoId;},r1.id);
await p.evaluate(()=>go('#/'));await p.waitForTimeout(500);
const bts=await p.evaluate(pid=>{const b=document.querySelector(`.agItem [data-act=prazoConcluir][data-id="${pid}"]`);return b?[...b.parentElement.children].map(x=>x.textContent.trim()).join('|'):'';},pid);console.log('agenda do dia:',bts);
if(bts!=='✔ concluir|🎯 lead|🟢 WhatsApp|editar')ERR.push('botões da Agenda do dia: '+bts);
const LA=await larg('.agItem, .agItem *');if(LA>390)ERR.push('agenda do dia passa de 390 px ('+LA+')');
await p.click(`.agItem [data-act=prazoConcluir][data-id="${pid}"]`);await p.waitForTimeout(300);
if(!/Concluir contato com o lead/.test(await tit()))ERR.push('concluir não abriu a tela');
const g2=await p.evaluate(()=>[...document.querySelectorAll('#mForm details.fgrupo>summary')].map(x=>x.textContent.trim()).join('|'));if(!/^💬 Contato feito\|📈 Andamento do lead\|📞 Próximo contato/.test(g2))ERR.push('ordem dos blocos do concluir: '+g2);
const env=await p.inputValue('[name=enviada]');if(!/Conseguiu separar/.test(env))ERR.push('mensagem enviada não veio do lembrete');
const L2=await larg();console.log('largura concluir:',L2);if(L2>390)ERR.push('concluir passa de 390 px');
await p.click('#mCancel');await p.waitForTimeout(200);
if(await p.evaluate(pid=>byId('prazos',pid).concluido,pid))ERR.push('CANCELAR concluiu a tarefa');
// caixinha (togglePrazo) também não conclui antes de salvar
await p.evaluate(pid=>A.togglePrazo({id:pid},{checked:true}),pid);await p.waitForTimeout(200);await p.click('#mClose');await p.waitForTimeout(150);
if(await p.evaluate(pid=>byId('prazos',pid).concluido,pid))ERR.push('fechar no X concluiu a tarefa');
// 4) sem resposta → Follow-up, tentativa contada, tarefa nova para o próximo contato
await p.evaluate(pid=>A.prazoConcluir({id:pid}),pid);await p.waitForTimeout(250);
await p.check('[name=semResp]');const stSel=await p.evaluate(()=>mForm.querySelector('[name=status]:checked').value);if(stSel!=='Follow-up')ERR.push('sem resposta não marcou Follow-up');
const d3=await p.evaluate(()=>addDays(today(),3));await p.fill('[name=proximoContato]',d3);
const m2=await p.inputValue('[name=msgContato]');if(!/ainda tem interesse/.test(m2))ERR.push('mensagem de follow-up');
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(300);
const r4=await p.evaluate(({id,pid})=>{const l=byId('leads',id),n=byId('prazos',l.prazoId);return {velho:byId('prazos',pid).concluido,novo:l.prazoId!==pid,nd:n&&n.data,np:n&&!n.concluido,st:l.status,sr:l.semResposta,cv:db.conversas.filter(c=>c.leadId===id).map(c=>c.assunto)};},{id:r1.id,pid});
console.log('sem resposta:',r4);if(!r4.velho||!r4.novo||r4.nd!==d3||!r4.np)ERR.push('tarefa velha/nova');if(r4.st!=='Follow-up'||r4.sr!==1)ERR.push('etapa/tentativa');if(!r4.cv.some(a=>/1ª sem resposta/.test(a)))ERR.push('tentativa não foi ao histórico');
// 5) editar a tarefa do lead: formulário curto; mudar a data muda o lead; “formulário completo” ainda existe
const pid2=await p.evaluate(id=>byId('leads',id).prazoId,r1.id);
await p.evaluate(pid=>A.editPrazo({id:pid}),pid2);await p.waitForTimeout(250);
const curto=await p.evaluate(()=>({t:document.getElementById('mTitle').textContent,n:[...mForm.elements].filter(e=>e.name).map(e=>e.name).join(','),f:[...document.querySelectorAll('#mForm .mfoot button')].map(x=>x.textContent.trim()).join('|')}));
console.log('formulário curto:',curto);if(!/Contato com o lead/.test(curto.t)||/dataFatal|tipo|processoId/.test(curto.n))ERR.push('formulário curto: '+curto.n);
if(curto.f!=='Excluir|Cancelar|✔ Concluir contato|Salvar|Salvar e continuar →')ERR.push('rodapé do formulário curto: '+curto.f);
const d5=await p.evaluate(()=>addDays(today(),5));await p.fill('[name=data]',d5);await p.fill('[name=hora]','10:30');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(250);
const r5=await p.evaluate(({id,pid})=>({lp:byId('leads',id).proximoContato,pd:byId('prazos',pid).data,ph:byId('prazos',pid).hora}),{id:r1.id,pid:pid2});if(r5.lp!==d5||r5.pd!==d5||r5.ph!=='10:30')ERR.push('formulário curto não gravou: '+JSON.stringify(r5));
await p.evaluate(pid=>A.editPrazo({id:pid}),pid2);await p.waitForTimeout(200);await p.click('.ldCompleto');await p.waitForTimeout(250);
if(!(await p.$('[name=dataFatal]')))ERR.push('formulário completo não abriu');await p.click('#mCancel');
// 6) concluir com resposta e etapa Fechado: sem próximo contato, oferece converter
await p.evaluate(pid=>A.prazoConcluir({id:pid}),pid2);await p.waitForTimeout(250);await p.fill('[name=resposta]','Topou contratar');
await p.click('label.chk:has(input[name=status][value="Fechado"])');if(await vis('proximoContato'))ERR.push('Fechado ainda mostra próximo contato');
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(600);
const r6=await p.evaluate(id=>({st:byId('leads',id).status,sr:byId('leads',id).semResposta,pend:db.prazos.filter(x=>x.leadId===id&&!x.concluido).length,cli:!!byId('leads',id).pessoaId}),r1.id);console.log('fechado:',r6);
if(r6.st!=='Fechado'||r6.sr!==0||r6.pend)ERR.push('Fechado: '+JSON.stringify(r6));
// depois de cliente: a tarefa usa o formulário completo
if(r6.cli){const x=await p.evaluate(id=>{const t=upsert('prazos',{titulo:'Tarefa do novo cliente',tipo:'Tarefa',data:today(),leadId:id,situacao:'Pendente'});A.editPrazo({id:t.id});return document.querySelector('[name=dataFatal]')?1:0;},r1.id);if(!x)ERR.push('cliente convertido ainda usa o formulário curto');await p.click('#mCancel');}
else ERR.push('Fechado não converteu em cliente');
// 7) compromisso comum continua concluindo direto
const t7=await p.evaluate(()=>{const x=upsert('prazos',{titulo:'Tarefa comum',tipo:'Tarefa',data:today(),situacao:'Pendente'});A.prazoConcluir({id:x.id});return {c:byId('prazos',x.id).concluido,m:document.getElementById('modal').classList.contains('hidden')};});
if(!t7.c||!t7.m)ERR.push('tarefa comum mudou de comportamento');
console.log('errs',errs);console.log('ERROS',ERR);await b.close();})();
