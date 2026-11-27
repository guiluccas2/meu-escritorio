# Testes automáticos

`./rodar.sh` roda todos. Os dados usados (`seed2.js`) são fictícios.

- `tperf.js` — desempenho com volume grande (rodar à parte: `node tperf.js`; `DOM=1` conta elementos; `PERF=painel,processos` mostra o perfil).
- `tcel.js` — todas as telas e formulários no tamanho de celular (`FOTOS=1` salva as imagens na pasta temporária).
- `tarm.js` — gravação no aparelho (dados grandes no IndexedDB, recarregar, fechar logo após editar).
- `tbk.js` — backups automáticos, cópia antes de exclusão em massa, alerta, restaurar e desfazer, retenção.
- `tvinc.js` — vínculos: renomear opções reflete nos workflows e configurações; verificação do sistema.
- `taudgcal.js` — audiência na Google Agenda: título pasta - subtipo - cliente, agenda “Audiências”, presencial × online, descrição completa.
- `tlembeu.js` — lembretes de WhatsApp: “eu mesmo” (cadastro “sou eu”), vários contatos, enviado fica riscado com desfazer/editar.
- `taparencia.js` — paletas de cores (5 × claro/escuro), ajustes de fundo/menu/destaque/botões, ícones discretos, contraste de todas as combinações, impressão em branco.
- `tinicio.js` — tela inicial: ✏️ Personalizar telas (abas tela inicial / menu lateral), prazos × 📞 contatos (lead uma vez só, testemunha, outros tipos), ⚖️ Aguardando julgamento (em pauta / concluso há N dias), indicador e filtro “a distribuir”, sugestão de pauta pelas publicações, vínculo das situações na Verificação.
- `tmodhon.js` — modelos de honorários: criar, editar, ordenar (▲▼), excluir, escolha pelo id, aplicar sem mudar contratos antigos, área na Verificação, celular.
- `twf.js` — workflows. Demais: compromissos, seleção em lote, processos, pessoas, novidades.
