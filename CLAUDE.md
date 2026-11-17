# Deadlock Counter

Overlay para Windows que mostra, durante a partida de Deadlock, os **itens counter** contra os heróis inimigos e os **confrontos** do seu herói contra cada um. Os dados vêm da https://api.deadlock-api.com (sem chave; o limite é de 200 req/min por IP nos endpoints de analytics). Projeto pessoal.

## Arquitetura
- Electron, sem framework. `src/main.js` é o processo principal, `src/preload.js` faz a ponte (`window.dc`) e `src/renderer/` tem a interface em HTML, CSS e JS puro.
- `src/analyze.js`: cálculos puros, testados em `test/analyze.test.js`.
  - `analyzeItems`: uma chamada a `/v1/analytics/item-stats?hero_id=X&bucket=enemy_hero` traz a taxa de vitória de cada item **por herói inimigo**. A média do item é a soma de todas as linhas. Para cada inimigo escolhido, o ganho é `taxa contra ele − (média do item + efeito do confronto)`. O efeito do confronto é quanto o herói ganha a mais ou a menos contra aquele inimigo com qualquer item. Sem descontar isso, todo item parecia bom contra quem o herói já vence. O valor é "encolhido" com `prior` = 800 partidas e o item precisa de pelo menos 400 partidas (`minMatches`). A pontuação é a média simples entre os inimigos, em pontos percentuais. Para exibir, `expected` é a taxa normal do item nesses confrontos e `wr = expected + delta` é a taxa contra eles. O app mostra "40,5% → 42,5%".
  - `phaseQuery`: fases pelo tempo de compra. Início vai de 0 a 540 s, Meio de 540 a 1.200 s e Fim de 1.200 s em diante. Cada fase é uma consulta separada (com cache).
  - `filterItems`: tipo (`weapon`/`vitality`/`spirit`) e tier, aplicados no processo principal depois da análise.
  - Foco: `analyze({ focus })` com o id de um inimigo calcula os counters só contra ele. Com `null`, calcula contra o time todo.
  - `analyzeMatchups`: usa `/v1/analytics/hero-counter-stats` (todas as duplas).
  - `findLiveMatch`: usa `/v1/matches/active?account_id=`, que só cobre as **200 partidas do topo** da aba de assistir. Na maioria das partidas não acha nada, e por isso existe a escolha manual.
- Cache em disco na pasta `cache` dentro do userData. Em dev, o userData é `%APPDATA%\deadlock-counter`; no app instalado, é `%APPDATA%\Deadlock Counter`. Prazos: assets por 24 h, item-stats por 1 h, counter por 6 h. Usa o cache vencido se a API cair. Também há cache em memória (`memo`), porque cada clique num filtro recalcula. Chamadas iguais ao mesmo tempo dividem a mesma requisição. A 1ª consulta de item-stats de cada herói leva de 4 a 6 s no servidor, por isso o app pré-busca assim que você escolhe seu herói.
- A configuração (SteamID3, rank mínimo, posição da janela em cada modo) fica em `config.json` no userData. A última escolha de heróis, a fase e os filtros ficam no `localStorage`.
- Janela: transparente, sem borda e sempre por cima no nível `screen-saver`.
  - **Modo editar:** 780×680, interativo.
  - **Modo jogo:** 360×600, os cliques passam para o jogo (`setIgnoreMouseEvents`) e a janela não pega o foco. É compacto, sem rolagem: 5 itens e 6 confrontos.
  - Atalhos globais: `Ctrl+Shift+D` alterna os modos, `Ctrl+Shift+E` troca o inimigo em foco (time todo → cada inimigo), `Ctrl+Shift+F` troca a fase e `Ctrl+Shift+H` esconde. O processo principal manda `hotkey` para o renderer.
- Só aparece por cima do jogo com o Deadlock em **tela cheia sem bordas** (borderless). Não injeta nada no jogo, então não há risco com o VAC.

## Comandos
- `npm start`: rodar.
- `npm test`: testes do `analyze.js`.
- `npm run dist`: gera o instalador NSIS em `dist/DeadlockCounter-Setup-<versão>.exe` (cerca de 120 MB; instala por usuário, sem pedir admin, com atalhos e abre no fim). `npm run dist:portable` gera um .exe portátil. Não é assinado, então o SmartScreen avisa na primeira vez ("Mais informações" → "Executar assim mesmo").
- Ícone: `python build/make_icon.py` gera `build/icon.png` e `build/icon.ico`.
- Print dos dois modos sem mexer no mouse: `DC_SHOT=<pasta> DC_PICKS="58:6,15,25,35,13,1" npx electron .` (o formato é `meuHerói:inimigos`). Ele salva `edit.png` e `view.png` e fecha. Opcionais: `DC_JS="state.focus=13;state.phase='mid'"` (estado extra) e `DC_WAIT=10000` (espera em ms, para fases ainda sem cache).

## Estado atual (2026-11-16)
- **Feito (v0.1):** escolha manual (seu herói + até 6 inimigos, com busca; Enter escolhe o primeiro), detecção automática pelo SteamID, itens counter, confrontos, filtro de rank mínimo, os dois modos e os atalhos. 5 testes passando. Os dois modos foram conferidos por print com dados reais.
- **Feito (v0.2):** fase da partida (Tudo/Início/Meio/Fim), filtro de tipo e tier, números como "normal → contra eles" e counter por inimigo (clique no modo editar, `Ctrl+Shift+E` no modo jogo). 8 testes passando. Conferido por print: Infernus contra a Haze no meio da partida → Metal Skin de 40,5% para 42,5%.
- **Decisão (2026-11-16):** o usuário pensou em vender, como os trackers de LoL. Mostrei os concorrentes (SoulShots, Deadlock Signal, Deadlock Labs, MetaBot, Statlocker, Tracker.gg, Soulbound; a maioria no Overwolf, cujo GEP dá os inimigos ao vivo) e os riscos (limite da API, falar com a deadlock-api, imagens da Valve). Ele preferiu continuar melhorando o counter por enquanto. Ideia em espera: montar uma build completa com `item-flow-stats` e `ability-order-stats`.
- **Instalador (2026-11-16):** `dist/DeadlockCounter-Setup-0.2.0.exe`, para mandar aos amigos ("os bruxos"). O app empacotado foi testado com o gancho de print e carrega os dados.
- **Falta testar com o jogo aberto:** se o overlay aparece por cima do Deadlock em borderless, se o clique passa no modo jogo e se os atalhos funcionam com o jogo em foco.
- **Ideias:**
  - esconder itens que você já tem;
  - ícone do app;
  - OCR do placar (Tab) para detectar os inimigos sem a lista das top 200.
