// Lead: “Salvar e continuar →” abre a tela seguinte: 📅 Enviar à Google Agenda (nada vai sozinho), abrir a tela do Google, WhatsApp e ← Voltar ao lead; cabe em 390 px
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const ops=[];let falhar=false;
await ctx.route('**/*',async r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();
  if(u.startsWith('https://script.google.com/')){let out={ok:true};if(r.request().method()==='POST'){const bd=JSON.parse(r.request().postData()||'{}');if(bd.gcal){bd.gcal.ops.forEach(o=>ops.push(o));out={ok:true,gcal:bd.gcal.ops.map(o=>falhar?{id:o.id,ok:false,erro:'sem permissão na agenda'}:{id:o.id,ok:true,gcalId:'g_'+o.id,gcalCal:''})};}}
    return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(out)});}
  return r.abort();});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.meta.monitor={...db.meta.monitor,roboUrl:'https://script.google.com/macros/s/X/exec',roboToken:'tok'};
  db.meta.gcal={modo:'direto',ativadoEm:new Date(Date.now()-864e5).toISOString(),auto:{lead:1}};db.meta.leadGcalMig=true;save();
  window._abertos=[];window.open=(u)=>{_abertos.push(u);return null;};});
const novo=async(nome)=>{await p.evaluate(()=>formLead({}));await p.waitForTimeout(200);await p.fill('[name=nome]',nome);await p.fill('[name=telefone]','14999990000');
  await p.fill('[name=proximoContato]',await p.evaluate(()=>addDays(today(),3)));};
// botões do rodapé: os de antes no mesmo lugar, o novo acrescentado depois
await novo('Lead Continua');
const foot=await p.evaluate(()=>[...document.querySelectorAll('#mForm .mfoot button')].map(x=>x.textContent.trim()));console.log('rodapé:',foot);
if(foot.join('|')!=='Cancelar|Salvar|Salvar e continuar →')ERR.push('rodapé do lead diferente do esperado');
await p.click('#ldCont');await p.waitForTimeout(1500);
const t0=await p.evaluate(()=>mForm.innerText);if(!/ainda não está na Google Agenda/.test(t0)||ops.length)ERR.push('lembrete foi sozinho ou a tela não diz que ainda não está');
const pf=await p.evaluate(()=>[...document.querySelectorAll('#mForm .mfoot button')].map(x=>x.textContent.trim()));console.log('rodapé da tela seguinte:',pf);if(!pf.includes('← Voltar ao lead'))ERR.push('sem “← Voltar ao lead”');
await p.click('#lpEnviar');await p.waitForTimeout(1200);
const t1=await p.evaluate(()=>({tit:document.getElementById('mTitle').textContent,txt:mForm.innerText}));console.log('tela seguinte:',t1.tit,'|',t1.txt.replace(/\s+/g,' ').slice(0,260));
if(!/Próximos passos do lead/.test(t1.tit))ERR.push('Salvar e continuar não abriu a tela seguinte');
if(!/já está na sua Google Agenda/.test(t1.txt))ERR.push('tela seguinte não mostra que foi para a Google Agenda');
await p.click('#lpAbrir');const ab1=await p.evaluate(()=>_abertos.slice(-1)[0]||'');console.log('abrir (já na agenda):',ab1);
if(!/calendar\.google\.com\/calendar\/r\/day\//.test(ab1))ERR.push('não abriu o dia na Google Agenda');
// largura de celular
const larg=await p.evaluate(()=>{let m=0;document.querySelectorAll('#modal *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.right>m)m=r.right;});return Math.round(m);});console.log('largura:',larg);if(larg>390)ERR.push('tela seguinte passa de 390 px');
await p.click('#lpVolta');await p.waitForTimeout(200);
const volta=await p.evaluate(()=>({tit:document.getElementById('mTitle').textContent,nome:mForm.elements.nome&&mForm.elements.nome.value}));console.log('voltou:',volta);if(volta.tit!=='Editar lead'||volta.nome!=='Lead Continua')ERR.push('não voltou ao formulário do lead');
await p.click('#mCancel');
// robô recusa: mostra o motivo; abrir a Google Agenda preenchida e não duplicar depois
falhar=true;await novo('Lead Robo Falha');await p.click('#ldCont');await p.waitForTimeout(800);await p.click('#lpEnviar');await p.waitForTimeout(1200);
const t2=await p.evaluate(()=>mForm.innerText);console.log('falha:',t2.replace(/\s+/g,' ').slice(0,220));
if(!/ainda não foi para a Google Agenda/.test(t2)||!/sem permissão/.test(t2))ERR.push('não mostrou o motivo da falha');
await p.click('#lpAbrir');const ab2=await p.evaluate(()=>_abertos.slice(-1)[0]||'');console.log('abrir (preenchida):',ab2.slice(0,120));
if(!/action=TEMPLATE/.test(ab2)||!/Lead\+Robo\+Falha|Lead%20Robo%20Falha/.test(ab2))ERR.push('não abriu a Google Agenda com o lembrete preenchido');
falhar=false;ops.length=0;await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(500);
console.log('depois de aberto à mão:',ops.map(o=>o.acao+':'+o.titulo));if(ops.some(o=>/Lead Robo Falha/.test(o.titulo)))ERR.push('enviou de novo pelo robô (duplicaria)');
// salvar o lead de novo na mesma data não volta a pedir o envio
await p.evaluate(()=>{const l=db.leads.find(x=>x.nome==='Lead Robo Falha');sincronizarLembreteLead(l);});ops.length=0;await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(400);
if(ops.some(o=>/Lead Robo Falha/.test(o.titulo)))ERR.push('salvar de novo pediu envio duplicado');
await p.click('#mCancel');
// envio direto desligado: a tela seguinte e a ficha oferecem abrir a Google Agenda
await p.evaluate(()=>{db.meta.gcal={...db.meta.gcal,modo:'link'};save();});await novo('Lead Sem Robo');await p.click('#ldCont');await p.waitForTimeout(600);
const t3=await p.evaluate(()=>mForm.innerText);if(!/abra a tela do Google/.test(t3)||!(await p.$('#lpAbrir')))ERR.push('sem envio direto: tela seguinte sem a opção de abrir');
await p.click('#lpFicha');await p.waitForTimeout(300);const ficha=await p.evaluate(()=>document.body.innerText);
console.log('ficha sem robô:',/abrir na Google Agenda|aberto no Google/.test(ficha));if(!/abrir na Google Agenda|aberto no Google/.test(ficha))ERR.push('ficha sem opção de abrir a Google Agenda');
// sem data: só avisa
await p.evaluate(()=>formLead({}));await p.waitForTimeout(200);await p.fill('[name=nome]','Lead Sem Data');await p.click('#ldCont');await p.waitForTimeout(500);
if(!/Sem data de próximo contato/.test(await p.evaluate(()=>mForm.innerText)))ERR.push('sem data: aviso ausente');
// Salvar comum continua só salvando
await p.evaluate(()=>formLead({}));await p.waitForTimeout(200);await p.fill('[name=nome]','Lead Salvar Comum');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(500);
if(await p.evaluate(()=>!document.getElementById('modal').classList.contains('hidden')))ERR.push('Salvar comum abriu a tela seguinte');
// compromisso: “Salvar e continuar →” leva aos próximos passos com Google Agenda, WhatsApp (sem cliente: escolher o contato) e voltar; nada vai sozinho
await p.evaluate(()=>{db.meta.gcal={...db.meta.gcal,modo:'direto'};save();formPrazo({});});await p.waitForTimeout(200);ops.length=0;
if(!await p.isChecked('[name=lembrete]'))ERR.push('“Criar lembrete” do compromisso não vem marcado');
await p.fill('[name=titulo]','Reunião interna');await p.fill('[name=data]',await p.evaluate(()=>addDays(today(),2)));await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(900);
const pp=await p.evaluate(()=>({tit:document.getElementById('mTitle').textContent,g:!!document.getElementById('ppGcal'),w:document.getElementById('ppWaLivre')?.href||'',v:!!document.getElementById('ppVolta')}));
console.log('próximos passos do compromisso:',pp.tit,pp.g,pp.v,pp.w.slice(0,60));if(!/Próximos passos/.test(pp.tit)||!pp.g||!pp.v||!/wa\.me\/\?text=.*Reuni/.test(pp.w))ERR.push('próximos passos do compromisso incompletos');
await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(400);if(ops.length)ERR.push('compromisso foi sozinho para a Google Agenda');
await p.click('#ppGcal');await p.waitForTimeout(800);if(!ops.some(o=>o.titulo==='Reunião interna'))ERR.push('Enviar à Google Agenda do compromisso não gravou');
// “Criar lembrete” desmarcado: a tela seguinte não oferece Google Agenda/WhatsApp; ao editar, continua desmarcado
await p.evaluate(()=>{closeModal();formPrazo({tipo:'Tarefa'});});await p.waitForTimeout(200);await p.fill('[name=titulo]','Tarefa sem lembrete');await p.uncheck('[name=lembrete]');
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(900);
const sem=await p.evaluate(()=>({g:!!document.getElementById('ppGcal'),txt:mForm.innerText}));if(sem.g||!/desmarcado/.test(sem.txt))ERR.push('lembrete desmarcado ainda oferece a Google Agenda');
await p.click('#ppVolta');await p.waitForTimeout(200);if(await p.isChecked('[name=lembrete]'))ERR.push('desmarcado voltou marcado');
console.log('ERROS',[...ERR,...errs]);await b.close();})();
