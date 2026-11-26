# 📷 Digitalizar — plano combinado com o usuário (comparação com o CamScanner)

Situação: **planejado, ainda não implementado — maquetes enviadas, aguardando aprovação** (decisão de 26/11/2026, depois da versão 2026.11.26-8).
Prints do CamScanner (câmera, ferramentas e tela depois de fotografar) já recebidos e analisados — decisões abaixo.
Regras de sempre: tudo no aparelho, **sem IA** e sem gasto de créditos; não mover botões existentes; caber em 390 px; teste novo em `testes/` no `rodar.sh`.

## ✅ Aprovado para fazer
1. **Lanterna** — botão para ligar/desligar **durante a digitalização** (na câmera). **Desligada por padrão.**
2. **Captura automática** — quando a borda do documento fica parada ~1 s, fotografa sozinha. Botão para ligar/desligar **durante a digitalização**. **Desligada por padrão.**
3. **Filtros**
   - escolher o filtro **antes** de digitalizar, **durante** (na câmera) e **depois** (no editor);
   - poder usar **um filtro numa página e outro em outra** página do mesmo documento (já existe a caixinha “aplicar a todas”; manter);
   - manter **um filtro padrão** (escolhido pelo usuário);
   - avaliar filtros novos, todos sem IA: Original, **Sem sombra**, **Eco** (economia de tinta: fundo branco puro, texto mais leve), Clarear, Cor realçada, Cinza, Preto e branco.
4. *(incluído no item 3 — filtro Eco)*
5. **Guia do cartão no modo ID** — retângulo-guia na câmera no formato do documento (RG, CNH, passaporte, cartão…) e passos “Frente → Verso”.
6. **Qualidade do arquivo** — ex.: Leve (e-mail/WhatsApp/PJe) · Normal · Alta. Substitui “comprimir PDF”.
7. **Livro** — dividir a foto em duas páginas (página esquerda e direita). Uso: **CTPS** e livros.
8. **Marca d’água** no PDF (ex.: “Cópia — uso exclusivo no processo nº …”).
9. **Assinar (Sign)** — rubrica desenhada na tela **ou** foto da assinatura, colada no PDF no **lugar, tamanho e posição** que o usuário escolher; **assinaturas salvas** para reutilizar. (Imagem de assinatura — não substitui certificado ICP-Brasil.)

## ✅ Aprovado depois dos prints da tela pós-foto (2ª rodada)
10. **Resultado primeiro** — depois da foto abre a página **já recortada automaticamente e com o filtro**; o ajuste dos cantos fica no botão (o “👁 Ver resultado / ✏️ Ajustar cantos” que já existe). Poder **passar pelas páginas para conferir** recorte, filtro e demais ajustes antes de enviar.
11. **↶ Desfazer a última foto** na câmera (lote).
12. **📷 Refazer** (nome escolhido pelo usuário — não “Retomar”): fotografa de novo e troca só a página aberta, na mesma posição.
13. **▶ Retomar digitalização interrompida** — se o app fechar/sair antes de salvar ou compartilhar, oferecer continuar de onde parou (páginas guardadas no aparelho até o envio).
14. **Filtros com miniatura da própria página** (cada filtro aplicado de verdade na miniatura).
15. **Comparar** antes × depois (segurar mostra a foto original).
16. **Passar páginas** com ◀ ▶ e arrastando o dedo, com “1/N”.
17. **Tarja** sólida **preta** e **branca** (dados sensíveis — LGPD; a branca apaga carimbo/anotação).
18. **Adicionar texto** livre (lugar e tamanho escolhidos) + **textos prontos**: “Confere com o original” (art. 425, IV, CPC), “Cópia”, “Documento do cliente — uso exclusivo no processo nº …”, data do dia etc.
19. **Colagem** (2/4/6 fotos por folha A4) — **mostrar imagens antes**; decidir depois de ver.

Antes de implementar: **mandar imagens (maquetes) ao usuário** e esperar a aprovação.

## ⏸ Manter como está
- **OCR** — visível como “em breve”.

## ❌ Não fazer (decisão do usuário)
Pincel / marca-texto · salvar nas Fotos · título da página · Grade · girar pela orientação do texto · apagar escrita à mão · importar PDF / mesclar arquivos / extrair páginas · proteger com senha · comprimir PDF existente · carimbo de data/hora/local · lista de “Recentes” ·
tudo o que usa IA (Omnifix, Smart Erase, apagar marcas, restaurar foto, Solver AI, tradução, fórmula) · tecla de volume (impossível no navegador) ·
Mega Scan · livro com captura ao virar a página · digitalização 3D · quadro branco · slides · foto 3×4 · CountCam · medida · QR code · captura de tela contínua · PDF para imagem · PPT/Excel · Word fiel ao layout.
