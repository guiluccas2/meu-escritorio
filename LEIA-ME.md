# Meu Escritório

Sistema do escritório: clientes, processos, partes e testemunhas, atendimentos, prazos e agenda, publicações (DJEN), movimentações (PUSH e DataJud), leads e financeiro.

Endereço: **https://guiluccas2.github.io/meu-escritorio/**

- **A página** fica no GitHub Pages. Cada alteração enviada a este repositório é publicada sozinha em 1 a 2 minutos.
- **Os dados** ficam no arquivo `escritorio-dados.json`, na pasta *Aplicativos* do seu **Dropbox**. Uma cópia fica em cada aparelho, então o sistema abre na hora e funciona sem internet.
- **Nenhum dado de cliente fica neste repositório.** Aqui está só o código do sistema.
- **A chave da IA** (Anthropic) fica só no aparelho onde foi informada.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | o sistema inteiro |
| `manifest.webmanifest`, `sw.js` | instalação como aplicativo e funcionamento sem internet |
| `icon-*.png`, `apple-touch-icon*.png`, `favicon-64.png` | ícone "GG" do app |
| `robo/robo-escritorio.gs` | robô do Google Apps Script (PUSH, DataJud e e-mail diário das 8h). Não é publicado no site: o código é colado no Apps Script. |

## Configuração (uma vez só)

### 1. Ativar o GitHub Pages
1. No repositório, vá em *Settings → Pages*.
2. Em *Build and deployment*, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`, e clique em *Save*.
3. Em 1 ou 2 minutos o sistema estará em **https://guiluccas2.github.io/meu-escritorio/**

### 2. Autorizar o endereço novo no Dropbox
1. Acesse <https://www.dropbox.com/developers/apps> e abra o app do escritório (App key `7mn7t0ltbk15ce1`).
2. Na aba **Settings**, em *OAuth 2 → Redirect URIs*, adicione **`https://guiluccas2.github.io/meu-escritorio/`** (com a barra no final) e clique em *Add*.
3. Mantenha também o endereço antigo do Netlify até terminar a mudança.

### 3. Em cada aparelho
1. No endereço antigo, confira que aparece **"Salvo no Dropbox"**.
2. Abra o endereço novo e conecte o Dropbox. Os dados voltam todos.
3. Em **Backup e dados**, cole de novo a chave da IA.
4. Instale o app:
   - **iPhone (Safari):** Compartilhar → **Adicionar à Tela de Início**.
   - **Android (Chrome):** menu ⋮ → **Instalar app**.
   - **Windows (Chrome ou Edge):** ícone de instalar no fim da barra de endereço.
5. Apague o app antigo (do Netlify) da tela inicial.

O robô do Google, as configurações de publicações e a fila de importação de processos ficam salvos no Dropbox e continuam funcionando.

## Atualizações
As alterações feitas pelo Claude são enviadas a este repositório e publicadas sozinhas. Para receber a versão nova, basta abrir o app (às vezes é preciso fechar e abrir uma segunda vez).
