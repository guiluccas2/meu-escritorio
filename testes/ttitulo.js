// Título das fichas: nome comprido quebra linha, os botões ficam sempre na mesma linha e no mesmo lugar (computador e celular)
const {chromium}=require('playwright');const path=require('path');const ERR=[];
(async()=>{const b=await chromium.launch();
for(const [w,h] of [[1300,800],[1024,800],[390,800]]){
  const ctx=await b.newContext({viewport:{width:w,height:h}});
  await ctx.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);
  const pos=await p.evaluate(async()=>{const r={};
    for(const nome of ['Ana','Weberton Miguel Moreira Xavier Filho de Albuquerque Cavalcanti Pereira da Silva Santos']){
      const x=upsert('pessoas',{nome,tipo:'Cliente',pasta:'P0146'});save();go('#/pessoa/'+x.id);await new Promise(s=>setTimeout(s,150));
      const bs=[...document.querySelectorAll('#view h1 .h1b .btn')];
      r[nome.length>5?'longo':'curto']={n:bs.length,tops:bs.map(b=>Math.round(b.getBoundingClientRect().top)),lefts:bs.map(b=>Math.round(b.getBoundingClientRect().left)),
        nomeH:Math.round(document.querySelector('#view h1 .h1t').getBoundingClientRect().height),larg:document.documentElement.scrollWidth};}
    return r;});
  console.log(w+'px:',JSON.stringify(pos));
  if(!pos.longo.n)ERR.push(w+'px: botões não encontrados no grupo do título');
  if(w>=1300&&new Set(pos.longo.tops).size!==1)ERR.push(w+'px: botões em mais de uma linha com nome comprido');
  if(JSON.stringify(pos.longo.lefts)!==JSON.stringify(pos.curto.lefts))ERR.push(w+'px: botões mudaram de coluna com nome comprido');
  if(w>900&&JSON.stringify(pos.longo.lefts)!==JSON.stringify(pos.curto.lefts))ERR.push(w+'px: botões mudaram de lugar com nome comprido');
  if(w>900&&pos.longo.nomeH<=pos.curto.nomeH)ERR.push(w+'px: nome comprido não quebrou linha');
  if(pos.longo.larg>w)ERR.push(w+'px: tela passou da largura');
  if(errs.length)ERR.push(w+'px: erros '+errs.join(' | '));
  if(w===1300)await p.screenshot({path:process.env.SHOT||'/dev/null',clip:{x:0,y:0,width:w,height:200}}).catch(()=>{});
  await ctx.close();}
await b.close();console.log('ERROS:',JSON.stringify(ERR));process.exit(ERR.length?1:0);})();
