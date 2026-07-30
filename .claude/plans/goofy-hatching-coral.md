# Fase 5 — Multiplayer local (zonas, lobby por gestos, teste de alcance, coop/versus, tela dividida)

## Contexto

O roadmap (`planejamento-motion-arcade.md`, seção 10) já tem as Fases 1–4 validadas e commitadas (`3c8fae0`, `678fe22`, `c73b172`), com deploy no Vercel conectado a `origin/motion-arcade` no GitHub. A Fase 5 é a maior do roadmap (~2 semanas estimadas): hoje o jogo só suporta 1 jogador, 1 mão (`numHands: 1` fixo em `handTracker.ts`), fluxo `Biblioteca → Partida (instruções/contagem/jogo) → Resultado`, sem lobby, sem calibração e sem tela dividida.

Decisões já confirmadas com o usuário:
- As telas pré-partida por gesto (Lobby, Teste de Alcance) valem para **todos os modos, incluindo solo** — mesmo jogando sozinho, o fluxo passa por Seleção de Modo → Lobby (1 faixa) → Teste de Alcance, substituindo o atual clique em "Começar". Isso é uma mudança de UX no fluxo solo já validado, mas é o que a seção 2 do planejamento pede ("Lobby e demais telas pré-partida 100% operáveis por gestos").
- Tela dividida: construir só a infraestrutura no `GameHost` (viewports múltiplos quando `telaDividida: true`); nenhum jogo existe ainda para exercitá-la visualmente (fica para a Fase 6 — 2º jogo).

Simplificações de escopo assumidas (gestos `thumbsUp`/`wave` nunca foram implementados em `handTracker.ts` — só `pinch` existe):
- "Detectada" numa faixa do lobby = presença de mão naquela faixa (sem exigir classificador de aceno).
- "Pronta" = **pinça** (gesto já implementado) OU mão parada 2s (hover-press) — usa o "ou" que o próprio planejamento already permite, sem inventar um classificador de joinha novo.
- Recorde multiplayer: versus grava o melhor individual (`max(placar)`); coop grava a soma da equipe (`sum(placar)`); solo continua igual a hoje.

## Arquitetura da mudança

**Câmera e resolução de zonas passam a viver em `App.tsx`**, não mais dentro de `Partida.tsx`/`TesteCamera.tsx` isoladamente. Motivo: Lobby → Teste de Alcance → Partida precisam da mesma câmera e do mesmo `Tracker` sem reabrir `getUserMedia` a cada tela, e a identidade dos jogadores (qual mão é o jogador 2) precisa persistir entre essas três telas.

- `useTracker` (`src/hooks/useTracker.ts`) ganha um parâmetro `ativo: boolean` — só pede a câmera quando `ativo` é `true`. Biblioteca e Seleção de Modo continuam sem pedir câmera (privacidade).
- Novo `src/tracking/zonas.ts` — `ResolvedorDeZonas` **implementa a interface `Tracker`** (envolve o tracker bruto), então todo consumidor existente (`GameHost`, `TesteCamera`) continua recebendo algo com `start/stop/getState()`. Ele resolve "N mãos brutas detectadas" (o que `HandTracker.getState()` passa a devolver) em `controles[0..jogadores-1]` estáveis:
  1. Casa cada mão bruta deste frame com o slot de jogador cuja última posição conhecida está mais próxima (preserva identidade entre frames).
  2. Mãos brutas não casadas vão para o slot livre cuja faixa vertical (`largura/jogadores`) contém a posição da mão.
  3. Slots sem mão casada neste frame → `ativo: false`.
  4. Renormaliza o cursor: posição local dentro da própria faixa (0–1) e depois aplica a calibração do teste de alcance (`{xMin,xMax,yMin,yMax}`, padrão = faixa inteira quando não calibrado/pulado).
  - Método extra `definirCalibracao(jogador, calibracao)`.
- `App.tsx` cria **uma única instância** de `ResolvedorDeZonas` ao entrar no Lobby (quantidade de jogadores = escolhida na Seleção de Modo) e a reutiliza em Lobby → Teste de Alcance → Partida, para manter a identidade "jogador 2 é aquela mão" do início ao fim.

## Arquivos novos

- **`src/tracking/zonas.ts`** — `ResolvedorDeZonas` descrito acima (sem React, mesma regra do princípio 7 do planejamento).
- **`src/hooks/useHoverPress.ts`** — utilitário de "segurar por 2s" citado na seção 9 do planejamento. Implementado como função imperativa `criarHoverPress(duracaoMs)` com `.atualizar(dentroDoAlvo: boolean, dt: number): { progresso: number; completou: boolean }`, chamada a cada frame dentro dos loops `requestAnimationFrame` das telas de gesto (mesmo padrão imperativo já usado em `TesteCamera.tsx`/`GameHost`) — não é um hook React com `setState` por frame.
- **`src/core/jogadores.ts`** — extrai `CORES_JOGADORES` (hoje só em `gameHost.ts`) para ser reusado por `GameHost`, `Lobby`, `TesteDeAlcance`, `Partida` (HUD) e `Resultado`.
- **`src/ui/SelecaoDeModo.tsx` + `.css`** — tela mouse/toque: botões de modo (`manifest.modos`) + stepper de jogadores (`manifest.jogadores.min..max`). Emite `{ modo, jogadores }`.
- **`src/ui/Lobby.tsx` + `.css`** — vídeo espelhado de fundo, N faixas verticais (N = jogadores escolhidos na seleção de modo), overlay desenhado via loop `requestAnimationFrame` (mesmo padrão de `TesteCamera.tsx`): cada faixa mostra estado livre/detectada/pronta com a cor do jogador; texto do botão "Começar com N jogadores" (N = quantidade atualmente pronta); botão habilita ao atingir `manifest.jogadores.min` prontos; confirmação por hover-press de 2s. Faixa que fica sem mão por >5s volta a livre (regra da seção 5.3). Ao completar, devolve a contagem real de jogadores prontos (pode ser menor que o N escolhido na seleção de modo).
- **`src/ui/TesteDeAlcance.tsx` + `.css`** — por jogador (faixa própria), moldura tracejada com 4 alvos de canto na cor do jogador; tocar um alvo (proximidade do cursor) grava aquele canto; canto sem toque em ~8s é aproximado automaticamente (encolhe a fronteira lógica); "pular" por hover quando `manifest.testeDeAlcance === 'opcional'`; ao concluir todos os jogadores, chama `resolvedor.definirCalibracao(...)` para cada um e avança.

## Arquivos modificados

- **`src/tracking/handTracker.ts`** — `numHands` fixo em 4 (era 1); `getState()` passa a devolver a lista bruta de mãos detectadas neste frame (0 a 4 itens, sem mais preencher um placeholder `ativo:false` de tamanho 1) — a resolução por jogador migra para `ResolvedorDeZonas`. `TesteCamera.tsx` já trata `getState()[0]` como possivelmente `undefined` (optional chaining existente), então não precisa mudar.
- **`src/hooks/useTracker.ts`** — adiciona parâmetro `ativo: boolean`; efeito de câmera só roda quando `ativo`.
- **`src/core/gameHost.ts`** — `GameHostOpcoes` ganha `telaDividida: boolean`; construtor calcula N viewports (divisão vertical) quando `telaDividida && jogadores > 1`, senão mantém o viewport único atual. `desenharCursores` passa a desenhar o cursor de cada jogador ativo no viewport correspondente. Pausa automática: troca "algum jogador ativo" por "algum jogador confirmado inativo" e emite novo evento `aoMudarJogadoresInativos(indices: number[])` para a UI poder mostrar "Jogador 3 saiu do quadro" (mantém "Mostre sua mão" no caso solo).
- **`src/hooks/useGameHost.ts`** — recebe `jogadores`, `modo`, `telaDividida` (hoje fixos em `1`/`'solo'`) e o tracker já resolvido por zona (via prop/ref, não cria mais nada sozinho); placar/vidas iniciais dimensionados por `jogadores`.
- **`src/games/pegaFrutas/game.ts`** — `update()` passa a iterar `controles.slice(0, jogadores)` (jogadores guardado no `init`) em vez de só `controles[0]`; qualquer jogador ativo perto de uma fruta pontua (`pontuar(jogadorIndex, 1)`); mundo compartilhado (frutas somem para todos ao serem pegas) já dá versus (corrida) e coop (queda compartilhada, pontuação individual) sem regra nova — é a prova mínima de que a arquitetura multiplayer funciona no jogo já existente.
- **`src/ui/Partida.tsx` + `.css`** — remove a fase `instrucoes` e o botão de clique "Começar" (Lobby assume esse papel); passa a receber `jogadores`, `modo`, `videoRef`/`trackerRef` já prontos via props (não chama mais `useTracker` sozinho); HUD mostra placar somado (coop) ou lista por jogador com cor (versus) ou número único (solo); pill de status usa `jogadoresInativos` para mensagem por jogador.
- **`src/ui/Resultado.tsx` + `.css`** — recebe `modo`; solo mantém UI atual; versus mostra ranking por jogador (cor + posição); coop mostra placar de equipe (soma); grava recorde conforme a regra descrita acima.
- **`src/App.tsx`** — novo estado de tela: `biblioteca → selecaoDeModo → lobby → testeDeAlcance → partida → resultado`. Possui `useTracker(videoRef, ativo)` (ativo = tela ∈ {lobby, testeDeAlcance, partida}) e a instância de `ResolvedorDeZonas` (criada ao entrar em `lobby`, guardada em ref, reaproveitada até `resultado`/volta à biblioteca). Se um jogador confirmado ficar inativo por >5s durante `testeDeAlcance` ou a contagem regressiva (dentro de `partida`), volta para `lobby` (loop indicado no diagrama da seção 5).
- **`src/ui/Biblioteca.tsx`** — sem mudança de código; `aoJogar` passa a ser conectado pelo `App.tsx` à Seleção de Modo em vez de ir direto para Partida.

## Ordem de implementação sugerida

1. `zonas.ts` + mudança em `handTracker.ts` (base de tracking multiplayer).
2. `useHoverPress.ts` + `core/jogadores.ts` (utilitários reusados pelas telas novas).
3. `SelecaoDeModo.tsx`, `Lobby.tsx`, `TesteDeAlcance.tsx`.
4. `GameHost`/`useGameHost`/`Partida.tsx` (consumo multiplayer + tela dividida infra).
5. `PegaFrutas` (usa todos os jogadores ativos).
6. `Resultado.tsx` (ranking/soma por modo).
7. `App.tsx` (liga tudo, câmera condicional, loop de "jogador sumiu").

## Verificação

- `npx tsc -b`, `npx oxlint`, `npx vite build` devem passar limpos após cada etapa.
- `npm run dev` e testar manualmente (isso depende do usuário, sem navegador/câmera automatizável neste ambiente):
  - Solo: Biblioteca → Seleção de Modo (1 jogador) → Lobby (1 faixa, pronto por pinça ou 2s parado) → Teste de Alcance (ou pular, já que Pega-Frutas é `opcional`) → contagem → jogo → resultado — confirmar que o fluxo solo continua jogável, agora por gesto em vez de clique.
  - Multiplayer (2+ mãos, pode ser 2 mãos da mesma pessoa para simular): Lobby mostra faixas separadas, identidade estável ao mover as mãos, "Começar com N" habilita no mínimo do manifesto.
  - Teste de alcance: tocar os 4 cantos calibra; deixar um canto sem tocar por 8s aproxima sozinho.
  - Partida: cada jogador pega fruta e pontua no seu índice; tirar uma mão do quadro por >5s durante o teste de alcance volta ao lobby; tirar durante o jogo pausa e mostra "Jogador N saiu do quadro".
  - Resultado: versus mostra ranking, coop mostra soma.
