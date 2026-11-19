// Auditoria do celular: todas as telas e formulários principais a 390 px — nada pode vazar da largura da tela
const {chromium,devices}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13']});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);await p.waitForTimeout(300);
const W=await p.evaluate(()=>innerWidth);
const vaza=()=>p.evaluate(W=>{const out=[];document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||getComputedStyle(e).visibility==='hidden')return;let a=e.parentElement,clip=false;while(a&&a!==document.body){const o=getComputedStyle(a).overflowX;if(o==='auto'||o==='scroll'||o==='hidden'){clip=true;break}a=a.parentElement}
 if(!clip&&(r.right>W+1||r.left<-1))out.push((e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+[...e.classList].join('.'))+':'+Math.round(r.right))});return {sw:document.documentElement.scrollWidth,itens:[...new Set(out)].slice(0,5)}},W);
const views=['painel','conversas','agenda','publicacoes','processos','servicos','pessoas','leads','financeiro','horas','workflows','config','listas','processo/'+await p.evaluate(()=>MP.p1.id),'pessoa/'+await p.evaluate(()=>MP.ed.id)];
for(const v of views){await p.evaluate(v=>go('#/'+v),v);await p.waitForTimeout(250);const r=await vaza();console.log(v.split('/')[0].padEnd(12),r.sw>W?'❌ '+r.sw:'ok',r.itens.join(' '));if(process.env.FOTOS)await p.screenshot({path:SS+'cel_'+v.split('/')[0]+'.png'});}
const forms={compromisso:'A.newPrazo({})',processo:'A.newProc({})',pessoa:'A.newPessoa({})',lead:'A.newLead({})',conversa:'A.newConv({})',andamento:'A.newAnd({})',lancamento:'A.newFin({})',workflow:'A.wfNovo()',backups:'A.bkVer()'};
for(const [n,c] of Object.entries(forms)){await p.evaluate('closeModal()');await p.evaluate(c).catch(e=>console.log(n,'ERRO',e.message));await p.waitForTimeout(400);
 await p.evaluate(()=>document.querySelectorAll('#mForm details').forEach(d=>d.open=true));await p.waitForTimeout(100);const r=await vaza();console.log(('form '+n).padEnd(17),r.sw>W?'❌ '+r.sw:'ok',r.itens.join(' '));if(process.env.FOTOS)await p.screenshot({path:SS+'celf_'+n+'.png'});}
console.log('ERROS',errs);await b.close();})();
