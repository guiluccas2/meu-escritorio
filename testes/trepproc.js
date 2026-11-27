// Ficha do processo: parte menor/incapaz mostra o representante legal (do cadastro e/ou incluído no processo como “Representante legal de…”)
const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
const ok=(c,m)=>{if(!c)errs.push(m);console.log((c?'✔ ':'✘ ')+m);};
const ids=await p.evaluate(()=>{const mae=upsert('pessoas',{nome:'Mãe Teste Rep',tipo:'Parte contrária'});const pai=upsert('pessoas',{nome:'Pai Teste Rep',tipo:'Parte contrária'});
  const ayla=upsert('pessoas',{nome:'Ayla Teste Menor',tipo:'Parte contrária',menor:true,nascimento:'2018-03-01',representantes:[{pessoaId:mae.id,relacao:'Mãe'}]});
  const beto=upsert('pessoas',{nome:'Beto Teste Maior',tipo:'Parte contrária'});const tio=upsert('pessoas',{nome:'Tio Curador Rep',tipo:'Parte contrária'});
  const cli=db.pessoas.find(x=>x.tipo==='Cliente');
  const pr=upsert('processos',{titulo:'Alimentos rep',clienteId:cli.id,posicao:'Autor',status:'Ativo',partes:[{pessoaId:ayla.id,polo:'passivo'},{pessoaId:beto.id,polo:'passivo'},{pessoaId:tio.id,polo:'representante',representaId:beto.id},{pessoaId:pai.id,polo:'representante',representaId:ayla.id}]});
  return {pr:pr.id};});
await p.evaluate(id=>go('#/processo/'+id),ids.pr);await p.waitForTimeout(500);
const txt=await p.evaluate(()=>[...document.querySelectorAll('.repProc')].map(e=>e.textContent));console.log(txt);
ok(txt.some(t=>/Ayla|Mãe Teste Rep \(mãe\)/.test(t)&&/representado\(a\) por Mãe Teste Rep \(mãe\) e Pai Teste Rep/.test(t)),'menor: representante do cadastro + o incluído no processo');
ok(txt.some(t=>/representado\(a\) por Tio Curador Rep$/.test(t.trim())),'parte não marcada como menor, mas com representante no processo');
ok(txt.length===2,'só as partes representadas mostram a linha');
await b.close();console.log('ERROS',errs);})();
