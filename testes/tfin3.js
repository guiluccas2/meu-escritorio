// Financeiro — etapa 3: participações (conta comum e acordo), ajuste parcela a parcela, compensação, parceiro sobre honorários
const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.meta.workflows=[];db.financeiro=[];db.acordos=[];upsert('pessoas',{nome:'Dr. Paulo Ramos',tipo:'Advogado parceiro'});save();});
const sub=async()=>{await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(300);};
// 1) conta a receber comum com parceiro 40% (só quando receber, 2 dias)
await p.evaluate(()=>formFin({natureza:'entrada'}));await p.waitForTimeout(300);await p.fill('[name=descricao]','Honorários — contrato de compra e venda');await p.fill('[name=valor]','2000');
await p.evaluate(()=>document.getElementById('gfPart').open=true);await p.click('#fPart [data-ptadd]');await p.waitForTimeout(100);
await p.selectOption('#fPart [data-pt=pessoaId]',await p.evaluate(()=>db.pessoas.find(x=>x.nome==='Dr. Paulo Ramos').id));await p.fill('#fPart [data-pt=pct]','40');await p.fill('#fPart [data-pt=dias]','2');await sub();
console.log('parceiro criado:',await p.evaluate(()=>db.financeiro.filter(l=>l.partDe).map(l=>l.descricao.split('—').pop().trim()+' '+l.valor+' '+finStatus(l)+' conta='+contaDe(l).nome).join('')));
// receber 1500 parcial → parceiro proporcional
await p.evaluate(()=>payFin(db.financeiro.find(l=>l.natureza==='entrada').id));await p.waitForTimeout(300);await p.fill('[name=valorPago]','1500');await p.dispatchEvent('[name=valorPago]','input');await sub();
console.log('após receber 1500:',await p.evaluate(()=>db.financeiro.filter(l=>l.partDe).map(l=>l.valor+' '+finStatus(l)+' venc '+l.vencimento).join(' | ')));
// 2) acordo 6x com parceiro 40% dos honorários e captador 10% da parcela
await p.evaluate(()=>formAcordo({pessoaId:MP.ed.id,processoId:MP.p1.id}));await p.waitForTimeout(300);
await p.fill('[name=principal]','12000');await p.fill('[name=sucumbencia]','1200');await p.fill('[name=parcelas]','6');await p.fill('[name=primeiroVenc]','2026-12-10');await p.fill('[name=pctContratual]','30');await p.fill('[name=diasRepasse]','3');
console.log('conta honorários padrão:',await p.evaluate(()=>mForm.elements.honConta.selectedOptions[0].textContent));
await p.click('#acPart [data-ptadd]');await p.waitForTimeout(100);await p.selectOption('#acPart .ptRow:nth-child(1) [data-pt=pessoaId]',await p.evaluate(()=>db.pessoas.find(x=>x.nome==='Dr. Paulo Ramos').id));await p.fill('#acPart .ptRow:nth-child(1) [data-pt=pct]','40');
await p.click('#acPart [data-ptadd]');await p.waitForTimeout(100);await p.fill('#acPart .ptRow:nth-child(2) [data-pt=nome]','Indicação — João');await p.selectOption('#acPart .ptRow:nth-child(2) [data-pt=papel]','captador');await p.fill('#acPart .ptRow:nth-child(2) [data-pt=pct]','10');await p.selectOption('#acPart .ptRow:nth-child(2) [data-pt=base]','parcela');
await sub();await p.waitForTimeout(300);
const a=await p.evaluate(()=>db.acordos[0].id);
const parc=k=>p.evaluate(([a,k])=>{const g=acordoLanc(a,k);const v=c=>g.filter(c).map(l=>l.valor).reduce((x,y)=>x+y,0);return `p${k}: cli ${v(l=>l.categoria===CAT_CLI)} hon ${v(l=>l.categoria===CAT_HC)} suc ${v(l=>l.categoria===CAT_HS)} rep ${v(l=>l.categoria===CAT_REP)} parc ${v(l=>l.partId&&/Paulo/.test(l.descricao))} capt ${v(l=>l.partId&&/João/.test(l.descricao))} | honConta=${contaDe(g.find(l=>l.categoria===CAT_HC))?.nome||"—"}`},[a,k]);
console.log(await parc(1));
// 3) ajustar parcela a parcela: abrir mão na 2 e compensar na 3
await p.evaluate(a=>acordoAjustarParcelas(a),a);await p.waitForTimeout(300);
await p.fill('.ajT tr[data-k="2"] [data-aj=hon]','0');await p.fill('.ajT tr[data-k="3"] [data-aj=hon]','1200');await p.dispatchEvent('.ajT tr[data-k="3"] [data-aj=hon]','input');await p.waitForTimeout(100);
console.log('total vs contrato:',await p.textContent('#ajOk'),'|',await p.textContent('#ajTH'));await p.screenshot({path:SS+'fin_aj.png'});await sub();
console.log(await parc(2));console.log(await parc(3));
// status aguardando dos parceiros antes de receber
console.log('status parceiro p4:',await p.evaluate(a=>acordoLanc(a,4).filter(l=>l.partId).map(l=>finStatus(l)).join(','),a));
// receber parcela 1 → parceiro vence 3 dias? (dias 0 no editor) e repasse
await p.evaluate(([a])=>receiveParcela(a,1),[a]);await p.waitForTimeout(300);await p.fill('[name=pagoEm]','2026-12-10');await sub();
console.log('após receber p1:',await p.evaluate(a=>acordoLanc(a,1).filter(l=>l.natureza==='saida').map(l=>(l.categoria===CAT_REP?'repasse':'part')+' '+finStatus(l)+' '+l.vencimento).join(' | '),a));
// tela do acordo
await p.evaluate(a=>go('#/acordo/'+a),a);await p.waitForTimeout(400);await p.screenshot({path:SS+'fin_acordo.png',fullPage:true});
console.log('coluna participantes:',await p.evaluate(()=>[...document.querySelectorAll('th')].some(t=>t.textContent==='Participantes')));
// A pagar mostra parceiros aguardando junto
await p.evaluate(()=>{FC.saida.sit='aberto';go('#/financeiro/pagar')});await p.waitForTimeout(300);console.log('a pagar:',await p.evaluate(()=>window._finList.length+' itens, aguardando '+window._finList.filter(l=>finStatus(l)==='aguardando').length));
// editar acordo: remover captador → saídas em aberto somem
await p.evaluate(a=>{const ac=byId('acordos',a);formAcordo(ac)},a);await p.waitForTimeout(300);await p.click('#acPart .ptRow:nth-child(2) [data-ptrm]');await p.waitForTimeout(100);await sub();
console.log('após remover captador:',await p.evaluate(a=>acordoLanc(a).filter(l=>/João/.test(l.descricao)).map(l=>l.pagoEm?'pago':'aberto').join(',')||'nenhum',a));
// verificação: mais de 100%
console.log('verificação ok:',await p.evaluate(()=>vincProblemas().filter(x=>/Financeiro/.test(x.area)).map(x=>x.titulo).join(' | ')||'nada'));
await p.setViewportSize({width:390,height:844});await p.evaluate(()=>formFin({natureza:'entrada',participacoes:[{id:'x',nome:'Fulano',papel:'parceiro',pct:30,quando:'receber',dias:0}]}));await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelectorAll('#mForm details').forEach(d=>d.open=true));console.log('overflow mob form:',await p.evaluate(()=>document.documentElement.scrollWidth));await p.screenshot({path:SS+'fin_part_mob.png',fullPage:false});
console.log('ERROS',errs);await b.close();})();
