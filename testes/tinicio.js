// Tela inicial: ✏️ Personalizar telas (menu lateral), prazos × 📞 contatos, ⚖️ Aguardando julgamento, indicador “a distribuir” e a sugestão de pauta pelas publicações
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);await p.waitForTimeout(300);
const v=f=>p.evaluate(f);
// 1. botão do menu lateral e fim do link no rodapé do Início
const btn=await v(()=>document.querySelector('[data-act="menuOrg"]').textContent.trim());if(btn!=='✏️ Personalizar telas')ERR.push('botão: '+btn);
await v(()=>go('#/painel'));await p.waitForTimeout(250);
if(await p.$('.personalizar'))ERR.push('link do rodapé ainda existe');
await p.click('[data-act="menuOrg"]');await p.waitForTimeout(250);
const abas=await v(()=>[...document.querySelectorAll('[data-paba]')].map(x=>x.dataset.paba+(x.classList.contains('on')?'*':'')).join(','));if(abas!=='inicio*,menu')ERR.push('abas: '+abas);
if(!await p.isVisible('.pList[data-grp="blocos"]')||await p.isVisible('.pList[data-grp="menu"]'))ERR.push('aba inicial deveria ser a tela inicial');
await p.click('[data-paba="menu"]');if(!await p.isVisible('.pList[data-grp="menu"]'))ERR.push('aba menu');
await p.click('[data-paba="inicio"]');await p.click('.pRow[data-k="julg"] .pUp');   // julg sobe acima de retornos
await p.uncheck('[data-jsit="Aguardando julgamento de recurso"]');await p.fill('#pJDias','30');
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(300);
const cfg=await v(()=>{const c=painelCfg();return c.ordem.blocos.join(',')+' | '+c.julgSit.join(';')+' | '+c.julgDias;});console.log('cfg:',cfg);
if(!/prazos,julg,retornos/.test(cfg)||/recurso/.test(cfg)||!/\| 30$/.test(cfg))ERR.push('personalizar não salvou: '+cfg);
// 2. dados: prazo, contatos (lead, testemunha, perito, retorno de conversa) e julgamento
await v(()=>{const t=today();db.prazos=[];db.conversas=[];db.leads=[];db.meta.workflows=[];
  upsert('prazos',{titulo:'Contestação X',tipo:'Prazo processual',data:t,situacao:'Pendente',concluido:false});
  const pai=upsert('prazos',{titulo:'Audiência Y',tipo:'Audiência',data:addDays(t,5),situacao:'Pendente',concluido:false});
  upsert('prazos',{titulo:'Confirmar as testemunhas',tipo:'Tarefa',data:t,lembDe:{pai:pai.id,lemb:'l1'},situacao:'Pendente',concluido:false});
  upsert('prazos',{titulo:'Ligar para o perito',tipo:'Tarefa',contatoCom:'Perito',data:addDays(t,1),situacao:'Pendente',concluido:false});
  upsert('prazos',{titulo:'Tarefa interna Z',tipo:'Tarefa',contatoCom:'',data:t,situacao:'Pendente',concluido:false});
  const l=upsert('leads',{nome:'Lead Fulano',status:'Novo',proximoContato:t,telefone:'11999990000'});sincronizarLembreteLead(byId('leads',l.id));
  upsert('leads',{nome:'Lead Sem Data',status:'Novo'});
  upsert('conversas',{pessoaId:MP.ed.id,dataHora:t+'T10:00',resumo:'x',proximaData:addDays(t,-1),proximaAcao:'Retornar sobre o acordo'});
  // julgamento
  const pr1=MP.p1;upsert('processos',{id:pr1.id,situacaoProc:'Aguardando sentença / julgamento'});
  const pr2=upsert('processos',{clienteId:MP.ed.id,numero:'5001082-85.2026.4.03.6325',vara:'1ª Turma Recursal de SP',status:'Ativo',seq:'8',partes:[],testemunhas:[]});
  upsert('prazos',{titulo:'Sessão de julgamento (virtual)',tipo:'Audiência',subtipo:'Sessão de julgamento',processoId:pr2.id,data:addDays(t,-1),dataFim:addDays(t,1),situacao:'Pendente',concluido:false});
  const pr3=upsert('processos',{clienteId:MP.ed.id,numero:'0001638-22.2019.4.03.6325',status:'Ativo',seq:'9',situacaoProc:'Aguardando sentença / julgamento',situacaoDesde:addDays(t,-162),partes:[],testemunhas:[]});
  upsert('processos',{clienteId:MP.ed.id,numero:'',titulo:'Ação ainda não ajuizada',tipoProc:'Judicial',status:'Ativo',seq:'10',partes:[],testemunhas:[]});
  upsert('processos',{clienteId:MP.ed.id,numero:'',titulo:'Serviço',servico:true,status:'Ativo',partes:[],testemunhas:[]});
  window._pr3=pr3.id;save();});
const desde=await v(()=>MP.p1.situacaoDesde||byId('processos',MP.p1.id).situacaoDesde);if(desde!==await v(()=>today()))ERR.push('situacaoDesde não gravado: '+desde);
await v(()=>go('#/painel'));await p.waitForTimeout(300);await v(()=>render());await p.waitForTimeout(300);
const cards=await v(()=>{const o={};document.querySelectorAll('#view .card').forEach(c=>{const h=c.querySelector('h2');if(h)o[h.textContent.slice(0,30)]=c.textContent;});return o;});
const prz=Object.entries(cards).find(([k])=>/Prazos e/.test(k))?.[1]||'',ctt=Object.entries(cards).find(([k])=>/Contatos/.test(k))?.[1]||'',jul=Object.entries(cards).find(([k])=>/Aguardando/.test(k))?.[1]||'';
console.log('prazos:',prz.replace(/\s+/g,' ').slice(0,300));console.log('contatos:',ctt.replace(/\s+/g,' ').slice(0,500));console.log('julg:',jul.replace(/\s+/g,' ').slice(0,500));
if(!/Contestação X/.test(prz)||!/Tarefa interna Z/.test(prz))ERR.push('prazos sem o prazo/tarefa');
if(/testemunhas|perito|lead/i.test(prz))ERR.push('contato no quadro de prazos');
for(const x of ['Confirmar as testemunhas','Ligar para o perito','Contato com o lead: Lead Fulano','Retornar sobre o acordo','Lead Sem Data'])if(!ctt.includes(x))ERR.push('contatos sem: '+x);
if((ctt.match(/Lead Fulano/g)||[]).length!==1)ERR.push('lead repetido nos contatos');
if(!/Testemunha/.test(ctt)||!/Perito/.test(ctt))ERR.push('etiquetas de contato');
if(!/Em julgamento agora/.test(jul)||!/há 162 dias/.test(jul)||!/Concluso/.test(jul))ERR.push('quadro julgamento');
const ind=await v(()=>[...document.querySelectorAll('.stat')].map(s=>s.textContent.replace(/\s+/g,' ').trim()).join(' | '));console.log('indicadores:',ind);
if(!/1 ?Processos a distribuir/.test(ind))ERR.push('indicador a distribuir');if(!/Contatos a fazer/.test(ind))ERR.push('indicador contatos');
if(!/3 ?Prazos para hoje/.test(ind)||!/0 ?Prazos atrasados/.test(ind))ERR.push('hoje = prazo, tarefa e a sessão virtual em andamento (não atrasada)');
// 3. filtros na lista de processos
await p.click('[data-act="filtroJulg"]');await p.waitForTimeout(300);
const nj=await v(()=>document.querySelectorAll('#list tbody tr, #list .li').length);if(nj!==3)ERR.push('filtro julgamento: '+nj);
await v(()=>{F.proc.status='distrib';go('#/processos');});await p.waitForTimeout(300);
const nd=await v(()=>document.getElementById('list').textContent);if(!/não ajuizada/.test(nd)||/Serviço/.test(nd))ERR.push('filtro a distribuir');
await v(()=>{F.proc.status='ativos';});
// 4. sugestão de pauta pelas publicações
const sug=await v(()=>{const n='5001082-85.2026.4.03.6325',d=today(),y=+d.slice(0,4)+1;const a=sugerirPrazo({numero:n,data:d,texto:`INTIMAÇÃO DE PAUTA. Processo incluído na pauta da Sessão Virtual de Julgamento que se realizará de 23/11/${y} a 27/11/${y}. Os advogados poderão requerer sustentação oral.`});
  const b=sugerirPrazo({numero:n,data:d,texto:`Fica a parte intimada de que o recurso será julgado na sessão de julgamento do dia 30 de novembro de ${y}, às 14h00, presencial.`});
  const c=sugerirPrazo({numero:n,data:d,texto:`ACÓRDÃO. Vistos, relatados e discutidos estes autos, ACORDAM os juízes, em sessão virtual de julgamento realizada de 10/11/2020 a 14/11/2020, negar provimento ao recurso.`});
  const r=sugestaoRegistro({numero:n,data:d},a,null);return {a:[a.subtipo,a.data,a.dataFim,a.modalidade,a.titulo].join('|'),b:[b.subtipo,b.data,b.hora].join('|'),c:c.ato,r:[r.tipo,r.subtipo,r.dataFim,r.contatoCom].join('|'),h:sugestaoHtml({numero:n,data:d,texto:`incluído em pauta de julgamento de 23/11/${y} a 27/11/${y}`})};});
console.log('pauta:',JSON.stringify(sug));
if(!/^Sessão de julgamento\|\d{4}-11-23\|\d{4}-11-27\|Online\|Sessão de julgamento \(virtual\)$/.test(sug.a))ERR.push('pauta virtual: '+sug.a);
if(!/^Sessão de julgamento\|\d{4}-11-30\|14:00$/.test(sug.b))ERR.push('pauta presencial: '+sug.b);
if(/pauta/i.test(sug.c))ERR.push('acórdão virou pauta');if(!/^Audiência\|Sessão de julgamento\|\d{4}-11-27\|$/.test(sug.r))ERR.push('registro: '+sug.r);
if(!/Aguardando julgamento/.test(sug.h))ERR.push('html sugestão');
// 5. vínculos: renomear a situação acompanha; situação excluída aparece na verificação
await v(()=>{renomearOpcao('situacaoProc','Aguardando sentença / julgamento','Concluso para sentença');save();});
const js=await v(()=>painelCfg().julgSit.join(';'));if(js!=='Concluso para sentença')ERR.push('renomear situação: '+js);
await v(()=>{db.meta.painel.julgSit=[...db.meta.painel.julgSit,'Situação apagada'];save();});
const pr=await v(()=>vincProblemas().filter(x=>/Aguardando julgamento/.test(x.titulo)).length);if(pr!==1)ERR.push('verificação julgSit: '+pr);
await v(()=>{VER_CORRIGIR.julgSit();save();});if(await v(()=>painelCfg().julgSit.includes('Situação apagada')))ERR.push('corrigir julgSit');
// 6. formulário do compromisso: campo “É um contato com…”
await v(()=>A.newPrazo({}));await p.waitForTimeout(300);await p.selectOption('#mForm [name=tipo]','Retorno ao cliente');
if(await v(()=>mForm.elements.contatoCom.value)!=='Cliente')ERR.push('retorno ao cliente → contato Cliente');await v(()=>closeModal());
// 7. celular
await p.setViewportSize({width:390,height:844});await v(()=>go('#/painel'));await p.waitForTimeout(300);
const w=await v(()=>document.documentElement.scrollWidth);if(w>390)ERR.push('celular: largura '+w);
console.log('ERROS',[...ERR,...errs]);await b.close();})();
