const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
await p.evaluate(()=>{const N=+((location.hash.match(/n=(\d+)/)||[])[1]||1);const r=n=>Math.floor(Math.random()*n);const t0=today();
 const P=[];for(let i=0;i<1500;i++)P.push({id:uid(),nome:'Pessoa '+i+' Silva',tipo:'Cliente',pasta:'P'+String(i).padStart(4,'0'),telefone:'(19) 9'+r(1e8),email:'p'+i+'@x.com',cpf:''});db.pessoas=P;
 const PR=[];for(let i=0;i<2500;i++)PR.push({id:uid(),clienteId:P[r(P.length)].id,titulo:'Ação trabalhista '+i,numero:`00${r(99999)}-${r(99)}.2024.5.15.0${r(999)}`,area:'Trabalhista',status:'Ativo',fase:OPT.faseProc[r(5)],tribunal:'TRT15'});db.processos=PR;
 const PZ=[];for(let i=0;i<12000;i++){const pr=PR[r(PR.length)];PZ.push({id:uid(),processoId:pr.id,pessoaId:pr.clienteId,titulo:'Prazo '+i,tipo:OPT.tipoPrazo[r(5)],data:addDays(t0,r(400)-200),hora:'10:00',situacao:'Pendente',concluido:Math.random()<.7,coluna:'tarefas'});}db.prazos=PZ;
 const AN=[];for(let i=0;i<40000;i++)AN.push({id:uid(),processoId:PR[r(PR.length)].id,data:addDays(t0,-r(900)),tipo:'Outro',descricao:'Andamento qualquer com algum texto descritivo número '+i});db.andamentos=AN;
 const CV=[];for(let i=0;i<8000;i++)CV.push({id:uid(),pessoaId:P[r(P.length)].id,dataHora:addDays(t0,-r(700))+'T10:00',assunto:'Conversa '+i,relato:'Relato '+i});db.conversas=CV;
 const F=[];for(let i=0;i<9000;i++)F.push({id:uid(),natureza:Math.random()<.6?'entrada':'saida',categoria:'Honorários',descricao:'Lanc '+i,valor:r(5000),vencimento:addDays(t0,r(600)-300),pessoaId:P[r(P.length)].id});db.financeiro=F;
 const L=[];for(let i=0;i<1500;i++)L.push({id:uid(),nome:'Lead '+i,status:OPT.statusLead[r(4)],data:addDays(t0,-r(300))});db.leads=L;
 const M=[];for(let i=0;i<6000;i++)M.push({id:uid(),tipo:'publicacao',numero:PR[r(PR.length)].numero,data:addDays(t0,-r(300)),titulo:'Intimação',texto:'Texto da publicação '.repeat(20)});db.monitor=M;
 let t=performance.now();save();salvarAgora();window._tsave=performance.now()-t;window._tam=JSON.stringify(db).length;});
console.log('save ms',await p.evaluate(()=>window._tsave|0),'tamanho MB',await p.evaluate(()=>(window._tam/1e6).toFixed(1)));

async function perfil(v){const cdp=await p.context().newCDPSession(p);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:200});await cdp.send('Profiler.start');
 await p.evaluate(v=>{go('#/'+v);render();},v);const {profile}=await cdp.send('Profiler.stop');
 const self={};const dt=profile.timeDeltas;const idx={};profile.nodes.forEach(n=>idx[n.id]=n);profile.samples.forEach((id,k)=>{const n=idx[id];const key=n.callFrame.functionName+' '+n.callFrame.url.split('/').pop().split('?')[0]+':'+n.callFrame.lineNumber;self[key]=(self[key]||0)+(dt[k]||0)});
 console.log('--',v,Object.entries(self).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,t])=>k+' '+(t/1000|0)+'ms').join(' | '));}
if(process.env.DOM){for(const v of ['painel','inicio','conversas','agenda','publicacoes','processos','pessoas','leads','financeiro']){const r=await p.evaluate(v=>{go('#/'+v);render();const V=document.getElementById('view');const big=[...V.querySelectorAll('*')].filter(e=>e.children.length>40).map(e=>(e.id||e.className||e.tagName)+':'+e.children.length).slice(0,4);return V.querySelectorAll('*').length+' '+big.join(' ')},v);console.log('DOM',v,r);}await b.close();return;}
if(process.env.PERF){for(const v of process.env.PERF.split(','))await perfil(v);await b.close();return;}
const views=['painel','inicio','conversas','agenda','publicacoes','processos','pessoas','leads','financeiro','financeiro/receber','financeiro/pagar','financeiro/cadastros','financeiro/repasses','financeiro/movimentacoes','financeiro/relatorios','servicos','biblioteca','horas','workflows','config'];
for(const v of views){const ms=await p.evaluate(async v=>{const t=performance.now();go('#/'+v);render();return performance.now()-t},v);console.log(v.padEnd(12),(ms|0)+'ms');}
const pr=await p.evaluate(()=>db.processos[0].id), ps=await p.evaluate(()=>db.pessoas[0].id);
for(const h of ['processo/'+pr,'pessoa/'+ps]){const ms=await p.evaluate(async h=>{const t=performance.now();go('#/'+h);render();return performance.now()-t},h);console.log(h.slice(0,8).padEnd(12),(ms|0)+'ms');}
const ms=await p.evaluate(()=>{const t=performance.now();for(let i=0;i<20;i++)upsert('prazos',{titulo:'x'+i,data:today()});return (performance.now()-t)/20});console.log('upsert+save médio',ms|0,'ms');
const bus=await p.evaluate(()=>{const i=document.querySelector('#busca,#q,input[type=search]');if(!i)return 'sem busca';const t=performance.now();i.value='Silva 12';i.dispatchEvent(new Event('input',{bubbles:true}));return performance.now()-t});console.log('busca',bus);
console.log('verificação ms',await p.evaluate(()=>{const t=performance.now();vincProblemas();return (performance.now()-t)|0}));console.log('ERROS',errs.slice(0,5));await b.close();})();
