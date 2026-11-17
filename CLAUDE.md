# Deadlock Counter

Overlay para Windows que mostra, durante a partida de Deadlock, os **itens counter** contra os heróis inimigos e os **confrontos** do seu herói contra cada um. Os dados vêm da https://api.deadlock-api.com (sem chave; o limite é de 200 req/min por IP nos endpoints de analytics). Projeto pessoal.

## Arquitetura
- Electron, sem framework. `src/main.js` é o processo principal, `src/preload.js` faz a ponte (`window.dc`) e `src/renderer/` tem a interface em HTML, CSS e JS puro.
- `src/analyze.js`: cálculos puros, testados em `test/analyze.test.js`.
  - `analyzeItems`: uma chamada a `/v1/analytics/item-stats?hero_id=X&bucket=enemy_hero` traz a taxa de vitória de cada item **por herói inimigo**. A média do item é a soma de todas as linhas. Para cada inimigo escolhido, o ganho é `taxa contra ele − (média do item + efeito do confronto)`. O efeito do confronto é quanto o herói ganha a mais ou a menos contra aquele inimigo com qualquer item. Sem descontar isso, todo item parecia bom contra quem o herói já vence. O valor é "encolhido" com `prior` = 800 partidas e o item precisa de pelo menos 500 partidas (`minMatches`). A pontuação é a média simples entre os inimigos, em pontos percentuais.
  - `analyzeMatchups`: usa `/v1/analytics/hero-counter-stats` (todas as duplas).
  - `findLiveMatch`: usa `/v1/matches/active?account_id=`, que só cobre as **200 partidas do topo** da aba de assistir. Na maioria das partidas não acha nada, e por isso existe a escolha manual.
- Cache em disco em `%APPDATA%\deadlock-counter\cache`: assets por 24 h, item-stats por 1 h, counter por 6 h. Usa o cache vencido se a API cair. Chamadas iguais ao mesmo tempo dividem a mesma requisição. A 1ª consulta de item-stats de cada herói leva de 4 a 6 s no servidor, por isso o app pré-busca assim que você escolhe seu herói.
- A configuração (SteamID3, rank mínimo, posição da janela em cada modo) fica em `%APPDATA%\deadlock-counter\config.json`. A última escolha de heróis fica no `localStorage`.
- Janela: transparente, sem borda e sempre por cima no nível `screen-saver`.
  - **Modo editar:** 780×680, interativo.
  - **Modo jogo:** 360×560, os cliques passam para o jogo (`setIgnoreMouseEvents`) e a janela não pega o foco. É compacto, sem rolagem: 6 itens e 6 confrontos.
  - Atalhos globais: `Ctrl+Shift+D` alterna os modos e `Ctrl+Shift+H` esconde.
- Só aparece por cima do jogo com o Deadlock em **tela cheia sem bordas** (borderless). Não injeta nada no jogo, então não há risco com o VAC.

## Comandos
- `npm start`: rodar.
- `npm test`: testes do `analyze.js`.
- `npm run dist`: gera um .exe portátil com o electron-builder.
- Print dos dois modos sem mexer no mouse: `DC_SHOT=<pasta> DC_PICKS="58:6,15,25,35,13,1" npx electron .` (o formato é `meuHerói:inimigos`). Ele salva `edit.png` e `view.png` e fecha.

## Estado atual (2026-11-16)
- **Feito (v0.1):** escolha manual (seu herói + até 6 inimigos, com busca; Enter escolhe o primeiro), detecção automática pelo SteamID, itens counter, confrontos, filtro de rank mínimo, os dois modos e os atalhos. 5 testes passando. Os dois modos foram conferidos por print com dados reais.
- **Falta testar com o jogo aberto:** se o overlay aparece por cima do Deadlock em borderless, se o clique passa no modo jogo e se os atalhos funcionam com o jogo em foco.
- **Ideias:**
  - filtro por tier ou por tipo (arma, vitalidade, espírito);
  - itens por fase do jogo (`min_bought_at_s`/`max_bought_at_s`);
  - esconder itens que você já tem;
  - ícone do app;
  - OCR do placar (Tab) para detectar os inimigos sem a lista das top 200.
