const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext();await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
const U='file://'+require('path').resolve(__dirname,'..','index.html');await p.goto(U);await p.waitForTimeout(500);
// pequeno
await p.evaluate(()=>{upsert('pessoas',{nome:'Ana Teste',tipo:'Cliente'});});await p.waitForTimeout(800);
await p.reload();await p.waitForTimeout(800);console.log('pequeno após recarregar:',await p.evaluate(()=>db.pessoas.length+' '+(localStorage.getItem(KEY)||'').length+' wf='+wfs().length));
// grande
await p.evaluate(()=>{for(let i=0;i<9000;i++)db.monitor.push({id:uid(),tipo:'publicacao',numero:'1',data:today(),titulo:'Intimação',texto:'Texto longo da publicação '.repeat(40)});save();});
await p.waitForTimeout(1500);
console.log('LS:',await p.evaluate(()=>(localStorage.getItem(KEY)||'').slice(0,60)),'erro:',await p.evaluate(()=>ARM.erro||'-'));
await p.reload();await p.waitForTimeout(1500);console.log('grande após recarregar:',await p.evaluate(()=>db.monitor.length+' pessoas='+db.pessoas.length+' carregando='+ARM.carregando));
// edição e fechamento imediato (pagehide)
await p.evaluate(()=>{addEventListener('pagehide',()=>sessionStorage.setItem('ph','1'));upsert('pessoas',{nome:'Bruno Rápido',tipo:'Cliente'});});await p.goto('about:blank');await p.goto(U);await p.waitForTimeout(1500);
console.log('pagehide?',await p.evaluate(()=>sessionStorage.getItem('ph')));console.log('edição antes de sair:',await p.evaluate(()=>db.pessoas.map(x=>x.nome).join(',')));
console.log('ERROS',errs);await b.close();})();
