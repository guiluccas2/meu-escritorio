// Financeiro — etapa 1: plano de contas, contas bancárias, planos de recebimento, migração das categorias antigas, workflows
const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
// lançamentos antigos (só categoria)
await p.evaluate(()=>{const t=today();['Honorários contratuais','Honorários de êxito','Valor do cliente (a repassar)','Repasse ao cliente','Custas / despesas do processo','Despesa do escritório','Impostos'].forEach((c,i)=>db.financeiro.push({id:'L'+i,natureza:/Repasse|Custas|Despesa|Impostos/.test(c)?'saida':'entrada',categoria:c,descricao:c,valor:100*(i+1),vencimento:t,pagoEm:i%2?t:'',valorPago:i%2?100*(i+1):''}));save();});
console.log('migração:',await p.evaluate(()=>db.financeiro.filter(l=>/^L\d/.test(l.id)).map(l=>l.categoria.split(' ')[0]+'→'+contaDe(l).cod+'/'+contaDe(l).kind).join(' ')));
console.log('isRec/isDesp:',await p.evaluate(()=>db.financeiro.filter(l=>/^L\d/.test(l.id)).map(l=>(isRec(l)?'R':isDesp(l)?'D':'-')).join('')));
// telas
await p.evaluate(()=>go('#/financeiro'));await p.waitForTimeout(300);console.log('abas:',await p.evaluate(()=>[...document.querySelectorAll('.finAbas a')].map(a=>a.textContent).join('|')));
await p.evaluate(()=>go('#/financeiro/cadastros'));await p.waitForTimeout(300);await p.screenshot({path:SS+'fin_cad.png',fullPage:true});
console.log('raízes esc:',await p.evaluate(()=>[...document.querySelectorAll('.pcL')].filter(x=>x.style.getPropertyValue('--n').trim()==='0').map(x=>x.querySelector('code').textContent).join(',')));
// nova conta no grupo 1.1
await p.click('.pcL [data-act=pcToggle][data-id=pc1]').catch(()=>{});await p.waitForTimeout(100);
await p.evaluate(()=>formConta(null,'pc1_1'));await p.waitForTimeout(200);console.log('código sugerido:',await p.inputValue('[name=cod]'));
await p.fill('[name=nome]','Honorários iniciais de serviços');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(200);
console.log('nova conta:',await p.evaluate(()=>{const c=planoContas().find(x=>x.nome==='Honorários iniciais de serviços');return c.cod+' '+c.nat+' '+c.kind+' pai='+c.pai}));
// renomear conta de sistema mantém ligação
await p.evaluate(()=>{const L=pcGarantirEditavel();L.find(x=>x.chave==='hon_contr').nome='Honorários contratuais (contrato)';save();});
console.log('renome mantém:',await p.evaluate(()=>contaDe(byId('financeiro','L0')).nome+' | isRec='+isRec(byId('financeiro','L0'))));
// excluir conta usada → bloqueado
await p.evaluate(()=>formConta(pcById('pc2_1_99')));await p.waitForTimeout(200);console.log('botão excluir em conta de sistema:',await p.evaluate(()=>!!document.getElementById('mDel')));await p.evaluate(()=>closeModal());
// conta bancária + plano de recebimento
await p.evaluate(()=>formContaBanc(null));await p.waitForTimeout(200);await p.fill('[name=nome]','Banco Inter PJ');await p.fill('[name=saldoInicial]','1000');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(200);
console.log('contas bancárias:',await p.evaluate(()=>contasBanc().map(c=>c.nome+'('+c.ambito+')').join(', ')));
console.log('plano Entrada+30/60:',await p.evaluate(()=>prDatas(prById('pr_e3060'),'2026-11-19').join(' ')),'| 10x:',await p.evaluate(()=>prDatas(prById('pr_10x'),'2026-11-19').slice(0,3).join(' ')),'| final:',await p.evaluate(()=>JSON.stringify(prDatas(prById('pr_final'),'2026-11-19'))));
// novo lançamento pelo formulário com conta e pessoal
await p.evaluate(()=>{closeModal();formFin({natureza:'saida'})});await p.waitForTimeout(300);
await p.selectOption('[name=ambito]','pes');await p.waitForTimeout(100);console.log('contas pessoais:',await p.evaluate(()=>[...document.querySelectorAll('#fConta optgroup')].map(g=>g.label.split(' ')[0]).join(',')));
await p.selectOption('#fConta','pc6_2_01');await p.fill('[name=descricao]','Mercado');await p.fill('[name=valor]','350');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(300);
console.log('lanç. pessoal:',await p.evaluate(()=>{const l=db.financeiro.find(x=>x.descricao==='Mercado');return contaDe(l).nome+' amb='+ambDe(l)+' isDesp='+isDesp(l)}));
await p.evaluate(()=>go('#/financeiro'));await p.waitForTimeout(200);console.log('Mercado no escritório?',await p.evaluate(()=>document.getElementById('view').textContent.includes('Mercado')));
await p.click('[data-act=finAmb][data-v=pes]');await p.waitForTimeout(300);console.log('Mercado no pessoal?',await p.evaluate(()=>document.getElementById('view').textContent.includes('Mercado')));
// baixa com conta bancária
await p.evaluate(()=>{FIN_AMB='esc';payFin('L0')});await p.waitForTimeout(300);console.log('conta na baixa:',await p.evaluate(()=>mForm.elements.contaBanc?.selectedOptions[0]?.textContent));
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(200);console.log('baixa:',await p.evaluate(()=>byId('financeiro','L0').contaBanc?'ok':'sem conta'));
// workflow lançamento com conta + verificação
await p.evaluate(()=>{db.meta.workflows=[{id:'wl',titulo:'Lanç',ativo:true,gatilhos:[{ev:'pessoa_criada'}],passos:[{id:'x',acao:'lancamento',natureza:'entrada',conta:'pc1_1_04',titulo:'Consulta {cliente}',valor:'300',qtd:0,ref:'gatilho'}]}];save();upsert('pessoas',{nome:'Rita Gomes',tipo:'Cliente'});});
await p.waitForTimeout(400);console.log('wf lançamento:',await p.evaluate(()=>{const l=db.financeiro.find(x=>/Consulta Rita/.test(x.descricao));return l?contaDe(l).nome+' cat='+l.categoria:'não criou'}));
await p.evaluate(()=>{const L=pcGarantirEditavel();L.find(x=>x.id==='pc1_1_04').ativo=false;save();});console.log('wf problema:',await p.evaluate(()=>wfProblemas(wfs()[0]).join(' | ')));
// CSV
console.log('ERROS',errs);
await p.setViewportSize({width:390,height:844});await p.evaluate(()=>go('#/financeiro/cadastros'));await p.waitForTimeout(300);await p.screenshot({path:SS+'fin_cad_mob.png'});
console.log('overflow mob:',await p.evaluate(()=>document.documentElement.scrollWidth));await b.close();})();
