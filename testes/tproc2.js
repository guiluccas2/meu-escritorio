const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');
const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://comunicaapi.pje.jus.br/**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept('Defensoria SP'));
// migração: processos antigos com status velhos
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('escritorio_db_v1')||'{}');});
await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.processos[0].status='Aguardando julgamento';db.processos[1].status='Em recurso';db.processos[2].status='Execução / Cumprimento';db.processos[3].status='Arquivado';db.meta.statusProcV2=false;
  db.meta.listas={statusProc:['Ativo','Suspenso','Aguardando julgamento','Em recurso','Execução / Cumprimento','Encerrado','Arquivado'].map(v=>({v}))};save();});
await p.reload();await p.waitForTimeout(800);
console.log('migração:', await p.evaluate(()=>db.processos.slice(0,4).map(x=>[x.status,x.fase||'',x.situacaoProc||''].join('/')).join(' | ')));
console.log('lista status:', await p.evaluate(()=>OPT.statusProc.join(', ')));
// novo processo
await p.evaluate(()=>A.newProc({}));await p.waitForTimeout(300);
console.log('seções:', await p.evaluate(()=>[...document.querySelectorAll('#mForm details.fgrupo')].map(d=>(d.open?'▾':'▸')+d.querySelector('summary').textContent.trim().split(' ').slice(0,3).join(' ')).join(' | ')));
console.log('vínculo oculto:', await p.evaluate(()=>getComputedStyle(mForm.elements.tipoVinculo.closest('.fld')).display));
await p.selectOption('[name=principalId]',{index:1});console.log('vínculo aparece:', await p.evaluate(()=>getComputedStyle(mForm.elements.tipoVinculo.closest('.fld')).display));
await p.selectOption('[name=principalId]','');
console.log('sugestões ação:', await p.evaluate(()=>document.querySelectorAll('#dl_titulo option').length));
await p.fill('[name=titulo]','Ação de alimentos gravídicos');await p.click('[data-addcombo=acao]');
console.log('nova opção salva:', await p.evaluate(()=>OPT.acao.includes('Ação de alimentos gravídicos')));
await p.fill('[name=numero]','0010123-45.2026.5.15.0114');await p.dispatchEvent('[name=numero]','change');
console.log('tribunal auto:', await p.inputValue('[name=tribunal]'), await p.inputValue('[name=sistema]'));
await p.selectOption('[name=clienteId]',{index:1});
await p.click('[data-tg=t2]');await p.click('[data-tg=t3]');
await p.selectOption('[name=fase]','Conhecimento');await p.selectOption('[name=situacaoProc]','Aguardando audiência');await p.selectOption('[name=rito]','Sumaríssimo (trabalhista)');
await p.fill('[name=comarca]','Campinas');await p.fill('[name=vara]','1ª Vara do Trabalho de Campinas');
// marcos
await p.click('#mForm summary:has-text("Marcos")');await p.click('#marcoAdd');
await p.selectOption('.marco-row:last-child .mTipo','Liminar / tutela de urgência');await p.fill('.marco-row:last-child .mData','2026-10-01');await p.selectOption('.marco-row:last-child .mRes','Deferida parcialmente');
await p.click('#marcoAdd');await p.selectOption('.marco-row:last-child .mTipo','Citação');await p.fill('.marco-row:last-child .mData','2026-09-20');await p.fill('.marco-row:last-child .mRef','Empresa X');
// caso
await p.click('#mForm summary:has-text("O caso")');await p.fill('[name=resumo]','Horas extras e insalubridade.');await p.fill('[name=estrategia]','Cautelar primeiro, depois a reclamação.');
// campo personalizado
await p.click('#mForm summary:has-text("Campos personalizados")');await p.click('.cpAbrir');await p.fill('.cpT','Nº do contrato');await p.check('.cpUnico');await p.check('.cpOnde[value=pessoa]');await p.click('.cpCriar');
await p.fill('[name^=cp_]','CT-100');
await p.screenshot({path:SS+'p-form.png',fullPage:false});
// tipo extrajudicial esconde rito
await p.check('[name=tipoProc][value=Extrajudicial]');console.log('extrajud. rito:', await p.evaluate(()=>getComputedStyle(mForm.elements.rito.closest('.fld')).display), await p.evaluate(()=>mForm.elements.numero.closest('.fld').querySelector('label').textContent));
await p.check('[name=tipoProc][value=Judicial]');
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(400);
const pr=await p.evaluate(()=>{const x=db.processos.find(x=>x.titulo==='Ação de alimentos gravídicos');return x&&{tags:x.tags,marcos:x.marcos.map(m=>m.tipo+':'+m.resultado),fase:x.fase,sit:x.situacaoProc,rito:x.rito,trib:x.tribunal,extra:x.extra,tipo:x.tipoProc,estr:x.estrategia};});
console.log('salvo:', JSON.stringify(pr));
await p.screenshot({path:SS+'p-ficha.png',fullPage:true});
console.log('ficha chips:', (await p.innerText('.procChips')).replace(/\n/g,' '), '| resumo:', await p.textContent('.procResumo'));
// único: outro processo com mesmo contrato
await p.evaluate(()=>A.newProc({}));await p.waitForTimeout(200);await p.fill('[name=titulo]','Teste');await p.selectOption('[name=clienteId]',{index:1});
await p.click('#mForm summary:has-text("Campos personalizados")');await p.fill('[name^=cp_]','ct-100');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(200);
console.log('único bloqueou:', await p.textContent('#toast'), '| ainda aberto:', await p.evaluate(()=>!modal.classList.contains('hidden')));
await p.click('#mCancel');
// campo aparece no cadastro de pessoa
await p.evaluate(()=>A.newPessoa({}));await p.waitForTimeout(200);console.log('campo na pessoa:', await p.evaluate(()=>!!document.querySelector('.cpBox [name^=cp_]')), await p.evaluate(()=>document.querySelector('.fgrupo:last-of-type')?.open));await p.click('#mCancel');
// prazo e lead têm a seção
await p.evaluate(()=>formPrazo({}));console.log('seção no prazo:', await p.evaluate(()=>!!document.querySelector('.cpBox[data-onde=prazo]')));await p.click('#mCancel');
await p.evaluate(()=>formLead({}));console.log('seção no lead:', await p.evaluate(()=>!!document.querySelector('.cpBox[data-onde=lead]')));await p.click('#mCancel');
// lista de processos com filtro de tag
await p.evaluate(()=>go('#/processos'));await p.waitForTimeout(300);
await p.selectOption('[data-f="proc.tag"]','t2');await p.waitForTimeout(300);console.log('filtro tag:', await p.evaluate(()=>document.querySelectorAll('#list tbody tr').length));
await p.screenshot({path:SS+'p-lista.png'});
// cadastro completo de pessoa no meio do processo preserva tags e marcos
const id=await p.evaluate(()=>db.processos.find(x=>x.titulo==='Ação de alimentos gravídicos').id);
await p.evaluate(id=>formProc(byId('processos',id)),id);await p.waitForTimeout(200);
console.log('edição carrega tags/marcos:', await p.evaluate(()=>document.querySelectorAll('#tagsEd .on').length+'/'+document.querySelectorAll('.marco-row').length));
await p.click('[data-tg=t6]');await p.click('[data-newpc=clienteId]');await p.waitForTimeout(300);await p.fill('[name=nome]','Nova Pessoa');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(800);
console.log('voltou com tags:', await p.textContent('#mTitle'), await p.evaluate(()=>document.querySelectorAll('#tagsEd .on').length+'/'+document.querySelectorAll('.marco-row').length));
await p.click('#mCancel');
// config tags/cores
await p.evaluate(()=>go('#/config'));await p.waitForTimeout(200);await p.click('[data-act=tagsCores]');await p.waitForTimeout(200);
await p.fill('[data-area="Trabalhista"]','#000000').catch(async()=>{await p.evaluate(()=>{document.querySelector('[data-area="Trabalhista"]').value='#000000';});});
await p.click('#mForm .mfoot button[type=submit]');console.log('cor área:', await p.evaluate(()=>corArea('Trabalhista')));
await p.click('[data-act=camposCfg]');console.log('gerenciar campos:', (await p.innerText('#mForm')).split('\n').slice(1,3).join(' / '));
// mobile form
const m=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const mp=await m.newPage();mp.on('pageerror',e=>errs.push('M '+e.message));
await mp.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await mp.evaluate(()=>A.newProc({}));await mp.waitForTimeout(300);
console.log('mobile overflow:', await mp.evaluate(()=>document.querySelector('.modal-box').scrollWidth > document.querySelector('.modal-box').clientWidth+2));
await mp.screenshot({path:SS+'p-mob.png'});
console.log('errs',errs);await b.close();})();
