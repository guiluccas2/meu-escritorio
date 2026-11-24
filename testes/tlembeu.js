// Lembretes de WhatsApp: “eu mesmo” (cadastro marcado “sou eu”), vários contatos avulsos, e o lembrete enviado continua na lista riscado (desfazer / editar)
const {chromium}=require('playwright');const path=require('path');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:900}});
await ctx.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);
await p.evaluate(()=>{window.open=()=>null;
  upsert('pessoas',{nome:'Ana Cliente',tipo:'Cliente',pasta:'P0001',telefone:'(14) 99999-0001'});upsert('pessoas',{nome:'Carlos Contato',tipo:'Outro',telefone:'(14) 99999-0003'});
  upsert('pessoas',{nome:'Primeiro Eu',tipo:'Cliente',telefone:'(14) 99999-0009',souEu:true});save();});
// cadastro “sou eu”: marcar outro cadastro passa a marcação (só um)
await p.evaluate(()=>formPessoa({}));await p.waitForTimeout(200);
await p.fill('[name=nome]','Guilherme Advogado');await p.check('[name=souEu]');
await p.evaluate(()=>{const f=mForm;const t=f.querySelector('[name=telefone]');if(t)t.value='(14) 98888-7777';});
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(400);
const eus=await p.evaluate(()=>db.pessoas.filter(x=>x.souEu).map(x=>x.nome));console.log('sou eu:',eus);if(eus.length!==1||eus[0]!=='Guilherme Advogado')ERR.push('marcação “sou eu” não é única');
const tag=await p.evaluate(()=>{go('#/pessoa/'+db.pessoas.find(x=>x.souEu).id);return new Promise(r=>setTimeout(()=>r(document.querySelector('#view h1').textContent),300));});
if(!/sou eu/.test(tag))ERR.push('ficha sem a marca “sou eu”');
// compromisso com lembrete de WhatsApp para hoje: cliente + eu mesmo + 2 contatos avulsos (pelo editor)
const cli=await p.evaluate(()=>db.pessoas.find(x=>x.nome==='Ana Cliente').id);
await p.evaluate(cli=>formPrazo({tipo:'Reunião',titulo:'Reunião de alinhamento',pessoaId:cli,data:addDays(today(),1),hora:'10:00'}),cli);await p.waitForTimeout(300);
await p.evaluate(()=>{const g=mForm.querySelector('#gLemb');if(g)g.open=true;});
await p.click('[data-lbnovo=whats]');await p.waitForTimeout(100);
const euTxt=await p.textContent('#lbEd .lbP');console.log('opções:',euTxt.replace(/\s+/g,' '));if(!/eu mesmo/.test(euTxt))ERR.push('sem a opção “eu mesmo”');
await p.check('#lbEd .lPe');await p.click('#lbEd .lOadd');
await p.fill('#lbEd .lOr:nth-child(1) .lOn','Carlos Contato');await p.dispatchEvent('#lbEd .lOr:nth-child(1) .lOn','change');
const puxou=await p.inputValue('#lbEd .lOr:nth-child(1) .lOc');console.log('celular puxado do cadastro:',puxou);if(!/99999-0003/.test(puxou))ERR.push('não puxou o celular do cadastro');
await p.click('#lbEd .lOadd');await p.fill('#lbEd .lOr:nth-child(2) .lOn','Perito Avulso');await p.fill('#lbEd .lOr:nth-child(2) .lOc','14977776666');
await p.click('#lbEd .lOadd');await p.click('#lbEd .lOr:nth-child(3) .lOx');
const w0=await p.evaluate(()=>document.documentElement.scrollWidth);if(w0>390)ERR.push('editor não cabe em 390 px: '+w0);
await p.click('#lbOk');await p.waitForTimeout(100);
console.log('lista:',(await p.textContent('#lbLista')).replace(/\s+/g,' ').slice(0,90));
await p.evaluate(()=>{mForm._modo='fechar';});await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(400);
await p.evaluate(()=>closeModal());
const pz=await p.evaluate(()=>{const x=db.prazos.find(y=>y.titulo==='Reunião de alinhamento'),l=x.lembretes[0];return {id:x.id,para:l.para,outros:l.outros,dest:lembDestinos(x,l).map(d=>d.papel+':'+d.nome+':'+d.tel)};});
console.log('destinos:',pz.dest);if(pz.dest.length!==4||!pz.dest.some(d=>d.startsWith('eu:Guilherme Advogado:(14) 98888-7777')))ERR.push('destinos errados');
// agenda: 4 para enviar; enviar um → continua na lista, riscado, com desfazer e editar
await p.evaluate(()=>go('#/agenda'));await p.waitForTimeout(400);
const conta=async()=>p.evaluate(()=>({tot:document.querySelectorAll('#view .lb.whats').length,feitos:document.querySelectorAll('#view .lb.whats.lbFeito').length,tag:document.querySelector('#view .card h2 .tag')?.textContent}));
const N=await p.evaluate(()=>lembWhatsPendentes().length);let c=await conta();console.log('antes:',c,'pendentes:',N);if(N<4||c.tot!==N||c.feitos!==0)ERR.push('lista inicial errada');
await p.click('#view .lb.whats [data-act=lembEnviar]');await p.waitForTimeout(300);
c=await conta();console.log('após enviar:',c);if(c.tot!==N||c.feitos!==1||c.tag!==String(N-1))ERR.push('enviado sumiu ou não ficou riscado');
const risc=await p.evaluate(()=>{const r=document.querySelector('#view .lb.lbFeito');return {txt:r.textContent.replace(/\s+/g,' '),deco:getComputedStyle(r.querySelector('.lbTx')).textDecorationLine,bts:[...r.querySelectorAll('button')].map(x=>x.dataset.act)};});
console.log('riscado:',risc);if(risc.deco!=='line-through'||!/enviado em/.test(risc.txt)||!risc.bts.includes('lembDesfazer')||!risc.bts.includes('lembEditar'))ERR.push('enviado sem risco / desfazer / editar');
const w1=await p.evaluate(()=>document.documentElement.scrollWidth);if(w1>390)ERR.push('agenda não cabe em 390 px: '+w1);
await p.click('#view .lb.lbFeito [data-act=lembDesfazer]');await p.waitForTimeout(300);c=await conta();console.log('desfeito:',c);if(c.feitos!==0||c.tag!==String(N))ERR.push('desfazer não voltou');
// dispensar também fica riscado
await p.click('#view .lb.whats [data-act=lembDispensar]');await p.waitForTimeout(300);
const disp=await p.evaluate(()=>document.querySelector('#view .lb.lbFeito')?.textContent||'');console.log('dispensado:',/dispensado em/.test(disp));if(!/dispensado em/.test(disp))ERR.push('dispensado não ficou na lista');
// 🔔 e início contam só os pendentes
const av=await p.evaluate(()=>lembWhatsPendentes().length);if(av!==N-1)ERR.push('pendentes deveriam ser '+(N-1)+': '+av);
// editar abre o compromisso já no lembrete
await p.click('#view .lb.lbFeito [data-act=lembEditar]');await p.waitForTimeout(400);
const ed=await p.evaluate(()=>({tit:document.getElementById('mTitle').textContent,aberto:!!mForm.querySelector('#lbEd .lbForm'),linhas:mForm.querySelectorAll('#lbEd .lOr').length}));
console.log('editar:',ed);if(!/Editar compromisso/.test(ed.tit)||!ed.aberto||ed.linhas!==2)ERR.push('editar não abriu o lembrete');
await p.evaluate(()=>closeModal());
// sem cadastro “sou eu”: a verificação avisa
await p.evaluate(()=>{db.pessoas.forEach(x=>x.souEu=false);save();});
const ver=await p.evaluate(()=>VINCULOS.verificar.flatMap(f=>f()).map(x=>x.titulo).filter(t=>/eu mesmo/.test(t)));console.log('verificação:',ver);if(!ver.length)ERR.push('verificação não avisou da falta do cadastro “sou eu”');
// lembrete futuro (audiência daqui a 7 dias, WhatsApp 1 dia antes + tarefa 1 dia antes): aparece já no calendário, no dia do Início e em “Programados”
const fut=await p.evaluate(()=>{const sem=upsert('pessoas',{nome:'Bruno Sem Celular',tipo:'Cliente'}),ana=db.pessoas.find(x=>x.nome==='Ana Cliente');
  const a=upsert('prazos',{titulo:'Audiência futura',tipo:'Audiência',pessoaId:ana.id,data:addDays(today(),7),hora:'14:00',lembretes:[{id:'lw',tipo:'whats',qtd:1,unid:'d',hora:'09:00',para:['cliente']},{id:'lt',tipo:'tarefa',qtd:1,unid:'d',titulo:'Estudar o processo'}]});lembSincronizarTarefas(a);
  upsert('prazos',{titulo:'Reunião com Bruno',tipo:'Reunião',pessoaId:sem.id,data:addDays(today(),1),hora:'10:00',lembretes:[{id:'ls',tipo:'whats',qtd:0,unid:'d',hora:'09:00',para:['cliente']}]});save();
  const d=addDays(today(),6);return {d,dia:eventosDia(d).map(e=>e.titulo),hoje:eventosDia(today()).map(e=>e.titulo).filter(t=>/Bruno/.test(t))};});
console.log('dia do lembrete futuro:',fut.dia);if(!fut.dia.some(t=>/Lembrar Ana: Audiência futura/.test(t))||!fut.dia.some(t=>/Estudar o processo/.test(t)))ERR.push('WhatsApp futuro não aparece no dia do Início');
await p.evaluate(()=>{F.ag={...(F.ag||{})};go('#/agenda');});await p.waitForTimeout(400);
const prog=await p.evaluate(()=>{const dd=document.querySelector('#view .lbProg');return dd?dd.textContent.replace(/\s+/g,' '):'';});console.log('programados:',prog.slice(0,160));
if(!/Programados/.test(prog)||!/Ana Cliente — Audiência futura/.test(prog))ERR.push('agenda sem a lista de programados');
const semCel=await p.evaluate(()=>[...document.querySelectorAll('#view .lb.whats')].map(x=>x.textContent).find(t=>/Bruno/.test(t))||'');console.log('sem celular:',/sem celular/.test(semCel));if(!/sem celular/.test(semCel))ERR.push('destinatário sem celular não aparece com aviso');
const cal=await p.evaluate(d=>{agCalVis='mes';agMes=d.slice(0,7);document.getElementById('list').innerHTML=agendaCal();return [...document.querySelectorAll(`[data-d="${d}"] .chipZap`)].map(x=>x.textContent);},fut.d);
console.log('calendário:',cal);if(!cal.some(t=>/Ana/.test(t)))ERR.push('WhatsApp futuro não aparece no calendário da agenda');
console.log('ERROS',[...ERR,...errs]);await b.close();})();
