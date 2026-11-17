# Deadlock Counter

Overlay para Windows que mostra, durante a partida de **Deadlock**, os itens que mais funcionam contra o time inimigo e como o seu herói se sai contra cada um.

Os dados vêm da [deadlock-api.com](https://deadlock-api.com) e cobrem as partidas dos últimos 30 dias.

## Instalar
1. Baixe o `DeadlockCounter-Setup-x.y.z.exe` na página de [Releases](../../releases/latest).
2. Abra o arquivo. Se o Windows mostrar "O Windows protegeu o computador", clique em **Mais informações → Executar assim mesmo**. O aviso aparece porque o app não tem assinatura digital.
3. No Deadlock, use **tela cheia sem bordas** (Configurações → Vídeo). Em tela cheia exclusiva, o overlay não aparece por cima.

## Usar
1. Escolha seu herói e os inimigos (dá para buscar pelo nome; Enter escolhe o primeiro).
2. Aperte **Ctrl+Shift+D** para entrar no modo jogo: o painel vai para o canto e os cliques passam para o jogo.

| Atalho | O que faz |
|---|---|
| `Ctrl+Shift+D` | alterna entre modo jogo e editar |
| `Ctrl+Shift+E` | troca o inimigo em foco (time todo → cada inimigo) |
| `Ctrl+Shift+F` | troca a fase (tudo, início, meio, fim) |
| `Ctrl+Shift+H` | esconde ou mostra o painel |

**Como ler os números:** "40,5% → 42,5%" quer dizer que, contra esses inimigos, quem compra o item ganha 42,5% das partidas, contra os 40,5% de sempre. A conta já desconta o quanto o seu herói ganha ou perde naturalmente contra eles.

O app só abre uma janela por cima do jogo. Ele não lê nem altera a memória do Deadlock.

## Desenvolver
```
npm install
npm start        # rodar
npm test         # testes
npm run dist     # gerar o instalador em dist/
```
