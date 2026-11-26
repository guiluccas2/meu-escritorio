/* ===== 📷 Digitalizar documentos (câmera ou imagem → PDF) =====
   Tudo é processado no aparelho: nada vai para a IA nem para outro serviço — só, se você escolher, para a pasta do cliente/processo
   no seu Google Drive (pelo robô, o mesmo caminho do editor de arquivos dos compromissos).
   · Câmera dentro do app (digCamAbrir): 📄 Foto única ou 📚 Lote, borda ao vivo, 🔦 lanterna e ⏱ captura automática (desligadas ao abrir),
     filtro escolhido antes de fotografar, ↶ desfazer a última, 📖 livro (divide cada foto em 2) e, no modo ID, retângulo-guia Frente → Verso.
     Sem câmera/permissão → câmera do sistema.
   · Recorte automático em 2 etapas: região da folha (claridade + “cor de papel”) e depois uma reta ajustada a cada borda (digRefinar/digReta).
     Depois da foto abre o RESULTADO (dig.ver); o ajuste dos cantos (com 🔍 lupa) fica em “✏️ Ajustar cantos”. Passar páginas (◀ ▶ / arrastar), 👁 Comparar,
     📷 Refazer (troca só a página), 📖 Livro: dividir em 2 (linha arrastável até a dobra), 🖊 Marcar (digitalizar-marcar.js: tarjas, texto, assinatura).
   · Filtros (miniaturas da própria página): Original · Realçado · Sem sombra · Eco · Cinza · Preto e branco — numa página ou em todas (dig.filtroTodas);
     o último escolhido vira o padrão (digCfg.filtro).
   · Formato: 📄 Página inteira · 🪪 Modo ID (A4, tamanho real ou ampliado — doc.idEsc) · 🧩 Colagem (2/4/6 fotos por folha — doc.colN, doc.colMold).
   · Qualidade (dig.qual: leve/normal/alta — DIG_QUAL) e marca d’água no documento todo (doc.marcaOn/doc.marca).
   · ▶ Retomar: as páginas não enviadas ficam no IndexedDB do aparelho (escritorio_digitalizar) até saírem; ao abrir de novo, aparece “Retomar / Descartar”.
   · Nome automático sequencial: DOC-0001 / ID-0001 + data (db.meta.digSeq avança só quando o documento sai).
   · Compartilhar manda só os arquivos (um título junto vira um .txt a mais no Drive/WhatsApp do iPhone).
   · Destino padrão: ficha do cliente/processo/serviço → pasta no Drive; editor de arquivos do compromisso/atendimento → anexar;
     barra do topo / menu “+” → baixar. O PDF é montado aqui mesmo (digPdf), sem biblioteca externa, e funciona sem internet.
   · OCR (texto pesquisável): visível como “em breve”. */
const DIG_ID = {cartao:{n:'Cartão: RG novo, CNH, cartões (8,6 × 5,4 cm)', c:'RG novo / CNH', w:85.6, h:54}, rg:{n:'RG antigo (10,2 × 6,8 cm)', c:'RG antigo', w:102, h:68},
  passaporte:{n:'Passaporte aberto (12,5 × 8,8 cm)', c:'Passaporte', w:125, h:88}, outro:{n:'Outro tamanho (cm)', c:'Outro'}};
const DIG_FILTROS = [['original', 'Original'], ['realcado', 'Realçado'], ['semsombra', 'Sem sombra'], ['eco', 'Eco'], ['cinza', 'Cinza'], ['pb', 'Preto e branco']];
const DIG_A4 = [595.28, 841.89], DIG_MAX = 2400;
const DIG_ESC = [[1, 'Tamanho real (como cópia de scanner)'], [1.5, 'Ampliado 1,5× (padrão)'], [2, 'Grande 2×']]; // modo ID: tamanho no PDF
const DIG_QUAL = {leve:{n:'Leve', max:1400, q:.6, dpi:200, kb:150}, normal:{n:'Normal', max:2000, q:.8, dpi:300, kb:350}, alta:{n:'Alta', max:2400, q:.9, dpi:300, kb:800}};
const DIG_COL = {2:[1, 2], 4:[2, 2], 6:[2, 3]}; // colagem: colunas × linhas por folha
let dig = null; // estado da janela aberta (documentos, página atual, destino)

/* ----- abrir / fechar -----
   Vários documentos de uma vez: dig.docs = [{nome, modo, idTam, idW, idH, colN, pags:[…], sel, st:''|'ok'|'erro', msg, url}].
   Fotografe tudo em sequência, separe com “✂ Novo documento a partir desta página” e envie os marcados no final (mesmo destino para todos). */
const digPodeDrive = () => !!(arqCfg().ativos && monCfg().roboUrl);
/* Nome automático = código sequencial, separado por tipo: DOC-0001 (página inteira/colagem) e ID-0001 (modo ID), + a data.
   O contador (db.meta.digSeq) só avança quando o documento é enviado/baixado; enquanto isso os pendentes recebem os próximos números. */
const digSeq = () => db.meta.digSeq || (db.meta.digSeq = {DOC:0, ID:0});
const digPref = x => x.modo === 'id' ? 'ID' : 'DOC';
const digCodigo = (pref, n) => `${pref}-${String(n).padStart(4, '0')} ${fmtD(today()).replace(/\//g, '-')}`;
const digNomePadrao = () => digCodigo('DOC', (digSeq().DOC || 0) + 1);
function digRenomear(){ if(!dig) return; const c = {DOC:0, ID:0};
  dig.docs.forEach(x => { if(!x.nomeAuto || x.st === 'ok') return; const k = digPref(x); c[k]++; x.nome = digCodigo(k, (digSeq()[k] || 0) + c[k]); }); }
function digConfirmarSeq(x){ if(!x.nomeAuto) return; const k = digPref(x), n = +(String(x.nome).match(/^(?:DOC|ID)-(\d+)/) || [])[1] || 0;
  if(n > (digSeq()[k] || 0)){ digSeq()[k] = n; save(); } x.nomeAuto = false; }
const digDoc = () => dig && dig.docs[dig.di];
const digPag = () => digDoc()?.pags[dig.at];
const digTodas = () => dig ? dig.docs.flatMap(x => x.pags) : [];
const digPendentes = () => dig.docs.filter(x => x.pags.length && x.st !== 'ok');
const digMarcaPadrao = () => dig?.alvo?.procNum ? `Cópia — uso exclusivo no processo nº ${dig.alvo.procNum}` : 'Cópia — uso exclusivo';
function digNovoDoc(){ const c = db.meta.digCfg || {}; dig.nDocs = (dig.nDocs || 0) + 1;
  return {id:uid(), nome:'', nomeAuto:true, modo:c.modo || 'pagina', idTam:c.idTam || 'cartao', idW:c.idW || 8.6, idH:c.idH || 5.4, idEsc:c.idEsc || 1.5,
    colN:c.colN || 4, colMold:!!c.colMold, marcaOn:false, marca:digMarcaPadrao(), pags:[], sel:true, st:'', msg:'', url:''}; }
function digAbrir(o = {}){
  const c = db.meta.digCfg || {}, drive = o.alvo && digPodeDrive();
  let nota = '';
  if(o.deFicha && !o.alvo) nota = 'Este cadastro ainda não tem número de pasta (P0000): o PDF será baixado no aparelho.';
  else if(o.alvo && !drive) nota = 'Para enviar à pasta do cliente, configure o robô e as pastas em Configurações → 📁 Arquivos. Por enquanto, o PDF será baixado.';
  dig = {docs:[], di:0, at:0, nDocs:0, ver:true, filtro:c.filtro || 'realcado', filtroTodas:c.filtroTodas !== false, captura:c.captura || 'unica', qual:DIG_QUAL[c.qual] ? c.qual : 'normal',
    alvo:drive ? o.alvo : null, anexar:o.anexar || null, nota, destino:o.anexar ? 'anexar' : drive ? 'drive' : 'baixar', ocupado:false, feito:null,
    rotulo:o.anexar ? 'Anexo de cadastro' : o.alvo ? `Ficha: ${o.alvo.cliente}${o.alvo.proc ? ' › ' + o.alvo.proc : ''} ${o.alvo.nome || ''}`.trim() : 'Baixar no aparelho'};
  dig.docs.push(digNovoDoc()); digRenomear();
  let ov = document.getElementById('digOv');
  if(!ov){ ov = document.createElement('div'); ov.id = 'digOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Digitalizar documento'); document.body.appendChild(ov); digLigar(ov); }
  ov.hidden = false; document.body.classList.add('digAberto'); digRender();
  const eu = dig; digRascInfo().then(i => { if(i && dig === eu && !digTodas().length){ eu.rasc = i; digRender(); } }).catch(() => {});
}
function digFechar(sem){
  if(!dig) return; digCamFechar(); const pend = dig.docs.some(x => x.pags.length && x.st !== 'ok');
  if(!sem && pend && !confirm('Há documentos que ainda não foram enviados. Fechar mesmo assim?\n\nEles ficam guardados neste aparelho: na próxima vez aparece “▶ Retomar”.')) return;
  if(dig.teve){ if(sem || !pend) digRascApagar(); else digRascSalvar(true); } // sessão que nunca teve páginas não mexe no rascunho guardado
  dig = null; const ov = document.getElementById('digOv'); if(ov){ ov.hidden = true; ov.innerHTML = ''; } document.body.classList.remove('digAberto');
}
function digGuardarCfg(){ const d = digDoc(), c = db.meta.digCfg || {};
  db.meta.digCfg = {...c, modo:d.modo, idTam:d.idTam, idW:d.idW, idH:d.idH, idEsc:d.idEsc, colN:d.colN, colMold:d.colMold, filtro:dig.filtro, filtroTodas:dig.filtroTodas, captura:dig.captura, qual:dig.qual}; save(); }
A.digAbrir = d => {
  const deFicha = !!(d.proc || d.pessoa), alvo = d.proc ? arqAlvo({processoId:d.proc}) : d.pessoa ? arqAlvo({pessoaId:d.pessoa}) : null;
  digAbrir({alvo, deFicha});
};

/* ----- tela ----- */
function digDestinos(){
  const d = dig, l = [];
  if(d.anexar) l.push(['anexar', '📎 Anexar a este cadastro (vai para a pasta no Drive)']);
  if(d.alvo) l.push(['drive', `☁️ Pasta no Google Drive — ${d.alvo.cliente}${d.alvo.proc ? ' › ' + d.alvo.proc : ''} ${d.alvo.nome || ''}`]);
  l.push(['baixar', '⬇ Baixar no aparelho']);
  try{ if(navigator.canShare && navigator.canShare({files:[new File(['x'], 'x.pdf', {type:'application/pdf'})]})) l.push(['compartilhar', '📤 Compartilhar (WhatsApp, e-mail…)']); }catch(e){}
  return l;
}
const DIG_ROT = {anexar:['📎 Anexar PDF', '📎 Anexar'], drive:['☁️ Enviar ao Drive', '☁️ Enviar'], baixar:['⬇ Baixar PDF', '⬇ Baixar'], compartilhar:['📤 Compartilhar PDF', '📤 Compartilhar']};
function digRotulo(){ const n = dig.docs.filter(x => x.sel && x.pags.length && x.st !== 'ok').length, r = DIG_ROT[dig.destino];
  return dig.docs.filter(x => x.pags.length).length > 1 ? `${r[1]} ${n} documento${n === 1 ? '' : 's'}` : r[0]; }
const digKB = kb => kb >= 1000 ? (kb / 1024).toFixed(1).replace('.', ',') + ' MB' : Math.round(kb) + ' KB';
function digRender(){
  const ov = document.getElementById('digOv'); if(!ov || !dig) return;
  const d = dig, doc = digDoc(), p = digPag(), cheios = d.docs.filter(x => x.pags.length), varios = cheios.length > 1;
  const add = `<button type="button" class="btn primary" data-dg="cam">📷 Tirar foto</button><button type="button" class="btn" data-dg="img">🖼️ Escolher imagens</button>`;
  const modoCap = `<div class="digSeg digCapSeg" title="Escolha antes de fotografar"><button type="button" data-dgcap="unica" class="${d.captura === 'unica' ? 'on' : ''}">📄 Foto única</button><button type="button" data-dgcap="lote" class="${d.captura === 'lote' ? 'on' : ''}">📚 Lote (várias seguidas)</button></div>`;
  const destinos = digDestinos(); if(!destinos.some(x => x[0] === d.destino)) d.destino = destinos[0][0];
  const dest = d.anexar ? 'Os PDFs serão anexados ao cadastro aberto' : d.alvo ? `Pasta: ${d.alvo.cliente}${d.alvo.proc ? ' › ' + d.alvo.proc : ''} ${d.alvo.nome || ''}` : '';
  const rasc = d.rasc && !cheios.length ? `<div class="digRasc"><b>▶ Digitalização não concluída</b><div class="small muted">${esc(d.rasc.quando)} · ${d.rasc.nDocs} documento${d.rasc.nDocs === 1 ? '' : 's'} · ${d.rasc.nPags} página${d.rasc.nPags === 1 ? '' : 's'}${d.rasc.rotulo ? ' · ' + esc(d.rasc.rotulo) : ''}</div>
    <div class="digAdd"><button type="button" class="btn primary" data-dg="retomar">▶ Retomar</button><button type="button" class="btn" data-dg="descartar">Descartar</button></div></div>` : '';
  const nPag = doc.pags.length, qual = DIG_QUAL[d.qual];
  let corpo, esq;
  if(d.feito) corpo = `<div class="digVazio"><div style="font-size:44px">✅</div><p><b>${esc(d.feito.txt)}</b></p>${d.feito.links || ''}
    <div class="digAdd"><button type="button" class="btn primary" data-dg="denovo">📷 Digitalizar outro</button><button type="button" class="btn" data-dg="fechar">Fechar</button></div></div>`;
  else if(p && d.marcar && typeof digMarcarHtml === 'function') esq = digMarcarHtml(p);
  else if(p && d.livro) esq = `<div class="digMarcTopo"><b>📖 Livro: dividir em 2 páginas</b></div>
      <div class="digStage" id="digStage"><canvas id="digCv"></canvas><div id="digDobra" class="digDobra ${d.livro.eixo}"></div></div>
      <div class="small muted" style="margin:6px 0">Arraste a linha amarela até a dobra (o meio do livro / da CTPS). A parte de ${d.livro.eixo === 'x' ? 'esquerda vira a 1ª página e a da direita, a 2ª' : 'cima vira a 1ª página e a de baixo, a 2ª'}.</div>
      <div class="digAdd"><button type="button" class="btn primary" data-dg="livroOk">✔ Dividir aqui</button><button type="button" class="btn" data-dg="livroGira" title="Dividir na outra direção">⟳ Linha ${d.livro.eixo === 'x' ? 'deitada' : 'em pé'}</button><button type="button" class="btn" data-dg="livroNao">Cancelar</button></div>`;
  else if(p) esq = `<div class="digStage ${d.ver ? 'res' : ''}" id="digStage"><canvas id="digCv"></canvas>${d.ver ? '' : '<svg id="digSvg"></svg><canvas id="digLupa" class="digLupa" hidden></canvas>'}</div>
      <div class="digNav"><button type="button" class="mini" data-dg="pgAnt" title="Página anterior" ${d.at ? '' : 'disabled'}>◀</button><b>${d.at + 1} / ${nPag}</b><button type="button" class="mini" data-dg="pgProx" title="Próxima página" ${d.at < nPag - 1 ? '' : 'disabled'}>▶</button>
        <button type="button" class="mini" data-dg="comparar" title="Segure para ver a foto original">👁 Comparar (segure)</button></div>
      <div class="digFerr">
        <button type="button" class="mini" data-dg="cam" title="Fotografar mais páginas para este documento">📷 Mais fotos</button>
        <button type="button" class="mini" data-dg="auto" title="Achar as bordas do documento de novo">✂️ Recorte automático</button>
        <button type="button" class="mini" data-dg="inteira" title="Usar a foto inteira, sem recorte">⬜ Imagem inteira</button>
        <button type="button" class="mini" data-dg="girar" title="Girar 90°">⟳ Girar</button>
        <button type="button" class="mini ${d.ver ? 'on' : ''}" data-dg="ver">${d.ver ? '✏️ Ajustar cantos' : '👁 Ver resultado'}</button>
        <button type="button" class="mini" data-dg="esq" title="Mover para antes" ${d.at ? '' : 'disabled'}>◀</button><button type="button" class="mini" data-dg="dir" title="Mover para depois" ${d.at < nPag - 1 ? '' : 'disabled'}>▶</button>
        <button type="button" class="mini" data-dg="excluir">🗑 Excluir página</button>
        <button type="button" class="mini" data-dg="separar" title="Esta página e as seguintes viram outro documento (outro PDF)" ${d.at ? '' : 'disabled'}>✂ Novo documento a partir desta página</button>
        <button type="button" class="mini" data-dg="refazer" title="Fotografar esta página de novo (fica no mesmo lugar)">📷 Refazer</button>
        <button type="button" class="mini" data-dg="livro" title="Livro, CTPS: a foto das duas páginas abertas vira 2 páginas">📖 Livro: dividir em 2</button>
        <button type="button" class="mini" data-dg="marcar" title="Tarja (preta/branca), texto, assinatura e marca d’água">🖊 Marcar</button></div>
      <div class="digFiltros">${DIG_FILTROS.map(([k, l]) => `<button type="button" class="dgFt ${p.filtro === k ? 'on' : ''}" data-dgf="${k}"><canvas data-ftc="${k}"></canvas><span>${l}</span></button>`).join('')}</div>
      ${nPag > 1 ? `<label class="digTodas small"><input type="checkbox" id="digFTodas" ${d.filtroTodas ? 'checked' : ''}> aplicar a todas as ${nPag} páginas</label>` : ''}
      <div class="small muted" id="digAviso">${esc(d.ver ? (p.falhou ? p.aviso : '✂️ Recortada automaticamente — confira. Para mexer no recorte: “✏️ Ajustar cantos”.') : p.aviso || 'Arraste os cantos (●) até as bordas do documento.')}</div>`;
  else esq = `${rasc}<div class="digVazio"><div style="font-size:44px">📄</div><p><b>${cheios.length ? `Fotografe as páginas de “${esc(doc.nome)}”` : 'Fotografe o documento'}</b> ou escolha imagens já salvas.<br><span class="small muted">${doc.modo === 'id' ? 'Modo ID: fotografe a frente e depois o verso — os dois saem na mesma folha A4.' : doc.modo === 'colagem' ? `Colagem: ${doc.colN} fotos por folha A4 (comprovantes, recibos, cupons).` : 'Cada foto vira uma página do PDF.'} Vários documentos? Fotografe tudo em sequência e separe depois com “✂ Novo documento”.</span></p>
        ${modoCap}<div class="small muted" style="margin-top:4px">${d.captura === 'lote' ? 'Lote: a câmera fica aberta — fotografe todas as páginas e toque em “Concluir”.' : 'Foto única: depois de cada foto você confere o resultado.'}</div>
        <div class="digAdd">${add}</div>
        <p class="small muted">Dicas: apoie o documento num fundo de cor diferente (mesa escura para papel branco), com boa luz. Você também pode arrastar ou colar (Ctrl+V) imagens aqui.</p></div>`;
  if(!d.feito) corpo = `<div class="digEsq">${esq}</div>
    <div class="digDir">
      ${cheios.length ? `<div class="digDocs">${d.docs.map((x, k) => (x.pags.length || k === d.di) ? `<div class="digDocG ${k === d.di ? 'on' : ''} ${x.st}">
          <div class="digDocH">${varios ? `<input type="checkbox" data-dgsel="${k}" ${x.sel && x.st !== 'ok' ? 'checked' : ''} ${x.st === 'ok' ? 'disabled' : ''} title="Enviar este documento">` : ''}
            <button type="button" class="digDocN" data-dgd="${k}">${x.st === 'ok' ? '✔ ' : x.st === 'erro' ? '⚠️ ' : ''}${esc(x.nome)}</button>
            <span class="small muted">${x.pags.length} pág.${x.modo === 'id' ? ' · 🪪' : x.modo === 'colagem' ? ' · 🧩' : ''}</span>
            ${k > 0 && x.st !== 'ok' && d.docs[k - 1].st !== 'ok' ? `<button type="button" class="mini" data-dgjunta="${k}" title="Juntar com o documento anterior (um PDF só)">⤒ juntar</button>` : ''}</div>
          ${x.msg ? `<div class="small" style="color:${x.st === 'erro' ? 'var(--bad)' : 'var(--ok)'}">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.msg)} ↗</a>` : esc(x.msg)}</div>` : ''}
          <div class="digPags">${x.pags.map((y, i) => `<button type="button" class="digTh ${k === d.di && i === d.at ? 'on' : ''}" data-dgp="${k}:${i}" title="Página ${i + 1}">${y.thumb ? `<img src="${y.thumb}" alt="">` : '<span>…</span>'}<i>${i + 1}</i></button>`).join('') || '<span class="small muted">sem páginas ainda</span>'}</div></div>` : '').join('')}</div>
        <div class="digAdd">${add}<button type="button" class="btn" data-dg="novodoc" title="As próximas fotos vão para outro documento (outro PDF)">➕ Novo documento</button></div>` : ''}
      <div class="digOpc">
        ${varios ? `<div class="small"><b>Documento selecionado:</b> <span id="digSelNome">${esc(doc.nome)}</span></div>` : ''}
        <label>Formato do PDF</label>
        <div class="digSeg digSeg3"><button type="button" data-dgm="pagina" class="${doc.modo === 'pagina' ? 'on' : ''}">📄 Página inteira</button><button type="button" data-dgm="id" class="${doc.modo === 'id' ? 'on' : ''}">🪪 Modo ID</button><button type="button" data-dgm="colagem" class="${doc.modo === 'colagem' ? 'on' : ''}">🧩 Colagem</button></div>
        <div class="small muted">${doc.modo === 'id' ? 'Documentos numa folha A4, um embaixo do outro (ex.: frente e verso do RG), em tamanho real ou ampliados.' : doc.modo === 'colagem' ? 'Comprovantes, recibos e cupons arrumados na folha A4, na ordem das páginas, sem cortar nem deformar.' : 'Cada foto ocupa uma folha A4 inteira.'}</div>
        ${doc.modo === 'id' ? `<label>Tamanho do documento<select id="digIdTam">${Object.entries(DIG_ID).map(([k, v]) => `<option value="${k}" ${doc.idTam === k ? 'selected' : ''}>${v.n}</option>`).join('')}</select></label>
          <label>Tamanho no PDF<select id="digIdEsc">${DIG_ESC.map(([k, l]) => `<option value="${k}" ${+doc.idEsc === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          ${doc.idTam === 'outro' ? `<div class="row2"><label>Largura (cm)<input type="number" step="0.1" min="1" max="19" id="digIdW" value="${doc.idW}"></label><label>Altura (cm)<input type="number" step="0.1" min="1" max="27" id="digIdH" value="${doc.idH}"></label></div>` : ''}` : ''}
        ${doc.modo === 'colagem' ? `<div class="digChips">${[2, 4, 6].map(n => `<button type="button" class="dgChip ${+doc.colN === n ? 'on' : ''}" data-dgcol="${n}">${n} por folha</button>`).join('')}
          <label class="digTodas small"><input type="checkbox" id="digColMold" ${doc.colMold ? 'checked' : ''}> com moldura</label></div>
          ${nPag ? `<div class="small muted">${nPag} foto${nPag === 1 ? '' : 's'} em ${doc.colN} por folha = ${Math.ceil(nPag / doc.colN)} folha${Math.ceil(nPag / doc.colN) === 1 ? '' : 's'} no PDF</div>` : ''}` : ''}
        <label>Qualidade do arquivo</label>
        <div class="digSeg digSeg3">${Object.entries(DIG_QUAL).map(([k, v]) => `<button type="button" data-dgq="${k}" class="${d.qual === k ? 'on' : ''}">${v.n}<small>~${v.kb} KB/pág.</small></button>`).join('')}</div>
        <div class="small muted">${d.qual === 'leve' ? 'Leve: para e-mail, WhatsApp e PJe (limites de envio).' : d.qual === 'alta' ? 'Alta: para documento com letra miúda.' : 'Normal: bom para a maioria dos documentos.'}${nPag ? ` Este documento: ${nPag} pág. ≈ ${digKB(nPag * qual.kb * (doc.modo === 'pagina' ? 1 : .5))}.` : ''}</div>
        <label class="digTodas"><input type="checkbox" id="digMarcaOn" ${doc.marcaOn ? 'checked' : ''}> 💧 Marca d’água <span class="small muted">(em todas as páginas)</span></label>
        ${doc.marcaOn ? `<input id="digMarcaTxt" value="${esc(doc.marca)}" placeholder="Texto da marca d’água">` : ''}
        <label>Nome do arquivo<input id="digNome" value="${esc(doc.nome)}"></label>
        ${doc.nomeAuto ? '<div class="small muted">Código automático (DOC-… para documentos, ID-… para o modo ID). Pode trocar pelo nome que quiser.</div>' : ''}
        <label>Destino${varios ? ' (o mesmo para todos)' : ''}<select id="digDestino">${destinos.map(([k, l]) => `<option value="${k}" ${d.destino === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        ${d.nota ? `<div class="small" style="color:var(--warn)">${esc(d.nota)}</div>` : ''}
        <label class="digOcr" title="Em breve"><input type="checkbox" disabled> 🔎 Texto pesquisável (OCR) <span class="dgBreve">em breve</span></label>
        <div id="digSt" class="small"></div>
        <button type="button" class="btn primary digOk" data-dg="gerar" ${digPendentes().some(x => x.sel) && !d.marcar && !d.livro ? '' : 'disabled'}>${digRotulo()}</button>
      </div>
    </div>`;
  ov.innerHTML = `<div class="digBox"><div class="digTop"><b>📷 Digitalizar documento</b><span class="small muted digDest">${esc(dest)}</span><button type="button" class="digX" data-dg="fechar" aria-label="Fechar">×</button></div>
    <div class="digCorpo ${d.feito ? 'fim' : ''}">${corpo}</div></div>
    <input type="file" accept="image/*" capture="environment" id="digCam" hidden><input type="file" accept="image/*" multiple id="digImg" hidden>`;
  if(p && !d.feito){ digDesenhar(); if(!d.marcar && !d.livro) digFiltroMinis(p); }
  if(d.feito) digRascApagar(); else if(d.teve) digRascSalvar();
}
// miniaturas dos filtros: a própria página com cada filtro (pequena, sem travar a tela)
function digFiltroMinis(p){ let i = 0; const um = () => { if(!dig || digPag() !== p || i >= DIG_FILTROS.length) return; const k = DIG_FILTROS[i++][0], c = document.querySelector(`#digOv canvas[data-ftc="${k}"]`);
  if(c){ const s = digProcessar(p, 140, {filtro:k, semMarcas:true}), r = Math.min(56 / s.width, 70 / s.height), dpr = Math.min(2, devicePixelRatio || 1);
    c.width = Math.round(s.width * r * dpr); c.height = Math.round(s.height * r * dpr); c.style.width = Math.round(s.width * r) + 'px'; c.style.height = Math.round(s.height * r) + 'px'; c.getContext('2d').drawImage(s, 0, 0, c.width, c.height); }
  setTimeout(um, 0); }; setTimeout(um, 30); }
const digVerPadrao = p => !(p && p.falhou);
function digIrPag(k, i){ dig.di = k; dig.at = i; dig.ver = digVerPadrao(digPag()); dig.comparar = false; digRender(); }
function digLigar(ov){
  ov.addEventListener('click', e => {
    const b = e.target.closest('[data-dg],[data-dgf],[data-dgp],[data-dgm],[data-dgd],[data-dgjunta],[data-dgcap],[data-dgcol],[data-dgq]'); if(!b || !dig) return;
    const d = dig, doc = digDoc(), p = digPag();
    if(b.dataset.dgcap){ d.captura = b.dataset.dgcap; digGuardarCfg(); digRender(); return; }
    if(b.dataset.dgq){ d.qual = b.dataset.dgq; digGuardarCfg(); digRender(); return; }
    if(b.dataset.dgcol){ doc.colN = +b.dataset.dgcol; digGuardarCfg(); digRender(); return; }
    if(b.dataset.dgf){ d.filtro = b.dataset.dgf; const alvo = d.filtroTodas ? doc.pags : [p]; alvo.forEach(x => x.filtro = d.filtro); digGuardarCfg(); digRender(); alvo.forEach(digThumb); return; }
    if(b.dataset.dgp){ const [k, i] = b.dataset.dgp.split(':').map(Number); d.marcar = null; d.livro = null; digIrPag(k, i); return; }
    if(b.dataset.dgd){ d.marcar = null; d.livro = null; digIrPag(+b.dataset.dgd, 0); return; }
    if(b.dataset.dgjunta){ const k = +b.dataset.dgjunta, ant = d.docs[k - 1]; d.at = ant.pags.length; ant.pags.push(...d.docs[k].pags); d.docs.splice(k, 1); d.di = k - 1; digRenomear(); digRender(); return; }
    if(b.dataset.dgm){ doc.modo = b.dataset.dgm; digGuardarCfg(); digRenomear(); digRender(); return; }
    const a = b.dataset.dg;
    if(a === 'fechar') return digFechar();
    if(a === 'cam'){ d.refazer = null; return digCamAbrir(); }
    if(a === 'img'){ d.refazer = null; return ov.querySelector('#digImg').click(); }
    if(a === 'gerar') return digConcluir();
    if(a === 'retomar') return digRascRetomar();
    if(a === 'descartar'){ d.rasc = null; digRascApagar(); return digRender(); }
    if(a === 'denovo'){ d.docs = []; d.nDocs = 0; d.docs.push(digNovoDoc()); d.di = 0; d.at = 0; d.feito = null; digRenomear(); return digRender(); }
    if(a === 'novodoc'){ if(doc.pags.length){ d.docs.push(digNovoDoc()); d.di = d.docs.length - 1; } d.at = 0; d.ver = true; digRenomear(); return digRender(); }
    if(!p) return;
    if(a === 'pgAnt' && d.at > 0) return digIrPag(d.di, d.at - 1);
    if(a === 'pgProx' && d.at < doc.pags.length - 1) return digIrPag(d.di, d.at + 1);
    if(a === 'comparar') return;
    if(a === 'refazer'){ d.refazer = {doc, p}; return digCamAbrir({unica:true}); }
    if(a === 'livro'){ const cv = digProcessar(p, 1400, {semMarcas:true}), eixo = cv.width >= cv.height ? 'x' : 'y'; d.livro = {eixo, pos:digDobra(cv, eixo)}; return digRender(); }
    if(a === 'livroGira'){ d.livro.eixo = d.livro.eixo === 'x' ? 'y' : 'x'; d.livro.pos = digDobra(digProcessar(p, 1400, {semMarcas:true}), d.livro.eixo); return digRender(); }
    if(a === 'livroNao'){ d.livro = null; return digRender(); }
    if(a === 'livroOk'){ const novas = digDividir(p, d.livro.pos, d.livro.eixo); doc.pags.splice(d.at, 1, ...novas); d.livro = null; d.ver = true; digRender(); novas.forEach(digThumb); toast('📖 Dividida em 2 páginas'); return; }
    if(a === 'marcar' && typeof digMarcarAbrir === 'function') return digMarcarAbrir();
    if(a === 'separar' && d.at > 0){ const novo = digNovoDoc(); ['modo', 'idTam', 'idW', 'idH', 'idEsc', 'colN', 'colMold', 'marcaOn', 'marca'].forEach(k => novo[k] = doc[k]);
      novo.pags = doc.pags.splice(d.at); d.docs.splice(d.di + 1, 0, novo); d.di++; d.at = 0; d.ver = digVerPadrao(novo.pags[0]); digRenomear(); }
    if(a === 'auto'){ const r = digDetectar(p.img); p.quad = r.quad; p.falhou = !r.ok; p.aviso = r.ok ? '✂️ Bordas encontradas — confira o resultado.' : '⚠️ Não encontrei as bordas — arraste os cantos (●) até elas.'; d.ver = r.ok; }
    if(a === 'inteira'){ p.quad = digInteira(p.img); p.falhou = false; p.aviso = 'Foto inteira, sem recorte.'; }
    if(a === 'girar') p.rot = (p.rot + 1) % 4;
    if(a === 'ver'){ d.ver = !d.ver; if(d.ver) p.falhou = false; }
    const ps = doc.pags;
    if(a === 'esq' && d.at > 0){ [ps[d.at - 1], ps[d.at]] = [ps[d.at], ps[d.at - 1]]; d.at--; }
    if(a === 'dir' && d.at < ps.length - 1){ [ps[d.at + 1], ps[d.at]] = [ps[d.at], ps[d.at + 1]]; d.at++; }
    if(a === 'excluir'){ ps.splice(d.at, 1);
      if(!ps.length && d.docs.length > 1){ d.docs.splice(d.di, 1); d.di = Math.max(0, d.di - 1); d.at = Math.max(0, d.docs[d.di].pags.length - 1); digRenomear(); }
      else d.at = Math.max(0, Math.min(d.at, ps.length - 1)); d.ver = digVerPadrao(digPag()); }
    if(['auto', 'inteira', 'girar', 'esq', 'dir', 'excluir', 'separar'].includes(a)) d.docs.forEach(x => { if(x.st === 'erro'){ x.st = ''; x.msg = ''; } });
    digRender(); if(['auto', 'inteira', 'girar'].includes(a)) digThumb(p);
  });
  // 👁 Comparar: enquanto o dedo estiver no botão, mostra a foto original
  const cmp = on => e => { const b = e.target.closest && e.target.closest('[data-dg="comparar"]'); if(!dig || (on && !b) || dig.comparar === on) return; if(on) e.preventDefault(); dig.comparar = on; digDesenhar(); };
  ov.addEventListener('pointerdown', cmp(true)); ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => ov.addEventListener(t, cmp(false), true));
  ov.addEventListener('change', e => {
    if(!dig) return; const t = e.target, doc = digDoc();
    if(t.id === 'digCam' || t.id === 'digImg'){ const fs = [...t.files]; t.value = ''; digArquivos(fs); }
    if(t.dataset.dgsel){ dig.docs[+t.dataset.dgsel].sel = t.checked; const b = ov.querySelector('.digOk'); if(b){ b.textContent = digRotulo(); b.disabled = !digPendentes().some(x => x.sel); } }
    if(t.id === 'digIdTam'){ doc.idTam = t.value; digGuardarCfg(); digRender(); }
    if(t.id === 'digIdEsc'){ doc.idEsc = +t.value || 1; digGuardarCfg(); }
    if(t.id === 'digFTodas'){ dig.filtroTodas = t.checked; digGuardarCfg(); }
    if(t.id === 'digColMold'){ doc.colMold = t.checked; digGuardarCfg(); }
    if(t.id === 'digMarcaOn'){ doc.marcaOn = t.checked; if(t.checked && !doc.marca) doc.marca = digMarcaPadrao(); digRender(); }
    if(t.id === 'digIdW' || t.id === 'digIdH'){ const v = parseFloat(String(t.value).replace(',', '.')); if(v > 0){ doc[t.id === 'digIdW' ? 'idW' : 'idH'] = v; digGuardarCfg(); } }
    if(t.id === 'digDestino'){ dig.destino = t.value; const b = ov.querySelector('.digOk'); if(b) b.textContent = digRotulo(); }
  });
  ov.addEventListener('input', e => { if(!dig) return; const doc = digDoc();
    if(e.target.id === 'digMarcaTxt'){ doc.marca = e.target.value; if(dig.ver) digDesenhar(); digRascSalvar(); return; }
    if(e.target.id !== 'digNome') return; doc.nome = e.target.value; doc.nomeAuto = false;
    const n = ov.querySelector(`[data-dgd="${dig.di}"]`); if(n) n.textContent = (doc.st === 'erro' ? '⚠️ ' : '') + doc.nome; const sn = ov.querySelector('#digSelNome'); if(sn) sn.textContent = doc.nome; digRascSalvar(); });
  ov.addEventListener('dragover', e => e.preventDefault());
  ov.addEventListener('drop', e => { e.preventDefault(); if(dig && !dig.feito) digArquivos([...(e.dataTransfer?.files || [])]); });
  window.addEventListener('paste', e => { if(!dig || dig.feito) return; const fs = [...(e.clipboardData?.files || [])].filter(f => /^image\//.test(f.type)); if(fs.length){ e.preventDefault(); digArquivos(fs); } });
  window.addEventListener('keydown', e => { if(dig && e.key === 'Escape'){ e.stopPropagation(); if(digCam) digCamFechar(); else if(document.getElementById('digSheet')) document.getElementById('digSheet').remove(); else if(dig.marcar || dig.livro){ dig.marcar = dig.livro = null; digRender(); } else digFechar(); } }, true);
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if(dig && digPag() && !dig.feito) digDesenhar(); }, 150); });
}

/* ----- imagens ----- */
async function digArquivos(files){
  for(const f of files){
    if(!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(f.name)){ toast(`“${f.name}” não é uma imagem`); continue; }
    try{ digAddCanvas(await digCarregar(f)); }
    catch(e){ toast(`Não foi possível abrir “${f.name}”${/hei[cf]$/i.test(f.name) ? ' (HEIC: use “Tirar foto” ou salve como JPEG)' : ''}`); }
  }
}
function digCarregar(file){ return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image();
  im.onload = () => { const s = Math.min(1, DIG_MAX / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(im.naturalWidth * s)); cv.height = Math.max(1, Math.round(im.naturalHeight * s));
    cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); res(cv); };
  im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('imagem inválida')); }; im.src = u; }); }
/* foto nova → página. o.quadPadrao: recorte usado se as bordas não forem achadas (retângulo-guia do modo ID).
   dig.refazer = {doc, p}: a foto substitui aquela página (📷 Refazer). dig.livroAuto: cada foto já sai dividida em 2 (📖 na câmera).
   Devolve a lista de páginas criadas. */
function digAddCanvas(cv, o = {}){
  let doc = digDoc(); if(doc.st === 'ok'){ dig.docs.push(doc = digNovoDoc()); dig.di = dig.docs.length - 1; digRenomear(); } // documento já enviado: as fotos novas vão para outro
  const r = digDetectar(cv); let quad = r.quad, ok = r.ok, aviso = r.ok ? '' : '⚠️ Não encontrei as bordas do documento — arraste os cantos (●) até elas.';
  if(!ok && o.quadPadrao){ quad = o.quadPadrao; ok = true; aviso = 'Recortado pelo retângulo-guia.'; }
  const ant = dig.refazer && dig.refazer.doc.pags.includes(dig.refazer.p) ? dig.refazer : null; dig.refazer = null;
  let p = {id:uid(), img:cv, quad, filtro:ant ? ant.p.filtro : dig.filtro, rot:0, falhou:!ok, aviso, marcas:[]}, novas = [p];
  if(dig.livroAuto && ok && !ant){ const r0 = digProcessar(p, 600, {semMarcas:true, filtro:'original'}), eixo = r0.width >= r0.height ? 'x' : 'y'; novas = digDividir(p, digDobra(r0, eixo), eixo, true); }
  if(ant){ const k = dig.docs.indexOf(ant.doc), i = ant.doc.pags.indexOf(ant.p); ant.doc.pags.splice(i, 1, p); dig.di = k; dig.at = i; }
  else { doc.pags.push(...novas); dig.at = doc.pags.length - 1; }
  const dd = digDoc(); if(dd.st === 'erro'){ dd.st = ''; dd.msg = ''; } dig.teve = true; dig.rasc = null;
  dig.ver = ok; dig.marcar = null; dig.livro = null; digRender(); novas.forEach(digThumb); return novas;
}
function digThumb(p){ setTimeout(() => { if(!dig) return; const k = dig.docs.findIndex(x => x.pags.includes(p)); if(k < 0) return;
  p.thumb = digProcessar(p, 220).toDataURL('image/jpeg', .7);
  const i = dig.docs[k].pags.indexOf(p), el = document.querySelector(`#digOv [data-dgp="${k}:${i}"]`); if(el) el.innerHTML = `<img src="${p.thumb}" alt=""><i>${i + 1}</i>`; digRascSalvar(); }, 20); }

/* ----- 📖 Livro / CTPS: a página endireitada vira 2 (esquerda|direita ou cima|baixo) -----
   digDobra acha a dobra (a faixa mais escura perto do meio); digDividir corta a imagem já endireitada, sem filtro, e cada metade vira uma página nova. */
function digDobra(cv, eixo){
  const k = Math.min(1, 240 / Math.max(cv.width, cv.height)), w = Math.max(4, Math.round(cv.width * k)), h = Math.max(4, Math.round(cv.height * k)), c = document.createElement('canvas');
  c.width = w; c.height = h; const x = c.getContext('2d', {willReadFrequently:true}); x.drawImage(cv, 0, 0, w, h); const px = x.getImageData(0, 0, w, h).data, n = eixo === 'x' ? w : h, perf = new Float32Array(n);
  for(let y = 0; y < h; y++) for(let z = 0; z < w; z++){ const i = (y * w + z) * 4; perf[eixo === 'x' ? z : y] += .299 * px[i] + .587 * px[i + 1] + .114 * px[i + 2]; }
  const ini = Math.round(n * .35), fim = Math.round(n * .65); let min = Infinity, at = .5, soma = 0;
  for(let i = ini; i <= fim; i++){ const v = (perf[i - 1] + perf[i] + perf[i + 1]) / 3; soma += v; if(v < min){ min = v; at = i / n; } }
  return min < soma / (fim - ini + 1) * .9 ? at : .5;
}
function digDividir(p, pos, eixo, auto){
  const base = digProcessar(p, DIG_MAX, {semMarcas:true, filtro:'original'}), W = base.width, H = base.height, corte = Math.round((eixo === 'x' ? W : H) * Math.max(.1, Math.min(.9, pos)));
  return [0, 1].map(i => { const c = document.createElement('canvas'), x0 = eixo === 'x' && i ? corte : 0, y0 = eixo === 'y' && i ? corte : 0;
    c.width = eixo === 'x' ? (i ? W - corte : corte) : W; c.height = eixo === 'y' ? (i ? H - corte : corte) : H; c.getContext('2d').drawImage(base, -x0, -y0);
    return {id:uid(), img:c, quad:digInteira(c), filtro:p.filtro, rot:0, falhou:false, aviso:auto ? '📖 Dividida automaticamente (livro).' : '📖 Metade ' + (i ? 'direita/de baixo' : 'esquerda/de cima') + ' do livro.', marcas:[]}; });
}

/* ----- desenho do palco: resultado (padrão), cantos ajustáveis, comparar, livro e marcar ----- */
function digPalco(src){ const st = document.getElementById('digStage'), W = src.width, H = src.height;
  const maxH = innerWidth <= 760 ? innerHeight * .5 : Math.max(240, innerHeight - 250), maxW = Math.max(120, (st ? st.clientWidth : 300) - 8);
  const s = Math.min(maxW / W, maxH / H); return {W, H, cw:Math.max(1, Math.round(W * s)), ch:Math.max(1, Math.round(H * s)), dpr:Math.min(2, devicePixelRatio || 1)}; }
function digDesenhar(){
  const p = digPag(), st = document.getElementById('digStage'), cv = document.getElementById('digCv'); if(!p || !st || !cv) return;
  if(dig.marcar && typeof digMarcarDesenhar === 'function') return digMarcarDesenhar();
  const res = (dig.ver || dig.livro) && !dig.comparar, src = res ? digProcessar(p, 1400, dig.livro ? {semMarcas:true} : {}) : p.img, {W, H, cw, ch, dpr} = digPalco(src);
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  const ctx = cv.getContext('2d'); ctx.drawImage(src, 0, 0, cv.width, cv.height);
  if(res && !dig.livro && digDoc().marcaOn) digMarcaDagua(ctx, cv.width, cv.height, digDoc().marca);
  if(dig.livro){ const ln = document.getElementById('digDobra'), x = dig.livro.eixo === 'x', r = cv.getBoundingClientRect(), sr = st.getBoundingClientRect();
    const pos = () => { ln.style.left = (r.left - sr.left + (x ? cw * dig.livro.pos : 0)) + 'px'; ln.style.top = (r.top - sr.top + (x ? 0 : ch * dig.livro.pos)) + 'px'; ln.style[x ? 'height' : 'width'] = (x ? ch : cw) + 'px'; };
    pos(); let arr = false;
    st.onpointerdown = e => { arr = true; st.setPointerCapture(e.pointerId); e.preventDefault(); st.onpointermove(e); };
    st.onpointermove = e => { if(!arr) return; const rr = cv.getBoundingClientRect(); dig.livro.pos = Math.max(.1, Math.min(.9, x ? (e.clientX - rr.left) / rr.width : (e.clientY - rr.top) / rr.height)); pos(); };
    st.onpointerup = st.onpointercancel = () => { arr = false; };
    return; }
  if(res){ // resultado: arrastar o dedo para os lados passa as páginas
    let x0 = null; st.onpointerdown = e => { x0 = e.clientX; }; st.onpointermove = null;
    st.onpointerup = e => { if(x0 === null) return; const dx = e.clientX - x0; x0 = null; if(Math.abs(dx) < 50 || !dig) return; const n = digDoc().pags.length;
      if(dx < 0 && dig.at < n - 1) digIrPag(dig.di, dig.at + 1); else if(dx > 0 && dig.at > 0) digIrPag(dig.di, dig.at - 1); };
    return; }
  st.onpointerdown = st.onpointerup = st.onpointermove = null;
  const svg = document.getElementById('digSvg'); if(!svg) return;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.style.width = cw + 'px'; svg.style.height = ch + 'px';
  const k = W / cw, q = p.quad;
  svg.innerHTML = `<polygon class="digPoly" points="${q.map(c => c.join(',')).join(' ')}" stroke-width="${2 * k}"></polygon>`
    + q.map((c, i) => `<circle class="digAlvo" data-i="${i}" cx="${c[0]}" cy="${c[1]}" r="${24 * k}"></circle><circle class="digH" data-i="${i}" cx="${c[0]}" cy="${c[1]}" r="${10 * k}" stroke-width="${3 * k}"></circle>`).join('');
  // arrastar: o canto acompanha o dedo sem pular para baixo dele, e a 🔍 lupa (no canto oposto do palco) mostra a borda ampliada com a mira
  let arr = -1, off = [0, 0]; const lupa = document.getElementById('digLupa'), LP = 120, Z = 3;
  const pos = e => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  const lupaDesenhar = () => { if(!lupa || arr < 0) return; const c = q[arr], dpr2 = Math.min(3, devicePixelRatio || 1), S = LP / (cw / W) / Z, x0 = c[0] - S / 2, y0 = c[1] - S / 2, f = LP * dpr2 / S;
    lupa.hidden = false; lupa.width = lupa.height = Math.round(LP * dpr2); lupa.style.left = c[0] < W / 2 ? '' : '8px'; lupa.style.right = c[0] < W / 2 ? '8px' : '';
    const x = lupa.getContext('2d'); x.fillStyle = '#20262f'; x.fillRect(0, 0, lupa.width, lupa.height); x.drawImage(p.img, x0, y0, S, S, 0, 0, lupa.width, lupa.height);
    const t = v => [(v[0] - x0) * f, (v[1] - y0) * f]; x.lineWidth = 2 * dpr2; x.strokeStyle = '#5b9bd5'; x.beginPath(); const a = t(q[(arr + 3) % 4]), m = t(c), b = t(q[(arr + 1) % 4]);
    x.moveTo(a[0], a[1]); x.lineTo(m[0], m[1]); x.lineTo(b[0], b[1]); x.stroke();
    x.strokeStyle = '#ff3b30'; x.lineWidth = 1.5 * dpr2; const h = lupa.width / 2; x.beginPath(); x.moveTo(h - 14 * dpr2, h); x.lineTo(h + 14 * dpr2, h); x.moveTo(h, h - 14 * dpr2); x.lineTo(h, h + 14 * dpr2); x.stroke(); };
  svg.onpointerdown = e => { const c = e.target.closest('[data-i]'); if(!c) return; arr = +c.dataset.i; const ps = pos(e); off = [q[arr][0] - ps[0], q[arr][1] - ps[1]];
    svg.setPointerCapture(e.pointerId); e.preventDefault(); lupaDesenhar(); };
  svg.onpointermove = e => { if(arr < 0) return; const ps = pos(e); q[arr] = [Math.max(0, Math.min(W, ps[0] + off[0])), Math.max(0, Math.min(H, ps[1] + off[1]))];
    svg.querySelector('.digPoly').setAttribute('points', q.map(c => c.join(',')).join(' '));
    svg.querySelectorAll(`[data-i="${arr}"]`).forEach(c => { c.setAttribute('cx', q[arr][0]); c.setAttribute('cy', q[arr][1]); }); lupaDesenhar(); };
  svg.onpointerup = svg.onpointercancel = () => { if(arr < 0) return; arr = -1; if(lupa) lupa.hidden = true; p.falhou = false; p.aviso = 'Cantos ajustados — toque em “👁 Ver resultado” para conferir.'; const a = document.getElementById('digAviso'); if(a) a.textContent = p.aviso; digThumb(p); };
}
// 💧 marca d’água: texto na diagonal, vermelho bem claro, no meio da página (quebra em 2 linhas no “—”)
function digMarcaDagua(ctx, W, H, txt){ txt = String(txt || '').trim(); if(!txt) return;
  const ls = txt.split(/\s+[—–-]\s+/).map(s => s.trim()).filter(Boolean).slice(0, 3), ang = -Math.atan2(H, W) * .85;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(ang); ctx.fillStyle = 'rgba(200,30,30,.2)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = Math.min(W, H) * .09; ctx.font = `bold ${fs}px Arial, sans-serif`; const larg = Math.max(...ls.map(l => ctx.measureText(l.toUpperCase()).width)), maxL = Math.hypot(W, H) * .8;
  if(larg > maxL){ fs *= maxL / larg; ctx.font = `bold ${fs}px Arial, sans-serif`; }
  ls.forEach((l, i) => ctx.fillText(l.toUpperCase(), 0, (i - (ls.length - 1) / 2) * fs * 1.25)); ctx.restore(); }

/* ----- ▶ Retomar: rascunho no IndexedDB do aparelho (separado dos dados do escritório; some quando os documentos saem) ----- */
const DIG_RASC = {db:null, t:0};
function digRascIdb(){ return DIG_RASC.db || (DIG_RASC.db = new Promise((res, rej) => { if(!window.indexedDB) return rej(new Error('sem IndexedDB'));
  const r = indexedDB.open('escritorio_digitalizar', 1); r.onupgradeneeded = () => { r.result.createObjectStore('meta'); r.result.createObjectStore('pags'); };
  r.onsuccess = () => res(r.result); r.onerror = () => { DIG_RASC.db = null; rej(r.error); }; })); }
const digRascTx = (db, st, modo, fn) => new Promise((res, rej) => { const t = db.transaction(st, modo); let out; t.oncomplete = () => res(out); t.onerror = t.onabort = () => rej(t.error); out = fn(t); });
const digReq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
function digRascSalvar(ja){ clearTimeout(DIG_RASC.t); if(!dig || !dig.teve) return; const d = dig; DIG_RASC.t = setTimeout(() => digRascGravar(d).catch(() => {}), ja ? 0 : 700); }
async function digRascGravar(d){
  const docs = d.docs.filter(x => x.pags.length && x.st !== 'ok'); if(!docs.length) return digRascApagar();
  const db = await digRascIdb(), pags = docs.flatMap(x => x.pags), novos = [];
  for(const p of pags) if(!p._salvo){ const bl = await new Promise(r => p.img.toBlob(r, 'image/jpeg', .92)); if(bl) novos.push([p, bl]); }
  const meta = {em:Date.now(), rotulo:d.rotulo || '', docs:docs.map(x => ({...x, pags:x.pags.map(p => ({id:p.id, quad:p.quad, filtro:p.filtro, rot:p.rot, falhou:!!p.falhou, aviso:p.aviso || '', marcas:p.marcas || []}))}))};
  await digRascTx(db, ['meta', 'pags'], 'readwrite', t => { const pg = t.objectStore('pags'); novos.forEach(([p, bl]) => pg.put(bl, p.id)); t.objectStore('meta').put(meta, 'atual');
    const vivos = new Set(pags.map(p => p.id)); pg.getAllKeys().onsuccess = e => e.target.result.forEach(k => { if(!vivos.has(k)) pg.delete(k); }); });
  novos.forEach(([p]) => p._salvo = true);
}
function digRascApagar(){ clearTimeout(DIG_RASC.t); return digRascIdb().then(db => digRascTx(db, ['meta', 'pags'], 'readwrite', t => { t.objectStore('meta').clear(); t.objectStore('pags').clear(); })).catch(() => {}); }
async function digRascInfo(){ const db = await digRascIdb();
  const meta = await digReq(db.transaction('meta').objectStore('meta').get('atual')); if(!meta || !meta.docs?.length) return null;
  const dt = new Date(meta.em), hoje = new Date().toDateString() === dt.toDateString();
  return {meta, nDocs:meta.docs.length, nPags:meta.docs.reduce((s, x) => s + x.pags.length, 0), rotulo:meta.rotulo, quando:(hoje ? 'Hoje' : fmtD(dt.toISOString().slice(0, 10))) + ', ' + dt.toTimeString().slice(0, 5)}; }
async function digRascRetomar(){
  const d = dig; if(!d || !d.rasc) return; const meta = d.rasc.meta, db = await digRascIdb(), docs = [];
  try{
    for(const x of meta.docs){ const pags = [];
      for(const q of x.pags){ const bl = await digReq(db.transaction('pags').objectStore('pags').get(q.id)); if(!bl) continue;
        const img = await digCarregar(bl); if(typeof digMarcasPreparar === 'function') await digMarcasPreparar(q.marcas);
        pags.push({...q, img, _salvo:true}); }
      if(pags.length) docs.push({...x, pags, st:'', msg:'', url:''}); }
  }catch(e){ toast('Não foi possível retomar: ' + (e.message || e)); return; }
  if(dig !== d) return; if(!docs.length){ d.rasc = null; digRascApagar(); toast('As páginas guardadas não foram encontradas'); return digRender(); }
  d.docs = docs; d.nDocs = docs.length; d.teve = true; d.di = 0; d.at = 0; d.ver = digVerPadrao(docs[0].pags[0]); d.rasc = null; digRenomear(); digRender(); digTodas().forEach(digThumb); toast('▶ Digitalização retomada');
}

/* ----- 📷 câmera dentro do app (como um scanner de bolso) -----
   📄 Foto única: tira uma e volta para conferir · 📚 Lote: a câmera fica aberta, cada foto vira uma página e “Concluir” volta.
   Topo: 🔦 lanterna · ⏱ captura automática (as duas começam DESLIGADAS a cada abertura) · 📖 livro (cada foto vira 2 páginas) · 📱 câmera do sistema.
   Faixa: filtro escolhido antes de fotografar (vira o padrão) — ou, no modo ID, o tipo do documento com o retângulo-guia (Frente → Verso).
   ↶ desfaz a última foto desta abertura. o.unica: 📷 Refazer (uma foto só, troca a página). Sem permissão/sem câmera → câmera do sistema. Nada sai do aparelho. */
let digCam = null;
function digCamSistema(){ const i = document.querySelector('#digOv #digCam'); if(i) i.click(); }
function digCamFechar(){ if(!digCam) return; clearInterval(digCam.timer); digCam.semRz?.(); try{ digCam.stream?.getTracks().forEach(t => t.stop()); }catch(e){} digCam.ov.remove(); digCam = null; if(dig && !dig.feito) digRender(); }
const digCamId = () => digDoc()?.modo === 'id';
function digCamTopo(){ const c = digCam; if(!c) return; const ov = c.ov, id = digCamId(), doc = digDoc();
  ov.querySelectorAll('[data-dccap]').forEach(b => b.classList.toggle('on', b.dataset.dccap === dig.captura));
  ov.querySelector('[data-dc="luz"]').classList.toggle('on', !!c.luz); ov.querySelector('[data-dc="auto"]').classList.toggle('on', !!c.auto); ov.querySelector('[data-dc="livro"]').classList.toggle('on', !!dig.livroAuto);
  ov.querySelector('[data-dc="auto"] small').textContent = c.auto ? 'auto: lig.' : 'auto: desl.';
  ov.querySelector('.dcChips').innerHTML = id ? Object.entries(DIG_ID).map(([k, v]) => `<button type="button" data-dcid="${k}" class="${doc.idTam === k ? 'on' : ''}">${k === 'cartao' ? '🪪 ' : ''}${v.c}</button>`).join('')
    : DIG_FILTROS.map(([k, l]) => `<button type="button" data-dcf="${k}" class="${dig.filtro === k ? 'on' : ''}">${l}</button>`).join('');
  ov.querySelector('.dcFim').textContent = c.unica ? 'Cancelar' : dig.captura === 'lote' ? `Concluir${c.adds.length ? ` (${c.adds.length})` : ''}` : 'Cancelar';
  const mini = ov.querySelector('.dcMini'), ult = c.adds[c.adds.length - 1]; mini.querySelector('b').textContent = c.adds.length || ''; mini.querySelector('span').style.backgroundImage = ult ? `url(${ult.mini})` : '';
  ov.querySelector('[data-dc="desfazer"]').disabled = !c.adds.length; digCamGuia(); }
// retângulo-guia do modo ID (na proporção do documento escolhido) e “FRENTE (1 de 2)” / “VERSO (2 de 2)”
function digCamGuia(){ const c = digCam; if(!c) return; const g = c.ov.querySelector('.dcGuia'), vis = c.ov.querySelector('.dcVis');
  if(!digCamId()){ g.hidden = true; c.guia = null; return; } const doc = digDoc(), [mw, mh] = digIdMM(doc), ar = Math.max(mw, mh) / Math.min(mw, mh);
  const bw = vis.clientWidth, bh = vis.clientHeight; let w = bw * .84, h = w / ar; if(h > bh * .6){ h = bh * .6; w = h * ar; }
  g.hidden = false; Object.assign(g.style, {width:w + 'px', height:h + 'px', left:(bw - w) / 2 + 'px', top:(bh - h) / 2 + 'px'}); c.guia = {x:(bw - w) / 2, y:(bh - h) / 2, w, h};
  const frente = doc.pags.length % 2 === 0; g.querySelector('b').textContent = frente ? 'FRENTE (1 de 2)' : 'VERSO (2 de 2)';
  c.ov.querySelector('.dcDica').textContent = frente ? 'Encaixe o documento no retângulo. Depois vire e fotografe o verso.' : 'Agora o verso, no mesmo retângulo.'; }
function digCamAbrir(o = {}){
  if(!dig) return; if(!navigator.mediaDevices?.getUserMedia) return digCamSistema();
  const ref = dig.refazer; digCamFechar(); dig.refazer = ref;
  const ov = document.createElement('div'); ov.id = 'digCamOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Câmera');
  ov.innerHTML = `<div class="dcTopo"><button type="button" class="dcX" data-dc="fechar" aria-label="Fechar a câmera">×</button><span class="dcEsp"></span>
      <button type="button" class="dcIc" data-dc="luz" title="Lanterna (liga/desliga)">🔦<small>lanterna</small></button>
      <button type="button" class="dcIc" data-dc="auto" title="Captura automática: fotografa sozinho quando o documento fica parado">⏱<small>auto: desl.</small></button>
      <button type="button" class="dcIc" data-dc="livro" title="Livro / CTPS: cada foto vira 2 páginas">📖<small>livro</small></button>
      <button type="button" class="dcIc" data-dc="sistema" title="Câmera do aparelho (resolução máxima, uma foto por vez)">📱<small>sistema</small></button></div>
    ${o.unica ? '<div class="dcAvisoTopo">📷 Refazer: a nova foto substitui a página escolhida</div>' : '<div class="dcSegL"><div class="digSeg dcSeg"><button type="button" data-dccap="unica">📄 Foto única</button><button type="button" data-dccap="lote">📚 Lote</button></div></div>'}
    <div class="dcChips"></div>
    <div class="dcVis"><video playsinline muted autoplay></video><svg class="dcSvg"><polygon></polygon></svg><div class="dcGuia" hidden><b></b></div><div class="dcFlash"></div>
      <div class="dcDica" ${digCamId() ? '' : 'hidden'}></div><div class="dcEstado" hidden></div><div class="dcMsg">Abrindo a câmera…</div></div>
    <div class="dcBase"><div class="dcEsq"><button type="button" class="dcDesf" data-dc="desfazer" title="Apagar a última foto" aria-label="Desfazer a última foto">↶</button><button type="button" class="dcMini" data-dc="ok" title="Ver as fotos"><span></span><b></b></button></div>
      <button type="button" class="dcDisp" data-dc="foto" aria-label="Fotografar"></button><button type="button" class="dcFim" data-dc="ok">Concluir</button></div>`;
  document.body.appendChild(ov); const video = ov.querySelector('video');
  const cam = digCam = {ov, video, stream:null, timer:0, adds:[], ocupado:false, luz:false, auto:false, unica:!!o.unica, est:0, ult:null, armado:true, perdido:0};
  ov.querySelector('.dcDica').hidden = !digCamId(); digCamTopo();
  ov.addEventListener('click', e => { const b = e.target.closest('[data-dc],[data-dccap],[data-dcf],[data-dcid]'); if(!b || digCam !== cam) return;
    if(b.dataset.dccap){ dig.captura = b.dataset.dccap; digGuardarCfg(); return digCamTopo(); }
    if(b.dataset.dcf){ dig.filtro = b.dataset.dcf; digGuardarCfg(); return digCamTopo(); }
    if(b.dataset.dcid){ digDoc().idTam = b.dataset.dcid; digGuardarCfg(); return digCamTopo(); }
    const a = b.dataset.dc;
    if(a === 'foto') return digCamFoto();
    if(a === 'luz') return digCamLuz();
    if(a === 'auto'){ cam.auto = !cam.auto; cam.est = 0; cam.armado = true; digCamTopo(); return toast(cam.auto ? '⏱ Captura automática ligada: segure o celular parado sobre o documento' : 'Captura automática desligada'); }
    if(a === 'livro'){ dig.livroAuto = !dig.livroAuto; digCamTopo(); return toast(dig.livroAuto ? '📖 Livro: cada foto vira 2 páginas' : 'Livro desligado'); }
    if(a === 'desfazer') return digCamDesfazer();
    if(a === 'sistema'){ digCamFechar(); return digCamSistema(); }
    if(cam.unica) dig.refazer = null; digCamFechar(); });
  const rz = () => digCamGuia(); window.addEventListener('resize', rz); cam.semRz = () => window.removeEventListener('resize', rz);
  navigator.mediaDevices.getUserMedia({audio:false, video:{facingMode:{ideal:'environment'}, width:{ideal:3840}, height:{ideal:2160}}}).then(st => {
    if(digCam !== cam){ st.getTracks().forEach(t => t.stop()); return; }
    cam.stream = st; video.srcObject = st; video.play().catch(() => {}); ov.querySelector('.dcMsg').hidden = true;
    const pq = document.createElement('canvas');
    cam.timer = setInterval(() => { if(digCam !== cam || cam.ocupado || !video.videoWidth) return; // borda ao vivo (rápida, sem a 2ª etapa) + captura automática
      const vw = video.videoWidth, vh = video.videoHeight, k = Math.min(1, 320 / Math.max(vw, vh)); pq.width = Math.round(vw * k); pq.height = Math.round(vh * k);
      pq.getContext('2d').drawImage(video, 0, 0, pq.width, pq.height); const r = digDetectar(pq, {rapido:true}), box = video.getBoundingClientRect(), svg = ov.querySelector('.dcSvg');
      const s = Math.min(box.width / vw, box.height / vh), dx = (box.width - vw * s) / 2, dy = (box.height - vh * s) / 2;
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`); svg.querySelector('polygon').setAttribute('points', r.ok ? r.quad.map(([a, b]) => `${dx + a / k * s},${dy + b / k * s}`).join(' ') : '');
      digCamAutoPasso(cam, r, pq.width, pq.height); }, 350);
  }).catch(e => { if(digCam !== cam) return; const m = ov.querySelector('.dcMsg'); m.innerHTML = `Não foi possível abrir a câmera aqui${/NotAllowed|Permission/i.test(e && e.name || '') ? ' (permissão negada)' : ''}.<br><button type="button" class="btn primary" data-dc="sistema">📷 Usar a câmera do aparelho</button>`; });
}
/* ⏱ captura automática: com o documento achado e parado por ~1 s (3 leituras seguidas mexendo menos de 2,5%), fotografa sozinho.
   Depois só fotografa de novo quando o documento sai/troca (some da tela ou mexe bastante) — assim não repete a mesma folha. */
function digCamAutoPasso(cam, r, w, h){
  const el = cam.ov.querySelector('.dcEstado'), diag = Math.hypot(w, h);
  if(!r.ok){ cam.est = 0; cam.ult = null; if(++cam.perdido >= 2) cam.armado = true; el.hidden = true; return; }
  cam.perdido = 0; const mov = cam.ult ? Math.max(...r.quad.map((c, i) => digDist(c, cam.ult[i]))) / diag : 1; cam.ult = r.quad;
  if(mov > .08) cam.armado = true;
  cam.est = mov < .025 ? cam.est + 1 : 0;
  if(!cam.auto){ el.hidden = true; return; }
  el.hidden = false; el.textContent = !cam.armado ? '✔ Fotografado — troque a folha' : cam.est >= 1 ? '✔ Documento encontrado — segure firme…' : 'Documento encontrado';
  if(cam.armado && cam.est >= 3){ cam.armado = false; cam.est = 0; digCamFoto(); }
}
async function digCamLuz(){ const c = digCam, t = c?.stream?.getVideoTracks()[0]; if(!t) return toast('Espere a câmera abrir');
  const cap = t.getCapabilities ? t.getCapabilities() : {}; if(!cap.torch) return toast('🔦 Lanterna não disponível neste aparelho/navegador');
  try{ await t.applyConstraints({advanced:[{torch:!c.luz}]}); c.luz = !c.luz; digCamTopo(); }catch(e){ toast('Não foi possível ligar a lanterna'); } }
function digCamDesfazer(){ const c = digCam, u = c && c.adds.pop(); if(!u) return;
  u.pags.forEach(p => { const doc = dig.docs.find(x => x.pags.includes(p)); if(doc) doc.pags.splice(doc.pags.indexOf(p), 1); });
  const doc = digDoc(); dig.at = Math.max(0, doc.pags.length - 1); digRender(); digCamTopo(); toast('↶ Última foto apagada'); }
async function digCamFoto(){
  const cam = digCam, v = cam && cam.video; if(!v || !v.videoWidth || cam.ocupado) return; cam.ocupado = true;
  const fl = cam.ov.querySelector('.dcFlash'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
  let cv = null; // Android (Chrome): foto em resolução cheia; senão (iPhone), o quadro do vídeo
  try{ if(window.ImageCapture && cam.stream && !cam.luz){ const bl = await new ImageCapture(cam.stream.getVideoTracks()[0]).takePhoto(); cv = await digCarregar(bl); } }catch(e){ cv = null; }
  if(!cv){ const s = Math.min(1, DIG_MAX / Math.max(v.videoWidth, v.videoHeight)); cv = document.createElement('canvas'); cv.width = Math.round(v.videoWidth * s); cv.height = Math.round(v.videoHeight * s);
    cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height); }
  // modo ID: o retângulo-guia (tela → vídeo → foto) é o recorte de reserva, se as bordas do cartão não forem achadas
  let quadPadrao = null; if(cam.guia){ const box = v.getBoundingClientRect(), vis = cam.ov.querySelector('.dcVis').getBoundingClientRect(), s = Math.min(box.width / v.videoWidth, box.height / v.videoHeight);
    const dx = box.left - vis.left + (box.width - v.videoWidth * s) / 2, dy = box.top - vis.top + (box.height - v.videoHeight * s) / 2, f = cv.width / v.videoWidth, g = cam.guia;
    const P = (x, y) => [Math.max(0, Math.min(cv.width, (x - dx) / s * f)), Math.max(0, Math.min(cv.height, (y - dy) / s * f))];
    quadPadrao = [P(g.x, g.y), P(g.x + g.w, g.y), P(g.x + g.w, g.y + g.h), P(g.x, g.y + g.h)]; }
  setTimeout(() => { if(!dig){ cam.ocupado = false; return; } const pags = digAddCanvas(cv, {quadPadrao}); cam.ocupado = false;
    if(digCam !== cam) return; if(cam.unica || dig.captura !== 'lote') return digCamFechar();
    const c = document.createElement('canvas'), k = 90 / Math.max(cv.width, cv.height); c.width = cv.width * k; c.height = cv.height * k; c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height);
    cam.adds.push({pags, mini:c.toDataURL('image/jpeg', .6)}); digCamTopo(); }, 30);
}

/* ----- recorte automático: bordas da folha (sem IA) ----- */
const digInteira = cv => [[0, 0], [cv.width, 0], [cv.width, cv.height], [0, cv.height]];
const digMargem = cv => { const mx = cv.width * .04, my = cv.height * .04; return [[mx, my], [cv.width - mx, my], [cv.width - mx, cv.height - my], [mx, cv.height - my]]; };
function digBlur(g, w, h, r){ // média móvel separável (horizontal + vertical)
  const t = new Float32Array(g.length), o = new Float32Array(g.length);
  for(let y = 0; y < h; y++){ let s = 0, n = 0; const b = y * w;
    for(let x = -r; x < w; x++){ if(x + r < w){ s += g[b + x + r]; n++; } if(x - r - 1 >= 0){ s -= g[b + x - r - 1]; n--; } if(x >= 0) t[b + x] = s / n; } }
  for(let x = 0; x < w; x++){ let s = 0, n = 0;
    for(let y = -r; y < h; y++){ if(y + r < h){ s += t[(y + r) * w + x]; n++; } if(y - r - 1 >= 0){ s -= t[(y - r - 1) * w + x]; n--; } if(y >= 0) o[y * w + x] = s / n; } }
  return o; }
function digOtsu(g){ const hi = new Float64Array(256); for(const v of g) hi[Math.max(0, Math.min(255, v | 0))]++;
  const n = g.length; let soma = 0; for(let i = 0; i < 256; i++) soma += i * hi[i];
  let sB = 0, wB = 0, best = 0, t = 127; for(let i = 0; i < 256; i++){ wB += hi[i]; if(!wB) continue; const wF = n - wB; if(!wF) break; sB += i * hi[i];
    const mB = sB / wB, mF = (soma - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if(v > best){ best = v; t = i; } }
  return t; }
function digComp(m, w, h){ // maior região conectada: área, quanto toca a borda e os extremos de cada linha
  const n = w * h, lab = new Int32Array(n), fila = new Int32Array(n); let nl = 0, best = null;
  for(let i = 0; i < n; i++){ if(!m[i] || lab[i]) continue; nl++; let ini = 0, fim = 0, area = 0, borda = 0; fila[fim++] = i; lab[i] = nl;
    while(ini < fim){ const k = fila[ini++], x = k % w, y = (k - x) / w; area++; if(!x || !y || x === w - 1 || y === h - 1) borda++;
      if(x > 0 && m[k - 1] && !lab[k - 1]){ lab[k - 1] = nl; fila[fim++] = k - 1; }
      if(x < w - 1 && m[k + 1] && !lab[k + 1]){ lab[k + 1] = nl; fila[fim++] = k + 1; }
      if(y > 0 && m[k - w] && !lab[k - w]){ lab[k - w] = nl; fila[fim++] = k - w; }
      if(y < h - 1 && m[k + w] && !lab[k + w]){ lab[k + w] = nl; fila[fim++] = k + w; } }
    if(!best || area > best.area) best = {l:nl, area, borda}; }
  if(!best) return null;
  const pts = []; for(let y = 0; y < h; y++){ let a = -1, b = -1; for(let x = 0; x < w; x++) if(lab[y * w + x] === best.l){ if(a < 0) a = x; b = x; } if(a >= 0){ pts.push([a, y]); if(b !== a) pts.push([b + 1, y]); } }
  return {area:best.area, borda:best.borda / (2 * (w + h)), pts}; }
function digHull(pts){ const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if(p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for(const q of p){ while(lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for(let i = p.length - 1; i >= 0; i--){ const q = p[i]; while(up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1)); }
const digTri = (a, b, c) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
const digArea = q => digTri(q[0], q[1], q[2]) + digTri(q[0], q[2], q[3]);
function digQuad(hull){ // quadrilátero de maior área com vértices no contorno
  let h = hull; if(h.length > 60){ const st = h.length / 60; h = Array.from({length:60}, (_, i) => hull[Math.floor(i * st)]); }
  const n = h.length; if(n < 4) return null; let best = null, ba = 0;
  for(let i = 0; i < n; i++) for(let j = i + 2; j < n; j++){ if(j - i > n - 2) continue;
    let a1 = 0, k1 = -1, a2 = 0, k2 = -1;
    for(let k = i + 1; k < j; k++){ const a = digTri(h[i], h[k], h[j]); if(a > a1){ a1 = a; k1 = k; } }
    for(let k = j + 1; k < i + n; k++){ const a = digTri(h[i], h[k % n], h[j]); if(a > a2){ a2 = a; k2 = k % n; } }
    if(k1 >= 0 && k2 >= 0 && a1 + a2 > ba){ ba = a1 + a2; best = [h[i], h[k1], h[j], h[k2]]; } }
  return best; }
function digOrdenar(q){ // superior esquerdo, superior direito, inferior direito, inferior esquerdo
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  const o = [...q].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  let k = 0; o.forEach((p, i) => { if(p[0] + p[1] < o[k][0] + o[k][1]) k = i; });
  return o.slice(k).concat(o.slice(0, k)); }
// imagem reduzida em dois tons: L = claridade; P = “papel” (claro e pouco colorido — separa a folha branca da mesa de madeira e dos reflexos)
function digTons(cv, max){
  const W = cv.width, H = cv.height, s = Math.min(1, max / Math.max(W, H)), w = Math.max(8, Math.round(W * s)), h = Math.max(8, Math.round(H * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', {willReadFrequently:true}); x.drawImage(cv, 0, 0, w, h);
  const px = x.getImageData(0, 0, w, h).data, n = w * h, L = new Float32Array(n), P = new Float32Array(n);
  for(let i = 0; i < n; i++){ const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2]; L[i] = .299 * r + .587 * g + .114 * b; P[i] = L[i] - .7 * (Math.max(r, g, b) - Math.min(r, g, b)); }
  return {w, h, s, L, P};
}
// o.rapido: só a 1ª etapa (usado na pré-visualização da câmera, várias vezes por segundo)
function digDetectar(cv, o = {}){
  const W = cv.width, H = cv.height, T = digTons(cv, 360), {w, h, s} = T, n = w * h, m = new Uint8Array(n); let melhor = null;
  for(const met of ['P', 'L']){ const g = digBlur(digBlur(T[met], w, h, 2), w, h, 2), t = digOtsu(g);
    for(const claro of [true, false]){ // papel claro sobre fundo escuro, ou documento escuro sobre fundo claro
      for(let i = 0; i < n; i++) m[i] = (g[i] > t) === claro ? 1 : 0;
      const r = digComp(m, w, h); if(!r) continue; const a = r.area / n; if(a < .08 || a > .985) continue;
      const sc = a * Math.pow(1 - Math.min(1, r.borda), 2) * (claro ? 1.05 : 1) * (met === 'P' ? 1.02 : 1); if(!melhor || sc > melhor.sc) melhor = {...r, sc, claro, met}; } }
  const falha = {ok:false, quad:digMargem(cv)};
  if(!melhor || melhor.sc < .03) return falha;
  const q = digQuad(digHull(melhor.pts)); if(!q) return falha;
  const aq = digArea(q); if(aq / n < .08 || melhor.area / aq < .6) return falha;
  let quad = digOrdenar(q).map(([a, b]) => [a / s, b / s]);
  if(!o.rapido){ quad = digRefinar(cv, quad, melhor.claro, melhor.met, .08); quad = digRefinar(cv, quad, melhor.claro, melhor.met, .025); }
  return {ok:true, quad:quad.map(([a, b]) => [Math.max(0, Math.min(W, a)), Math.max(0, Math.min(H, b))])};
}
/* 2ª etapa: cada lado do recorte vira uma RETA ajustada às bordas de verdade (procura a borda papel → mesa ao longo do lado, descarta
   pontos fora da reta) e os cantos saem do cruzamento das retas — assim um canto escondido por sombra, reflexo ou pelo dedo ainda fica certo. */
function digRefinar(cv, quad, claro, met, faixa){
  const T = digTons(cv, 1000), {w, h, s} = T, v = digBlur(T[met], w, h, 1), sg = claro ? 1 : -1, q = quad.map(([a, b]) => [a * s, b * s]);
  const band = Math.max(5, Math.hypot(w, h) * faixa), val = (x, y) => { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= w || y >= h ? NaN : v[y * w + x]; };
  const media = (x, y, nx, ny, de, ate) => { let t = 0, k = 0; for(let j = de; j <= ate; j++){ const z = val(x + nx * j, y + ny * j); if(z === z){ t += z; k++; } } return k ? t / k : NaN; };
  const retas = [];
  for(let i = 0; i < 4; i++){ const a = q[i], b = q[(i + 1) % 4], len = digDist(a, b); if(len < 12){ retas.push(null); continue; }
    const dx = (b[0] - a[0]) / len, dy = (b[1] - a[1]) / len, nx = -dy, ny = dx, pts = []; // (nx, ny) aponta para dentro do documento
    for(let k = 0; k <= 60; k++){ const t = .04 + .92 * k / 60, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t; let best = 0, bs = null;
      for(let d = -band; d <= band; d += 1){ const x = px + nx * d, y = py + ny * d, dif = (media(x, y, nx, ny, 2, 7) - media(x, y, nx, ny, -7, -2)) * sg;
        if(dif > best){ best = dif; bs = [x, y]; } }
      if(bs && best > 14) pts.push(bs); }
    retas.push(digReta(pts)); }
  const lin = i => retas[i] || (() => { const a = q[i], b = q[(i + 1) % 4], L = digDist(a, b) || 1; return {p:a, d:[(b[0] - a[0]) / L, (b[1] - a[1]) / L]}; })();
  const novo = [];
  for(let i = 0; i < 4; i++){ const A = lin((i + 3) % 4), B = lin(i), den = A.d[0] * B.d[1] - A.d[1] * B.d[0]; if(Math.abs(den) < .2) return quad; // retas quase paralelas
    const t = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / den; novo.push([A.p[0] + A.d[0] * t, A.p[1] + A.d[1] * t]); }
  const diag = Math.hypot(w, h), ok = novo.every((c, i) => c[0] > -w * .03 && c[1] > -h * .03 && c[0] < w * 1.03 && c[1] < h * 1.03 && digDist(c, q[i]) < diag * .2);
  const cr = i => { const a = novo[i], b = novo[(i + 1) % 4], c = novo[(i + 2) % 4]; return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); };
  if(!ok || ![0, 1, 2, 3].every(i => cr(i) > 0) || digArea(novo) < w * h * .06) return quad;
  return novo.map(([a, b]) => [a / s, b / s]);
}
function digReta(pts){ // reta que passa pela maioria dos pontos (RANSAC + mínimos quadrados) — ignora texto, sombras e o dedo
  if(pts.length < 8) return null; let best = null, sd = 7; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  for(let it = 0; it < 90; it++){ const a = pts[(rnd() * pts.length) | 0], b = pts[(rnd() * pts.length) | 0], L = digDist(a, b); if(L < 6) continue;
    const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, c = -(nx * a[0] + ny * a[1]), inl = pts.filter(p => Math.abs(nx * p[0] + ny * p[1] + c) < 2.2);
    if(!best || inl.length > best.length) best = inl; }
  if(!best || best.length < Math.max(8, pts.length * .3)) return null;
  const mx = best.reduce((t, p) => t + p[0], 0) / best.length, my = best.reduce((t, p) => t + p[1], 0) / best.length; let xx = 0, xy = 0, yy = 0;
  best.forEach(([x, y]) => { xx += (x - mx) ** 2; xy += (x - mx) * (y - my); yy += (y - my) ** 2; });
  const an = .5 * Math.atan2(2 * xy, xx - yy); return {p:[mx, my], d:[Math.cos(an), Math.sin(an)]};
}

/* ----- endireitar (perspectiva) + filtros ----- */
const digDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function digHomog(q, W, H){ // retângulo de saída (W×H) → cantos na foto
  const d = [[0, 0], [W, 0], [W, H], [0, H]], A = [], b = [];
  for(let i = 0; i < 4; i++){ const [u, v] = d[i], [x, y] = q[i]; A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x); A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y); }
  for(let c = 0; c < 8; c++){ let p = c; for(let r = c + 1; r < 8; r++) if(Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]]; const v = A[c][c]; if(Math.abs(v) < 1e-12) return null;
    for(let r = 0; r < 8; r++){ if(r === c) continue; const f = A[r][c] / v; if(!f) continue; for(let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; } }
  return b.map((x, i) => x / A[i][i]); }
/* página pronta: endireita (perspectiva), aplica o filtro, gira e “queima” as marcas (tarjas, textos, assinaturas — digitalizar-marcar.js).
   o.filtro: outro filtro (miniaturas) · o.semMarcas: sem as marcas (tela de marcar, livro). Guarda algumas versões prontas (p._cc) — a grande só uma. */
function digProcessar(p, max, o = {}){
  const filtro = o.filtro || p.filtro, marcas = !o.semMarcas && p.marcas && p.marcas.length ? p.marcas : null;
  const chave = p.quad.map(c => c.map(v => v.toFixed(1)).join(',')).join(';') + '|' + filtro + '|' + p.rot + '|' + max + '|' + (marcas ? JSON.stringify(marcas.map(m => ({...m, src:m.src ? m.src.length + m.src.slice(-24) : ''}))) : '');
  const cc = p._cc || (p._cc = new Map()); if(cc.has(chave)) return cc.get(chave);
  const q = p.quad; let W = Math.max(digDist(q[0], q[1]), digDist(q[3], q[2])), H = Math.max(digDist(q[0], q[3]), digDist(q[1], q[2]));
  const s = Math.min(1, max / Math.max(W, H, 1)); W = Math.max(1, Math.round(W * s)); H = Math.max(1, Math.round(H * s));
  const iw = p.img.width, ih = p.img.height, src = p._src || (p._src = p.img.getContext('2d').getImageData(0, 0, iw, ih).data);
  const hm = digHomog(q, W, H) || [iw / W, 0, 0, 0, ih / H, 0, 0, 0], out = new ImageData(W, H), od = out.data;
  const [a, b, c, d, e, f, g, h] = hm;
  for(let v = 0; v < H; v++){ const vy = v + .5;
    for(let u = 0; u < W; u++){ const ux = u + .5, den = g * ux + h * vy + 1;
      let x = (a * ux + b * vy + c) / den - .5, y = (d * ux + e * vy + f) / den - .5;
      x = x < 0 ? 0 : x > iw - 1.001 ? iw - 1.001 : x; y = y < 0 ? 0 : y > ih - 1.001 ? ih - 1.001 : y;
      const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i0 = (y0 * iw + x0) * 4, i1 = i0 + iw * 4, k = (v * W + u) * 4;
      for(let ch = 0; ch < 3; ch++){ const t0 = src[i0 + ch] + (src[i0 + 4 + ch] - src[i0 + ch]) * fx, t1 = src[i1 + ch] + (src[i1 + 4 + ch] - src[i1 + ch]) * fx; od[k + ch] = t0 + (t1 - t0) * fy; }
      od[k + 3] = 255; } }
  digFiltrar(out, filtro);
  let cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').putImageData(out, 0, 0);
  if(p.rot){ const r = document.createElement('canvas'), x = r.getContext('2d'); r.width = p.rot % 2 ? H : W; r.height = p.rot % 2 ? W : H;
    x.translate(r.width / 2, r.height / 2); x.rotate(p.rot * Math.PI / 2); x.drawImage(cv, -W / 2, -H / 2); cv = r; }
  if(marcas && typeof digMarcasDesenhar === 'function') digMarcasDesenhar(cv.getContext('2d'), cv.width, cv.height, marcas);
  if(max > 400) for(const [k, v] of cc) if(v.width * v.height > 400 * 400) cc.delete(k); // memória: só uma versão grande por página
  cc.set(chave, cv); if(cc.size > 10) cc.delete(cc.keys().next().value);
  if(dig && p !== digPag()) delete p._src; // a foto inteira em pixels só fica na memória para a página aberta
  return cv;
}
/* filtros — todos começam tirando a sombra/iluminação irregular (o fundo da folha vira branco):
   realcado (cores vivas, contraste) · semsombra (cores naturais) · eco (economia de tinta: fundo branco puro e texto cinza-escuro)
   · cinza · pb (preto e branco). original: sem nada. */
function digFiltrar(im, f){
  if(f === 'original') return;
  const {width:w, height:h, data:d} = im, B = Math.max(8, Math.round(Math.max(w, h) / 32)), gw = Math.ceil(w / B), gh = Math.ceil(h / B);
  // fundo (iluminação da folha): o ponto mais claro de cada bloco, alargado e suavizado — tira sombra e luz irregular
  let g = new Float32Array(gw * gh);
  for(let y = 0; y < h; y += 2) for(let x = 0; x < w; x += 2){ const i = (y * w + x) * 4, l = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2], k = ((y / B) | 0) * gw + ((x / B) | 0); if(l > g[k]) g[k] = l; }
  const viz = (fn) => { const o = new Float32Array(gw * gh); for(let y = 0; y < gh; y++) for(let x = 0; x < gw; x++){ const l = [];
    for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ const yy = y + dy, xx = x + dx; if(yy >= 0 && yy < gh && xx >= 0 && xx < gw) l.push(g[yy * gw + xx]); } o[y * gw + x] = fn(l); } return o; };
  g = viz(l => Math.max(...l)); g = viz(l => l.reduce((s, v) => s + v, 0) / l.length);
  const cap = f === 'realcado' ? 1.5 : f === 'semsombra' ? 1.7 : f === 'cinza' ? 1.8 : 2.5;
  for(let y = 0; y < h; y++){ const gy = Math.max(0, Math.min(gh - 1, (y + .5) / B - .5)), y0 = gy | 0, y1 = Math.min(gh - 1, y0 + 1), fy = gy - y0;
    for(let x = 0; x < w; x++){ const gx = Math.max(0, Math.min(gw - 1, (x + .5) / B - .5)), x0 = gx | 0, x1 = Math.min(gw - 1, x0 + 1), fx = gx - x0;
      const t0 = g[y0 * gw + x0] + (g[y0 * gw + x1] - g[y0 * gw + x0]) * fx, t1 = g[y1 * gw + x0] + (g[y1 * gw + x1] - g[y1 * gw + x0]) * fx, fundo = t0 + (t1 - t0) * fy;
      const ganho = Math.min(cap, 255 / Math.max(fundo, 1)), i = (y * w + x) * 4;
      let r = d[i] * ganho, gg = d[i + 1] * ganho, b = d[i + 2] * ganho; const l = .299 * r + .587 * gg + .114 * b;
      if(f === 'realcado'){ r = (l + (r - l) * 1.25 - 128) * 1.12 + 128; gg = (l + (gg - l) * 1.25 - 128) * 1.12 + 128; b = (l + (b - l) * 1.25 - 128) * 1.12 + 128; }
      else if(f === 'semsombra'){ const k2 = l > 225 ? Math.min(1, (l - 225) / 20) : 0; r += (255 - r) * k2; gg += (255 - gg) * k2; b += (255 - b) * k2; }
      else if(f === 'eco'){ const v = 255 / (1 + Math.exp(-(l - 175) / 13)); r = gg = b = 95 + v * (160 / 255); if(l > 200) r = gg = b = 255; }
      else if(f === 'cinza') r = gg = b = (l - 128) * 1.2 + 140;
      else r = gg = b = 255 / (1 + Math.exp(-(l - 185) / 11));
      d[i] = r; d[i + 1] = gg; d[i + 2] = b; } }
}

/* ----- PDF (montado aqui, com as fotos em JPEG) ----- */
function digJpeg(cv, q = .8){
  const u = cv.toDataURL('image/jpeg', q), s = atob(u.split(',')[1]), bytes = new Uint8Array(s.length);
  for(let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  let comp = 3; for(let i = 2; i < bytes.length - 9;){ if(bytes[i] !== 0xFF){ i++; continue; } const mk = bytes[i + 1];
    if(mk >= 0xC0 && mk <= 0xC2){ comp = bytes[i + 9]; break; } i += 2 + (bytes[i + 2] << 8 | bytes[i + 3]); }
  return {bytes, pw:cv.width, ph:cv.height, cor:comp === 1 ? '/DeviceGray' : '/DeviceRGB'}; }
// paginas: [{w, h (pt), imgs:[{bytes, pw, ph, cor, x, y (do topo), w, h (pt)}], rets:[{x, y, w, h}] (molduras finas, opcional)}]
function digPdf(paginas){
  const enc = new TextEncoder(), partes = [], offs = []; let pos = 0;
  const put = x => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); pos += b.length; };
  let n = 3; const plano = paginas.map(pg => ({page:n++, cont:n++, imgs:pg.imgs.map(() => n++)}));
  const obj = (id, corpo) => { offs[id] = pos; put(`${id} 0 obj\n`); corpo(); put('\nendobj\n'); }, f = v => v.toFixed(2);
  put('%PDF-1.4\n%âãÏÓ\n');
  obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => put(`<< /Type /Pages /Kids [${plano.map(o => o.page + ' 0 R').join(' ')}] /Count ${plano.length} >>`));
  paginas.forEach((pg, i) => { const o = plano[i];
    const cont = pg.imgs.map((im, k) => `q ${f(im.w)} 0 0 ${f(im.h)} ${f(im.x)} ${f(pg.h - im.y - im.h)} cm /Im${k} Do Q`)
      .concat((pg.rets || []).map(r => `q 0.55 G 0.8 w ${f(r.x)} ${f(pg.h - r.y - r.h)} ${f(r.w)} ${f(r.h)} re S Q`)).join('\n');
    obj(o.page, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(pg.w)} ${f(pg.h)}] /Resources << /XObject << ${pg.imgs.map((im, k) => `/Im${k} ${o.imgs[k]} 0 R`).join(' ')} >> >> /Contents ${o.cont} 0 R >>`));
    obj(o.cont, () => { put(`<< /Length ${enc.encode(cont).length} >>\nstream\n`); put(cont); put('\nendstream'); });
    pg.imgs.forEach((im, k) => obj(o.imgs[k], () => { put(`<< /Type /XObject /Subtype /Image /Width ${im.pw} /Height ${im.ph} /ColorSpace ${im.cor} /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`); put(im.bytes); put('\nendstream'); }));
  });
  const xref = pos; put(`xref\n0 ${n}\n0000000000 65535 f \n`); for(let i = 1; i < n; i++) put(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
  put(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(partes, {type:'application/pdf'});
}
function digIdMM(doc){ const t = DIG_ID[doc.idTam]; return t && t.w ? [t.w, t.h] : [Math.min(190, (doc.idW || 8.6) * 10), Math.min(277, (doc.idH || 5.4) * 10)]; }
// reduz para a resolução (dpi) do tamanho em que a imagem vai sair no papel e põe a marca d’água do documento
function digNoPapel(cv0, wPt, hPt, dpi, doc){
  const tw = Math.max(1, Math.round(wPt / 72 * dpi)), th = Math.max(1, Math.round(hPt / 72 * dpi)); let cv = cv0;
  if(tw < cv0.width || doc.marcaOn){ cv = document.createElement('canvas'); cv.width = Math.min(tw, cv0.width); cv.height = Math.min(th, cv0.height);
    const x = cv.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cv0, 0, 0, cv.width, cv.height); if(doc.marcaOn) digMarcaDagua(x, cv.width, cv.height, doc.marca); }
  return cv; }
async function digGerar(doc = digDoc()){
  const paginas = [], A4 = DIG_A4, mm = 72 / 25.4, pausa = () => new Promise(r => setTimeout(r, 0)), Q = DIG_QUAL[dig?.qual] || DIG_QUAL.normal;
  const jpg = (cv, p) => digJpeg(cv, p.filtro === 'pb' || p.filtro === 'cinza' || p.filtro === 'eco' ? Q.q - .04 : Q.q);
  if(doc.modo === 'id'){ // tamanho real (ou ampliado: doc.idEsc), um embaixo do outro, numa folha A4 (como cópia de scanner)
    const esc = Math.max(1, Math.min(3, +doc.idEsc || 1)), [mw, mh] = digIdMM(doc).map(v => v * esc), M = (esc > 1 ? 15 : 20) * mm, GAP = (esc > 1 ? 10 : 12) * mm; let pg = null, y = 0;
    for(const p of doc.pags){ await pausa();
      const cv0 = digProcessar(p, Q.max), deitado = cv0.width >= cv0.height, ar = cv0.width / cv0.height;
      const bw = (deitado ? Math.max(mw, mh) : Math.min(mw, mh)) * mm, bh = (deitado ? Math.min(mw, mh) : Math.max(mw, mh)) * mm;
      // proporção perto da do documento → tamanho exato (a perspectiva da foto deixa a proporção um pouco torta); senão, cabe na medida sem deformar
      let w = bw, h = bh; if(Math.abs(ar / (bw / bh) - 1) > .15){ h = bw / ar; if(h > bh){ h = bh; w = bh * ar; } }
      const mxW = A4[0] - 2 * M, mxH = A4[1] - 2 * M; if(w > mxW){ h *= mxW / w; w = mxW; } if(h > mxH){ w *= mxH / h; h = mxH; }
      if(!pg || y + h > A4[1] - M){ pg = {w:A4[0], h:A4[1], imgs:[]}; paginas.push(pg); y = M; }
      pg.imgs.push({...jpg(digNoPapel(cv0, w, h, Q.dpi, doc), p), x:(A4[0] - w) / 2, y, w, h}); y += h + GAP; }
  } else if(doc.modo === 'colagem'){ // 2, 4 ou 6 fotos por folha A4, na ordem, cada uma inteira no seu quadro
    const [nc, nr] = DIG_COL[doc.colN] || DIG_COL[4], porFolha = nc * nr, M = 12 * mm, G = 6 * mm, cw = (A4[0] - 2 * M - (nc - 1) * G) / nc, chh = (A4[1] - 2 * M - (nr - 1) * G) / nr; let pg = null;
    for(let i = 0; i < doc.pags.length; i++){ await pausa(); const p = doc.pags[i], k = i % porFolha, col = k % nc, lin = (k / nc) | 0;
      if(!k){ pg = {w:A4[0], h:A4[1], imgs:[], rets:[]}; paginas.push(pg); }
      const cv0 = digProcessar(p, Q.max), s = Math.min(cw / cv0.width, chh / cv0.height), w = cv0.width * s, h = cv0.height * s;
      const x = M + col * (cw + G) + (cw - w) / 2, y = M + lin * (chh + G) + (chh - h) / 2;
      pg.imgs.push({...jpg(digNoPapel(cv0, w, h, Q.dpi, doc), p), x, y, w, h}); if(doc.colMold) pg.rets.push({x, y, w, h}); }
  } else {
    for(const p of doc.pags){ await pausa();
      const cv0 = digProcessar(p, Q.max), [PW, PH] = cv0.height >= cv0.width ? A4 : [A4[1], A4[0]], s = Math.min(PW / cv0.width, PH / cv0.height), w = cv0.width * s, h = cv0.height * s;
      paginas.push({w:PW, h:PH, imgs:[{...jpg(digNoPapel(cv0, w, h, Math.max(Q.dpi, 1e9), doc), p), x:(PW - w) / 2, y:(PH - h) / 2, w, h}]}); }
  }
  return digPdf(paginas);
}
const digNomeArq = doc => (String(doc.nome || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\.pdf$/i, '').trim() || digNomePadrao()) + '.pdf';
function digBaixar(blob, nome){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
// envia os documentos marcados que ainda não foram (mesmo destino para todos); se um falhar, os outros seguem e ele fica na lista para tentar de novo
async function digConcluir(){
  if(!dig || dig.ocupado) return; const d = dig, ov = document.getElementById('digOv'), st = ov.querySelector('#digSt'), bt = ov.querySelector('.digOk');
  const lista = digPendentes().filter(x => x.sel); if(!lista.length) return;
  d.ocupado = true; bt.disabled = true; let pasta = null;
  const gerar = async x => { st.textContent = `Gerando ${digNomeArq(x)}…`; const blob = await digGerar(x); return {blob, file:new File([blob], digNomeArq(x), {type:'application/pdf'})}; };
  try{
    if(d.destino === 'anexar'){ const fs = []; for(const x of lista) fs.push((await gerar(x)).file); lista.forEach(digConfirmarSeq); const fn = d.anexar; digFechar(true); fn(fs); return; }
    if(d.destino === 'compartilhar'){ const fs = []; for(const x of lista) fs.push((await gerar(x)).file);
      await navigator.share({files:fs}); lista.forEach(x => { x.st = 'ok'; x.msg = 'compartilhado'; digConfirmarSeq(x); }); } // só os arquivos: no iPhone, um título junto vira um .txt a mais no Drive
    else for(const x of lista){
      try{ const {blob, file} = await gerar(x);
        if(d.destino === 'drive'){
          if(file.size > 20e6) throw new Error('passou de 20 MB — baixe e envie direto pelo Drive');
          if(!pasta){ st.textContent = 'Localizando a pasta no Drive…'; pasta = (await roboChamar(null, {arqPasta:d.alvo})).pasta; }
          st.textContent = `Enviando ${file.name}…`; const e = await roboChamar(null, {arqEnviar:{pastaId:pasta.id, nome:file.name, tipo:'application/pdf', base64:await lerBase64(file)}});
          x.st = 'ok'; x.msg = `enviado (${Math.max(1, Math.round(file.size / 1024))} KB)`; x.url = e.arquivo?.url || ''; digConfirmarSeq(x);
        } else { digBaixar(blob, file.name); x.st = 'ok'; digConfirmarSeq(x); x.msg = `baixado (${Math.max(1, Math.round(file.size / 1024))} KB)`; await new Promise(r => setTimeout(r, 400)); }
      }catch(e){ x.st = 'erro'; x.msg = e.message || String(e); }
    }
    digRenomear(); const ok = d.docs.filter(x => x.st === 'ok'), erro = d.docs.filter(x => x.st === 'erro');
    if(!erro.length && !digPendentes().length){
      const onde = d.destino === 'drive' ? ` para ${pasta?.caminho || 'a pasta'}` : '';
      d.feito = {txt:ok.length === 1 ? `${digNomeArq(ok[0])} ${d.destino === 'drive' ? 'enviado' + onde : ok[0].msg.replace(/ \(.*/, '')}` : `${ok.length} documentos ${d.destino === 'drive' ? 'enviados' + onde : d.destino === 'baixar' ? 'baixados' : 'compartilhados'}`,
        links:`<div class="digFeito">${ok.map(x => `<div>📄 ${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(digNomeArq(x))} ↗</a>` : esc(digNomeArq(x))}</div>`).join('')}</div>${pasta ? `<p><a href="${esc(pasta.url)}" target="_blank" rel="noopener">abrir a pasta ↗</a></p>` : ''}`};
    }
    d.ocupado = false; digRender();
    if(erro.length){ const s = document.querySelector('#digSt'); if(s) s.innerHTML = `<span style="color:var(--bad)">⚠️ ${erro.length} documento(s) não foram enviados — veja o motivo na lista e toque de novo para tentar.</span>${ok.length ? ` ✔ ${ok.length} já enviado(s).` : ''}`; }
  }catch(e){ if(e && e.name === 'AbortError') st.textContent = ''; else st.innerHTML = `<span style="color:var(--bad)">⚠️ ${esc(e.message || String(e))}</span>`; }
  finally{ if(dig === d){ d.ocupado = false; if(bt.isConnected) bt.disabled = false; } }
}
