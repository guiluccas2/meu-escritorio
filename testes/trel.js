// Relatórios dentro das seções: PDF/Excel/Word em Agenda, Atendimentos, Serviços, Financeiro, Movimentações, Relatórios (demonstrativo e honorários), Horas, Processos/Pessoas; andamentos do período
const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000},acceptDownloads:true});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.meta.workflows=[];const t=today();db.andamentos.push({id:'an1',processoId:MP.p1.id,data:addDays(t,-3),tipo:'Despacho',descricao:'Designada audiência'},{id:'an2',processoId:MP.p2.id,data:addDays(t,-40),tipo:'Sentença',descricao:'Procedente'});
  db.financeiro.push({id:'f1',natureza:'entrada',conta:'pc1_1_01',categoria:'Honorários contratuais',descricao:'Honorários Higor',valor:1000,vencimento:t,pessoaId:MP.hi.id});
  MP.p1.contrato={itens:[{id:'i1',tipo:'percentual',pct:'30',descricao:'êxito'}]};db.horas.push({id:'h1',data:t,min:90,atividade:'Petição',processoId:MP.p1.id});save();});
// interceptar arquivos e impressão
await p.evaluate(()=>{window._dl=[];const o=window.download;window.download=(n,c,t)=>{window._dl.push({n,c:String(c)});};window._prints=0;const orig=HTMLIFrameElement.prototype;});
const gerar=async(rota,k,f)=>{await p.evaluate(r=>go(r),rota);await p.waitForTimeout(350);await p.evaluate(()=>document.querySelector('details.relMenu')?.setAttribute('open',''));
  const ok=await p.evaluate(([k,f])=>{const b=document.querySelector(`[data-act=rel][data-k="${k}"][data-f="${f}"]`);if(!b)return 'sem botão';b.click();return 'ok'},[k,f]);await p.waitForTimeout(200);return ok;};
const ult=()=>p.evaluate(()=>{const d=window._dl.at(-1);return d?d.n+' · '+(d.c.match(/<tr>/g)||d.c.split('\n')).length+' linhas':'nada'});
for(const [rota,k] of [['#/agenda','agenda'],['#/conversas','conversas'],['#/financeiro/receber','fin'],['#/financeiro/relatorios','dre'],['#/financeiro/relatorios','honor'],['#/horas','horas']]){
  console.log(k.padEnd(10),'excel:',await gerar(rota,k,'xls'),await ult(),'| word:',await gerar(rota,k,'doc'),await ult());}
// serviços
await p.evaluate(()=>upsert('processos',{servico:true,clienteId:MP.ed.id,tipoServico:'Consultoria',titulo:'Consultoria',statusServ:'Em andamento',status:'Ativo',seqServ:'1',partes:[],testemunhas:[]}));
console.log('servicos  ','excel:',await gerar('#/servicos','servicos','xls'),await ult());
// movimentações
await p.evaluate(()=>{db.meta.contasBanc=[{id:'bi',nome:'Inter',tipo:'banco',ambito:'esc',saldoInicial:100,dataSaldo:today().slice(0,8)+'01',ativo:true}];const l=byId('financeiro','f1');Object.assign(l,{pagoEm:today(),valorPago:1000,contaBanc:'bi'});MOV.cb='bi';MOV.vis='conta';save();});
console.log('mov       ','word:',await gerar('#/financeiro/movimentacoes','mov','doc'),await ult());
// processos/pessoas word
await p.evaluate(()=>go('#/processos'));await p.waitForTimeout(300);await p.click('[data-act=xRelTodos][data-col=processos][data-f=doc]');await p.waitForTimeout(200);console.log('processos word:',await ult());
// andamentos do período
await p.click('[data-act=andPeriodo]');await p.waitForTimeout(300);console.log('andamentos prévia:',await p.textContent('#apPrev'));
await p.click('[data-apf=xls]');await p.waitForTimeout(200);console.log('andamentos excel:',await ult(),'|',await p.evaluate(()=>window._dl.at(-1).c.split('\n')[1]?.slice(0,90)));
await p.evaluate(()=>closeModal());
// honorários contratados na tela
await p.evaluate(()=>go('#/financeiro/relatorios'));await p.waitForTimeout(300);console.log('card honorários:',await p.evaluate(()=>[...document.querySelectorAll('.card h2')].find(h=>/Honorários contratados/.test(h.textContent))?.textContent.trim().slice(0,90)));
await p.screenshot({path:SS+'rel_fin.png',fullPage:true});
// PDF abre impressão (iframe criado)
await p.evaluate(()=>go('#/agenda'));await p.waitForTimeout(300);await p.evaluate(()=>document.querySelector('details.relMenu').setAttribute('open',''));await p.screenshot({path:SS+'rel_menu.png'});
await p.evaluate(()=>document.querySelector('[data-act=rel][data-k=agenda][data-f=pdf]').click());await p.waitForTimeout(400);console.log('pdf iframe:',await p.evaluate(()=>[...document.querySelectorAll('iframe')].some(f=>/Agenda/.test(f.contentDocument?.title||''))));
console.log('ERROS',errs);await b.close();})();
