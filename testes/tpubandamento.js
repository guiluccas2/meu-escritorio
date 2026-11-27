// “Registrar andamento” da publicação: a descrição sai sem as quebras fixas do DJEN/Recorte (frases inteiras, link da audiência
// inteiro); andamentos antigos já gravados com quebras também aparecem juntos na ficha, com o link clicável
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const ERR=[];
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1280,height:900}});await ctx.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
const TXT='PODER JUDICIARIO JUSTICA DO TRABALHO TRIBUNAL REGIONAL DO TRABALHO DA\n15ª REGIAO - BAURU. Fica designada audiencia telepresencial para o dia\n10/12/2026 as 14h00. As partes deverao acessar a sala virtual pelo link:\nhttps://trt15-jus-br.zoom.us/j/82616787881?pwd=czZ3YmtER09jZFZzbGhIblE5b\nnhAdzBc Devem as partes acessar o ambiente virtual no horario designado,\ncom documento de identificacao com foto. Teams: https://teams.microsoft.\ncom/l/meetup-join/19%3ameeting_abc Intimem-se as partes e seus advogados.\n\nBauru, 20 de novembro de 2026.';
const pr=await p.evaluate(TXT=>{const pr=db.processos.find(x=>!x.servico&&x.numero);db.monitor.push({id:'pX',tipo:'publicacao',status:'nova',numero:pr.numero,tribunal:'TRT15',data:addDays(today(),-2),texto:TXT,fonte:'DJEN'});save();go('#/publicacoes');return pr.id;},TXT);
await p.waitForTimeout(500);
await p.click('[data-act=pubAnd][data-id=pX]');await p.waitForTimeout(400);
const d=await p.evaluate(()=>mForm.elements.descricao.value);
if(/DA\n15ª|para o dia\n10|link:\nhttps|designado,\ncom/.test(d))ERR.push('descrição ainda quebra no meio das frases:\n'+d);
if(!d.includes('https://trt15-jus-br.zoom.us/j/82616787881?pwd=czZ3YmtER09jZFZzbGhIblE5bnhAdzBc Devem'))ERR.push('link do Zoom quebrado: '+d);
if(!d.includes('https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc Intimem'))ERR.push('link do Teams quebrado: '+d);
if(!/advogados\.\n\nBauru/.test(d))ERR.push('parágrafo final perdeu a quebra');
// andamento antigo (gravado com as quebras) na ficha do processo: aparece junto e com link clicável
await p.evaluate(([id,TXT])=>{closeModal&&closeModal();upsert('andamentos',{id:'andV',processoId:id,data:today(),tipo:'Publicação / Intimação',descricao:TXT});save();go('#/processo/'+id);},[pr,TXT]);await p.waitForTimeout(400);await p.evaluate(()=>{const b=document.querySelector('[data-act=tab][data-tab=and]');b&&b.click();});
await p.waitForTimeout(500);
const h=await p.evaluate(()=>{const tb=[...document.querySelectorAll('.tl-item.and .tl-body')].find(e=>e.textContent.includes('PODER JUDICIARIO'));return tb?{t:tb.innerText,a:[...tb.querySelectorAll('a')].map(a=>a.href)}:null;});
if(!h)ERR.push('andamento não aparece na ficha');
else{ if(/DA\n15ª/.test(h.t))ERR.push('andamento antigo ainda picotado na ficha');
  if(!h.a.includes('https://trt15-jus-br.zoom.us/j/82616787881?pwd=czZ3YmtER09jZFZzbGhIblE5bnhAdzBc'))ERR.push('link do andamento não clicável/inteiro: '+h.a.join(' '));}
if(errs.length)ERR.push('erros: '+errs.join(' | '));
await b.close();
console.log(ERR.length?'✘ andamento da publicação':'✔ andamento da publicação sem quebras fixas, links inteiros e clicáveis');console.log('ERROS',JSON.stringify(ERR));process.exit(ERR.length?1:0);})();
