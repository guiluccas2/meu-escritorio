// Contatos (leads, retornos a clientes…) e a Google Agenda: duas caixas distintas
// “📌 Criar lembrete na agenda do sistema” (marcada) × “📅 Criar lembrete na Google Agenda” (DESMARCADA por padrão).
// Marcada → vai para a Google Agenda ao salvar; desmarcar depois → sai de lá. Tela seguinte: Google Agenda sim, WhatsApp não.
// Prazos/audiências continuam com a caixa antiga. Publicações: quebras de linha fixas juntadas (texto ocupa a largura toda).
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const ops=[];
await ctx.route('**/*',async r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();
  if(u.startsWith('https://script.google.com/')){let out={ok:true};if(r.request().method()==='POST'){const bd=JSON.parse(r.request().postData()||'{}');if(bd.gcal){bd.gcal.ops.forEach(o=>ops.push(o));out={ok:true,gcal:bd.gcal.ops.map(o=>({id:o.id,ok:true,gcalId:o.apagar?'':'g_'+o.id,gcalCal:''}))};}}
    return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(out)});}
  return r.abort();});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.meta.monitor={...db.meta.monitor,roboUrl:'https://script.google.com/macros/s/X/exec',roboToken:'tok'};
  db.meta.gcal={modo:'direto',ativadoEm:new Date(Date.now()-864e5).toISOString()};save();});
const vis=n=>p.evaluate(n=>{const e=mForm.elements[n];if(!e)return false;const f=(e instanceof RadioNodeList?e[0]:e).closest('.fld');return f.offsetParent!==null;},n);
const val=n=>p.evaluate(n=>mForm.elements[n]&&mForm.elements[n].checked,n);
const larg=()=>p.evaluate(()=>{let m=0;document.querySelectorAll('#modal *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.right>m)m=r.right;});return Math.round(m);});
const pzLead=n=>p.evaluate(n=>{const l=db.leads.find(x=>x.nome===n);return l&&byId('prazos',l.prazoId);},n);
if(await p.evaluate(()=>gcalCfg().auto.lead))ERR.push('padrão do envio sozinho do lead ainda ligado');
// 1) lead novo: caixa do sistema marcada, a da Google desmarcada; salvar → só no sistema
await p.evaluate(()=>formLead({}));await p.waitForTimeout(250);
await p.fill('[name=nome]','Lead Só Sistema');await p.fill('[name=proximoContato]',await p.evaluate(()=>addDays(today(),2)));
const c1={sis:await val('lembrete'),g:await val('lembGcal'),gv:await vis('lembGcal'),lbl:await p.evaluate(()=>mForm.elements.lembrete.closest('.fld').textContent.trim())};console.log('caixas do lead:',c1);
if(!c1.sis||c1.g||!c1.gv)ERR.push('caixas do lead: sistema marcada / Google desmarcada e visível');if(!/agenda do sistema/.test(c1.lbl))ERR.push('rótulo da caixa do sistema');
await p.click('[name=lembrete]');if(await vis('lembGcal'))ERR.push('sem lembrete no sistema, a caixa da Google não deveria aparecer');await p.click('[name=lembrete]');
const L1=await larg();if(L1>390)ERR.push('lead passa de 390 px ('+L1+')');
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(1500);
const z1=await pzLead('Lead Só Sistema');console.log('só sistema:',z1&&{ped:z1.gcalPedido,id:z1.gcalId},ops.length);
if(!z1)ERR.push('lembrete do sistema não foi criado');else if(z1.gcalPedido||z1.gcalId||ops.length)ERR.push('foi para a Google Agenda sem marcar');
// 1b) pedido antigo pendente (nunca foi à Google): reabrir vem desmarcado e salvar tira da fila
await p.evaluate(()=>{const l=db.leads.find(x=>x.nome==='Lead Só Sistema');const z=db.prazos.find(x=>x.id===l.prazoId);z.gcalPedido=true;z.gcalNao=false;});
await p.evaluate(()=>formLead(db.leads.find(x=>x.nome==='Lead Só Sistema')));await p.waitForTimeout(250);
if(await val('lembGcal'))ERR.push('pedido pendente antigo: caixa da Google deveria vir desmarcada');
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(1500);
{const z=await pzLead('Lead Só Sistema');if(z.gcalPedido||z.gcalId||ops.length)ERR.push('pedido pendente antigo: deveria sair da fila da Google Agenda');
await p.evaluate(()=>{const l=db.leads.find(x=>x.nome==='Lead Só Sistema');const z=db.prazos.find(x=>x.id===l.prazoId);z.gcalNao=false;});
await p.evaluate(()=>{const l=db.leads.find(x=>x.nome==='Lead Só Sistema');formTarefaLead(db.prazos.find(x=>x.id===l.prazoId));});await p.waitForTimeout(250);
if(await val('lembGcal'))ERR.push('tarefa do lead: caixa da Google deveria vir desmarcada');await p.click('#mCancel');await p.waitForTimeout(150);}
// 2) “Salvar e continuar →” → tela seguinte com Google Agenda e SEM WhatsApp
await p.evaluate(()=>formLead(db.leads.find(x=>x.nome==='Lead Só Sistema')));await p.waitForTimeout(250);
if(await val('lembGcal'))ERR.push('reabrir: Google marcada sem ter ido');
await p.fill('[name=telefone]','14999990000');await p.click('#ldCont');await p.waitForTimeout(600);
const t2=await p.evaluate(()=>({tit:document.getElementById('mTitle').textContent,txt:document.getElementById('mForm').innerText,env:!!document.querySelector('#lpEnviar')}));console.log('passos do lead:',t2.tit,t2.env);
if(!/Próximos passos do lead/.test(t2.tit)||!t2.env)ERR.push('tela seguinte do lead sem Google Agenda');if(/WhatsApp/.test(t2.txt.replace(/link do WhatsApp/g,'')))ERR.push('tela seguinte do lead ainda mostra WhatsApp');
await p.click('#mCancel');await p.waitForTimeout(150);
// 3) marcar a caixa da Google → vai ao salvar; desmarcar → sai
await p.evaluate(()=>formLead(db.leads.find(x=>x.nome==='Lead Só Sistema')));await p.waitForTimeout(250);
await p.click('[name=lembGcal]');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(2500);
const z3=await pzLead('Lead Só Sistema');console.log('marcada:',z3.gcalId,ops.map(o=>o.titulo));if(!z3.gcalId)ERR.push('marcada: não foi para a Google Agenda');
await p.evaluate(()=>formLead(db.leads.find(x=>x.nome==='Lead Só Sistema')));await p.waitForTimeout(250);
if(!(await val('lembGcal')))ERR.push('reabrir: caixa da Google deveria vir marcada (já está lá)');
await p.click('[name=lembGcal]');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(5000);
const z4=await pzLead('Lead Só Sistema');console.log('desmarcada:',z4.gcalId,z4.gcalNao);if(z4.gcalId||!z4.gcalNao)ERR.push('desmarcada: não saiu da Google Agenda');
// 4) concluir contato: próximo contato nasce sem Google (caixa desmarcada)
const pid=await p.evaluate(()=>db.leads.find(x=>x.nome==='Lead Só Sistema').prazoId);
await p.evaluate(pid=>formLeadContato(pid),pid);await p.waitForTimeout(250);
if(await val('lembGcal')||!(await val('lembrete')))ERR.push('concluir: caixas fora do padrão');
await p.fill('[name=proximoContato]',await p.evaluate(()=>addDays(today(),5)));await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(1200);
const z5=await pzLead('Lead Só Sistema');if(!z5||z5.id===pid||z5.gcalPedido||z5.gcalId)ERR.push('concluir: próximo contato deveria ficar só no sistema');
// 5) compromisso “Retorno ao cliente”: só a caixa da Google (desmarcada); tela seguinte sem WhatsApp; prazo comum mantém a caixa antiga
await p.evaluate(()=>formPrazo({tipo:'Retorno ao cliente',contatoCom:'Cliente',pessoaId:db.pessoas[0].id}));await p.waitForTimeout(300);
const c5={sis:await vis('lembrete'),g:await vis('lembGcal'),gv:await val('lembGcal')};console.log('retorno ao cliente:',c5);
if(c5.sis||!c5.g||c5.gv)ERR.push('retorno ao cliente: caixa da Google deveria aparecer desmarcada (e a antiga sumir)');
await p.fill('[name=titulo]','Ligar para o cliente');await p.fill('[name=data]',await p.evaluate(()=>addDays(today(),1)));
const n0=ops.length;await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(1200);
const t5=await p.evaluate(()=>({tit:document.getElementById('mTitle').textContent,txt:document.getElementById('mForm').innerText,g:!!document.querySelector('#ppGcal'),wa:!!document.querySelector('#ppWa,#ppWaLivre')}));
const r5=await p.evaluate(()=>db.prazos.find(x=>x.titulo==='Ligar para o cliente'));console.log('passos do retorno:',t5.g,t5.wa,!!r5.gcalPedido);
if(!t5.g||t5.wa)ERR.push('tela seguinte do retorno: Google sim, WhatsApp não');if(r5.gcalPedido||ops.length>n0)ERR.push('retorno foi para a Google sem marcar');
const L5=await larg();if(L5>390)ERR.push('próximos passos passa de 390 px ('+L5+')');
await p.click('#ppVolta');await p.waitForTimeout(300);await p.click('[name=lembGcal]');await p.evaluate(()=>{mForm._modo='fechar';mForm.requestSubmit();});await p.waitForTimeout(5000);
if(!(await p.evaluate(()=>db.prazos.find(x=>x.titulo==='Ligar para o cliente').gcalId)))ERR.push('retorno marcado não foi para a Google Agenda');
await p.evaluate(()=>formPrazo({tipo:'Prazo processual'}));await p.waitForTimeout(300);
if(!(await vis('lembrete'))||await vis('lembGcal'))ERR.push('prazo processual deveria manter a caixa antiga');
await p.click('#mCancel');await p.waitForTimeout(150);
// 6) publicação com quebras fixas: o texto ocupa a largura toda
const fl=await p.evaluate(()=>pubFluido('Bauru\nNotificação - Intimação\n\nPROCESSO: 0012116-09.2026.5.15.0091 - AcaO TRABALHISTA - RITO\nSUMARiSSIMO\n\nPODER JUDICIARIO JUSTICA DO TRABALHO TRIBUNAL REGIONAL DO TRABALHO DA\n15ª REGIAO CON1 - BAURU ATSum. Link, digitando:\nhttps://trt15-jus-br.zoom.us/j/82616787881?pwd=czZ3YmtER09jZFZzbGhIblE5b\nnh6dz09 Devem as partes acessar o ambiente virtual no horario designado.'));
console.log('fluido:',JSON.stringify(fl));
if(!/^Bauru\nNotificação - Intimação\n\nPROCESSO: .* RITO SUMARiSSIMO\n\nPODER JUDICIARIO .* DA 15ª REGIAO/.test(fl))ERR.push('publicação: parágrafos não foram juntados');
if(!/pwd=czZ3YmtER09jZFZzbGhIblE5bnh6dz09 Devem/.test(fl))ERR.push('publicação: link cortado não foi emendado');
if(await p.evaluate(()=>pubFluido('a\nb\nc'))!=='a\nb\nc')ERR.push('publicação: texto curto mudou');
console.log('errs',errs);if(errs.length)ERR.push(...errs);
console.log('ERROS',ERR);await b.close();})();
