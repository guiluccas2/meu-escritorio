// Publicações: só “✔ marcar como lida” tira a publicação das novas — registrar andamento, criar prazo e lançar em lote não tiram
// (mostram “✔ andamento registrado” / “✔ prazo criado”); botões das opções do mesmo tamanho, fundo branco e texto preto;
// formulário do prazo: início | hora · término | hora · prazo fatal | dia inteiro
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const ERR=[];
(async()=>{const b=await chromium.launch();
for(const W of [1280,390]){
const ctx=await b.newContext({viewport:{width:W,height:900}});await ctx.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
const pr=await p.evaluate(()=>{const pr=db.processos.find(x=>!x.servico&&x.numero);const t='Fica V. Sa. intimado para se manifestar no prazo de 15 dias sobre o laudo pericial.';
  ['pA','pB','pC'].forEach((id,i)=>db.monitor.push({id,tipo:'publicacao',status:'nova',numero:pr.numero,tribunal:'TJSP',data:addDays(today(),-2),texto:t+' '+i,fonte:'DJEN',link:'https://exemplo.invalid/doc'}));save();go('#/publicacoes');return pr.id;});
await p.waitForTimeout(500);
// botões: mesmo tamanho, fundo branco, texto preto
const bt=await p.evaluate(()=>{const li=[...document.querySelectorAll('.li')].find(x=>x.querySelector('[data-id="pA"]'));
  return [...li.querySelectorAll('.pubOps>.btn,.pubOps>.mini,.pubOps>a.mini,.pubOps>.relMenu>summary')].map(e=>{const c=getComputedStyle(e);return {t:e.textContent.trim().slice(0,14),h:Math.round(e.getBoundingClientRect().height),fs:c.fontSize,bg:c.backgroundColor,cor:c.color};});});
console.log(W,'botões:',bt.map(x=>x.t+' '+x.h+'px '+x.fs+' '+x.bg+' '+x.cor).join(' | '));
if(bt.length<6)ERR.push(W+': faltam botões');if(new Set(bt.map(x=>x.h+x.fs)).size!==1)ERR.push(W+': botões de tamanhos diferentes');
if(bt.some(x=>x.bg!=='rgb(255, 255, 255)'||x.cor!=='rgb(17, 17, 17)'))ERR.push(W+': botão sem fundo branco/texto preto');
const larg=await p.evaluate(()=>{let m=0;document.querySelectorAll('#view .li, #view .li *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.right>m)m=r.right;});return Math.round(m);});if(larg>W)ERR.push(W+': publicações passam da largura ('+larg+')');
if(W===390){await ctx.close();continue;}
// criar prazo: continua nas novas, com “✔ prazo criado”
await p.click('[data-act=pubPrazo][data-id=pA]');await p.waitForTimeout(400);
const ord=await p.evaluate(()=>{const o=['data','hora','dataFim','horaFim','dataFatal','diaInteiro'].map(n=>{const r=mForm.elements[n].closest('.fld').getBoundingClientRect();return [n,Math.round(r.top),Math.round(r.left)];});return o;});
console.log('datas:',JSON.stringify(ord));
const lin=k=>ord.find(x=>x[0]===k);
if(!(lin('data')[1]===lin('hora')[1]&&lin('dataFim')[1]===lin('horaFim')[1]&&lin('dataFatal')[1]===lin('diaInteiro')[1]&&lin('data')[1]<lin('dataFim')[1]&&lin('dataFim')[1]<lin('dataFatal')[1]&&lin('data')[2]<lin('hora')[2]&&lin('dataFatal')[2]<lin('diaInteiro')[2]))ERR.push('ordem das datas no formulário');
await p.click('[name=diaInteiro]');const ord2=await p.evaluate(()=>{const r=n=>mForm.elements[n].closest('.fld').getBoundingClientRect();return [r('dataFim').top===r('horaFim').top||r('horaFim').height===0, getComputedStyle(mForm.elements.hora.closest('.fld')).visibility, Math.round(r('dataFatal').top)===Math.round(r('diaInteiro').top)];});
if(ord2[1]!=='hidden'||!ord2[2])ERR.push('dia inteiro desalinhou as datas: '+ord2);await p.click('[name=diaInteiro]');
await p.evaluate(()=>{if(!mForm.elements.data.value)mForm.elements.data.value=addDays(today(),10);mForm._modo='fechar';mForm.requestSubmit();});await p.waitForTimeout(500);
const sA=await p.evaluate(()=>({st:byId('monitor','pA').status,pz:!!byId('prazos',byId('monitor','pA').prazoId),vis:!!document.querySelector('[data-act=pubPrazo][data-id=pA]'),tag:/prazo criado/.test([...document.querySelectorAll('.li')].find(x=>x.querySelector('[data-id="pA"]'))?.innerText||'')}));
console.log('criar prazo:',sA);if(sA.st!=='nova'||!sA.pz||!sA.vis||!sA.tag)ERR.push('criar prazo tirou a publicação das novas (ou sem “prazo criado”)');
// registrar andamento: continua nas novas
await p.evaluate(()=>{closeModal&&closeModal();});await p.click('[data-act=pubAnd][data-id=pB]');await p.waitForTimeout(400);
await p.evaluate(()=>{mForm.requestSubmit();});await p.waitForTimeout(500);
const sB=await p.evaluate(()=>({st:byId('monitor','pB').status,and:!!byId('andamentos',byId('monitor','pB').andamentoId),vis:!!document.querySelector('[data-act=pubAnd][data-id=pB]')}));
console.log('andamento:',sB);if(sB.st!=='nova'||!sB.and||!sB.vis)ERR.push('registrar andamento tirou a publicação das novas');
// lote: não tira e não repete o andamento já registrado
await p.evaluate(()=>closeModal());const nAnd=await p.evaluate(()=>db.andamentos.length);
await p.evaluate(()=>A.pubLote());await p.waitForTimeout(300);await p.evaluate(()=>mForm.requestSubmit());await p.waitForTimeout(500);
const sL=await p.evaluate(n=>({st:['pA','pB','pC'].map(i=>byId('monitor',i).status).join(','),novos:db.andamentos.length-n}),nAnd);
console.log('lote:',sL);if(sL.st!=='nova,nova,nova')ERR.push('lote tirou publicações das novas');if(sL.novos!==2)ERR.push('lote: esperava 2 andamentos novos (pA e pC), veio '+sL.novos);
// marcar como lida: sai
await p.evaluate(()=>{closeModal();render();});await p.waitForTimeout(200);await p.click('[data-act=monStatus][data-id=pA][data-st=lida]');await p.waitForTimeout(300);
const sR=await p.evaluate(()=>({st:byId('monitor','pA').status,vis:!!document.querySelector('[data-act=pubPrazo][data-id=pA]')}));
if(sR.st!=='lida'||sR.vis)ERR.push('marcar como lida não tirou a publicação');
console.log('errs',errs);if(errs.length)ERR.push(...errs);await ctx.close();}
console.log('ERROS',ERR);await b.close();})();
