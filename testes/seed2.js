if(!db.pessoas.length){
  const P = (nome, pasta, tel) => upsert('pessoas', {nome, tipo:'Cliente', pasta, telefone:tel});
  const ed = P('Eduardo Souza','152','(11) 98888-1111'), hi = P('Higor Barros','153','(11) 97777-2222'), el = P('Elza Martins','154','(11) 96666-3333'), pe = P('Pedro da Silva','155','(11) 95555-4444'), ad = P('Adilson Pereira','156','(11) 94444-1212'), ga = P('Gabriela Santos','157','(11) 93333-1313');
  const pr = (titulo, cli, area) => upsert('processos', {titulo, clienteId:cli.id, area, status:'Ativo', seq:'1', posicao:'Autor', partes:[], numero:'100'+Math.floor(Math.random()*9000+1000)+'-11.2026.8.26.0100'});
  const p1 = pr('Reclamação trabalhista', ed, 'Trabalhista'), p2 = pr('Indenização por danos morais', hi, 'Cível'), p3 = pr('Revisão de benefício', el, 'Previdenciário'), p4 = pr('Alimentos', pe, 'Família e Sucessões'), p5 = pr('Aposentadoria — valor residual', ad, 'Previdenciário'), p6 = pr('Reclamação trabalhista', ga, 'Trabalhista');
  window.MP = {p1,p2,p3,p4,p5,p6,ed,hi,el,pe,ad,ga};
  const PZ = (titulo, tipo, data, proc, x) => upsert('prazos', {titulo, tipo, data, processoId:proc.id, pessoaId:proc.clienteId, concluido:false, ...(x||{})});
  PZ('Manifestação sobre o laudo', 'Prazo processual', addDays(t,-3), p3, {coluna:'tarefas'});
  PZ('Réplica', 'Prazo processual', t, p2, {coluna:'tarefas'});
  PZ('Audiência de instrução', 'Audiência', t, p1, {hora:'14:00', horaFim:'15:30', subtipo:'Instrução', local:'TRT-2 — 45ª Vara (telepresencial)', coluna:'audiencias'});
  PZ('Reunião — documentos do INSS', 'Reunião', addDays(t,2), p3, {hora:'10:00', horaFim:'11:00', local:'Escritório', coluna:'aguardando'});
  PZ('Contestação', 'Prazo processual', addDays(t,3), p4, {coluna:'tarefas'});
  PZ('Audiência de conciliação', 'Audiência', addDays(t,9), p4, {hora:'10:30', horaFim:'11:00', subtipo:'Conciliação', local:'CEJUSC', coluna:'audiencias'});
  PZ('Audiência UNA', 'Audiência', addDays(t,16), p6, {hora:'09:40', horaFim:'10:00', subtipo:'UNA', coluna:'audiencias'});
  PZ('Recurso ordinário', 'Prazo processual', addDays(t,15), p1, {coluna:'tarefas'});
  PZ('Diligência no INSS', 'Diligência', addDays(t,7), p5, {diaInteiro:true, coluna:'aguardando'});
  PZ('Protocolo de petição inicial', 'Tarefa', addDays(t,4), p6, {coluna:'distribuir'});
  PZ('Analisar valor residual de aposentadoria', 'Tarefa', '', p5, {coluna:'analise', semData:true});
  PZ('Pesquisar processo — seguro concessionária', 'Tarefa', '', p2, {coluna:'analise', semData:true});
  ['Réplica','Manifestação sobre endereço','Audiência CEJUSC'].forEach((x,i) => PZ(x, i==2?'Audiência':'Prazo processual', addDays(t,-10-i*4), [p2,p4,p6][i], {concluido:true, coluna:'concluido', situacao:'Realizado'}));
  const F = (natureza, categoria, valor, venc, pago, desc, pes) => upsert('financeiro', {natureza, categoria, valor, vencimento:venc, pagoEm:pago||'', valorPago:pago?valor:'', descricao:desc, pessoaId:pes?pes.id:''});
  const mes = t.slice(0,7), ant = addMonths(mes+'-01',-1).slice(0,7);
  F('entrada','Honorários contratuais',3500,ant+'-05',ant+'-05','Honorários iniciais',hi); F('entrada','Honorários de êxito',4200,ant+'-18',ant+'-19','Êxito — acordo',ga); F('saida','Despesa do escritório',1500,ant+'-10',ant+'-10','Aluguel');F('saida','Impostos',620,ant+'-20',ant+'-20','Simples Nacional');
  F('entrada','Honorários contratuais',2000,mes+'-03',mes+'-03','Honorários iniciais',ed); F('entrada','Honorários de êxito',6800,mes+'-06',mes+'-06','Êxito — 30% dos atrasados',el); F('saida','Despesa do escritório',1500,mes+'-10','', 'Aluguel'); F('saida','Impostos',740,mes+'-20','','Simples Nacional');
  F('entrada','Honorários contratuais',1000,addDays(t,6),'','Honorários iniciais (2/2)',hi); F('entrada','Honorários de êxito',800,addDays(t,-2),'','Honorários — atrasados',el);
  for(let i=-8;i<=-2;i++){ const m = addMonths(mes+'-01',i).slice(0,7); F('entrada','Honorários contratuais',2500+((i*731)%1800+1800)%1800,m+'-08',m+'-08','Honorários',hi); F('saida','Despesa do escritório',1500,m+'-10',m+'-10','Aluguel'); }
  upsert('conversas',{pessoaId:ed.id, dataHora:addDays(t,-1)+'T10:00', canal:'WhatsApp', relato:'x'});
  setDriveCfg({recusado:true}); db.meta.lastBackup = new Date().toISOString(); save();
}
