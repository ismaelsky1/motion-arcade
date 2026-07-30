# Desvia! — segundo jogo (Fase 6, corpo inteiro, MoveNet MultiPose)

## Contexto

A Fase 5 (multiplayer local) está encerrada e validada. O roadmap ([planejamento-motion-arcade.md:307](../../../dev/motion-arcade/planejamento-motion-arcade.md#L307)) define a Fase 6 como "Expansão", cujo marco de validação é literalmente: *o segundo jogo nasceu em poucos dias só com `init/update/render`? Se sim, a arquitetura provou seu valor.*

Este plano implementa esse segundo jogo, **"Desvia!"** (já citado por nome no diagrama de arquitetura do planejamento, seção 6.1), um jogo de desviar obstáculos com o corpo inteiro. Ele também é, deliberadamente, o teste dessa promessa: ao contrário do Pega-Frutas (que só usa cursor/mão, capacidade já 100% plugável), o Desvia! precisa de um rastreador de **pose multi-pessoa** (MoveNet MultiPose) que **não existe ainda** — nem existe hoje o "Resolvedor de Capacidades" que o diagrama da arquitetura promete (`useTracker.ts` hoje cria `HandTracker` fixo). Este plano é honesto sobre isso: expõe exatamente os pontos do núcleo que precisam mudar para o segundo jogo caber, mantendo essas mudanças mínimas e cirúrgicas (nada de framework genérico de resolução de capacidades além do se/senão entre os 2 rastreadores que realmente existem).

## Decisões de produto já confirmadas com o usuário

- Colisão usa o corpo inteiro (bounding box da pose), não um cursor de ponto único.
- Modos: **solo** e **versus** apenas (sem coop).
- Versus: câmera única compartilhada, **sem tela dividida** — os 2 jogadores aparecem lado a lado na mesma imagem, como jogos de Kinect.
- Versus: obstáculos **compartilhados** (mesmo fluxo pros dois — corrida de sobrevivência), não spawns independentes por jogador.
- Sem placar tradicional durante o jogo — só vidas. HUD de placar existente vai mostrar 0 a partida inteira (ver nota de UX abaixo).
- Obstáculos nascem pequenos perto do centro da câmera e **crescem** (efeito de aproximação/zoom) até o jogador — não caem de cima nem vêm das bordas.
- Lobby: cada jogador detectado ganha uma caixa colorida desenhada na posição real do corpo (bounding box), substituindo as faixas verticais fixas usadas pelo Pega-Frutas.
- Vencedor do versus: quem tem mais **vidas restantes** ao final (não placar).
- Jogador que zera as vidas continua em quadro, só não perde mais vida (`Math.max(0, ...)` já existente no núcleo cobre isso — nenhum estado "eliminado" novo).
- Vidas iniciais: **5** (jogo mais longo, já que obstáculos vêm continuamente).
- Resultado no modo **solo**: como não há placar, registra e mostra o **tempo sobrevivido em segundos** como "recorde" (reaproveitando o sistema de recorde já existente em `core/scores.ts`, não um novo mecanismo).
- HUD: esconder o cursor tracejado padrão do núcleo (`GameHost.desenharCursores`) para jogos de capacidade `pose` — o próprio jogo desenha o contorno do corpo.

## Descobertas da exploração (verificadas lendo o código, não assumidas)

- `Capacidade` já inclui `'pose'` e `'zonas'` em [games/types.ts](../../../dev/motion-arcade/src/games/types.ts) e `Biblioteca.tsx` já tem rótulos pra ambos — não é um tipo novo.
- `TrackerConstructor` (com `static capacidades`) já existe em `tracker.ts` e `HandTracker` já a implementa, mas **nada lê isso hoje** — `useTracker.ts:35` cria `new HandTracker()` fixo. Esse é o gap real do "resolvedor de capacidades".
- `Resultado.tsx` só recebe `placar: number[]`; não existe plumbing de `vidas` até ali. `Partida.tsx`'s `aoTerminar(placar)` precisa virar `aoTerminar(placar, vidas)` (ambos já disponíveis via `useGameHost`).
- `GameHost` já é genérico por jogador (`placar[]`, `vidas[]`, clamp em 0, `terminar()` quando `vidas.every(v => v<=0)`) — **exceto** que `GameInitParams` não expõe `vidasIniciais` ao próprio jogo (só o núcleo conhece esse número hoje). O Desvia! precisa saber quantas vidas cada jogador tem pra decidir quando parar de contar tempo de sobrevivência — isso exige adicionar `vidasIniciais: number` a `GameInitParams` (~2 linhas: o campo no tipo + repassar `this.opcoes.vidasIniciais` em `GameHost.iniciar()`). É a única adição justificada ao contrato do núcleo além da seleção de rastreador.
- `Lobby.tsx` está tipado especificamente pra `resolvedor: ResolvedorDeZonas`, divide em faixas verticais fixas e assume `cursor.x/y` já normalizado *dentro* da faixa — precisa aceitar `Tracker` genérico e ganhar um caminho de desenho alternativo (caixa na posição real) quando `manifest.capacidades.includes('pose')`.
- `TesteDeAlcance.tsx` não muda — só deixa de ser renderizado quando o manifest pula essa etapa.
- MoveNet MultiPose via `@tensorflow-models/pose-detection`: `createDetector(SupportedModels.MoveNet, { modelType: MULTIPOSE_LIGHTNING, enableTracking: true, trackerType: TrackerType.BoundingBox })`; `estimatePoses(video)` é **assíncrono** (diferente do `HandLandmarker.detectForVideo`, que é síncrono) — o loop do `PoseTracker` precisa de guarda contra sobreposição de chamadas. Cada pose tem `keypoints` (17 pontos COCO) e `id` estável (com tracking ligado). Coordenadas provavelmente vêm em pixels da imagem de entrada, não normalizadas 0-1 — **verificar empiricamente logando um frame** antes de fechar `poseTracker.ts`, e normalizar pra 0-1 espelhado (mesma convenção do `HandTracker`) antes de emitir `ControlState`.
- Nenhuma dependência `@tensorflow/*` existe ainda — é uma adição nova de verdade, precisa ser **importada dinamicamente** dentro de `useTracker.ts` (só quando o jogo precisa de `'pose'`), pra não pesar o bundle de quem só joga Pega-Frutas.
- HUD: a mensagem "Mostre sua mão" em `Partida.tsx` (pill de status) é específica de jogo de mão — para jogos de pose faz mais sentido "Mostre-se para a câmera". Pequeno ajuste de texto condicionado à capacidade do manifest.

## Ordem de implementação

**1. `src/games/types.ts`**
- `TesteDeAlcance` ganha o valor `'inaplicavel'`.
- `GameManifest` ganha `resultadoPor?: 'placar' | 'vidas' | Partial<Record<Modo, 'placar' | 'vidas'>>` + helper `resolverResultadoPor(resultadoPor, modo)`, espelhando exatamente o padrão já usado por `TelaDividida`/`resolverTelaDividida` (mesma forma: fixo ou por modo). Desvia! declara `resultadoPor: { versus: 'vidas' }` (solo cai no default `'placar'`, que continua funcionando sem mudança nenhuma pro Pega-Frutas).
- `GameInitParams` ganha `vidasIniciais: number`.

**2. `src/core/gameHost.ts`**
- `iniciar()`: incluir `vidasIniciais: this.opcoes.vidasIniciais` no objeto passado a `jogo.init(...)`.
- `GameHostOpcoes` ganha `mostrarCursorPadrao?: boolean` (default `true`); `loop()` só chama `this.desenharCursores(controles)` quando `mostrarCursorPadrao !== false`.

**3. `src/hooks/useGameHost.ts`**
- Ao montar `GameHost`, passar `mostrarCursorPadrao: !manifest.capacidades.includes('pose')`.

**4. `package.json`** — adicionar `@tensorflow/tfjs` e `@tensorflow-models/pose-detection`; instalar e conferir os tipos gerados antes de escrever o tracker.

**5. `src/tracking/poseTracker.ts` (novo)**
- Implementa `Tracker`; `static capacidades: Capacidade[] = ['pose']`.
- Exporta `interface PoseKeypoint` e `function bboxDeKeypoints(points, limiarConfianca)` (0-1 normalizado, espelhado) — usado tanto pelo `Lobby.tsx` quanto pelo `desvia/game.ts`, pra não duplicar essa conta.
- `start()`: seleciona backend WebGL com fallback pra CPU (verificar a forma real do fallback do TF.js — provavelmente checar `tf.getBackend()` após `tf.ready()`, não um try/catch como no `HandTracker`).
- Loop assíncrono com guarda de sobreposição (não disparar `estimatePoses` de novo antes do anterior resolver).
- Identidade por jogador: `Map<idDaLib, indiceDeJogador>`, atribuição por ordem de primeira aparição, sem realocação de slot já ocupado — a mesma responsabilidade que `ResolvedorDeZonas` cumpre pra mãos, mas resolvida aqui dentro porque não há zonas/calibração envolvidas.
- `getState()` devolve `ControlState[]` com `cursor` = centro do bbox (uso só de depuração/HUD) e `points` = keypoints normalizados.

**6. `src/hooks/useTracker.ts`**
- Novo parâmetro `capacidades: Capacidade[]`.
- Dentro de `iniciar()`, trocar `new HandTracker()` fixo por: `pose` nas capacidades → `import('../tracking/poseTracker')` dinâmico e `new PoseTracker()`; senão `new HandTracker()` como hoje. Adicionar `capacidades` às deps do efeito.

**7. `src/App.tsx`**
- `useTracker(videoRef, cameraAtiva, jogoAtual?.capacidades ?? [])`.
- `resolvedorRef` muda de `RefObject<ResolvedorDeZonas | null>` pra `RefObject<Tracker | null>`.
- Nos 2 pontos que hoje fazem `new ResolvedorDeZonas(...)` (efeito de `precisaNovoResolvedor` e `aoConfirmarLobby`): se `jogoAtual?.capacidades.includes('pose')`, atribuir `trackerRef.current` direto (sem wrap); senão manter o `ResolvedorDeZonas` como está.
- `aoConfirmarLobby`: ir direto pra `'partida'` quando `jogoAtual?.testeDeAlcance === 'inaplicavel'`; senão manter fluxo atual pra `'testeDeAlcance'`.
- No local que renderiza `<TesteDeAlcance resolvedor={...}>`, fazer o cast pra `ResolvedorDeZonas` (seguro por construção — esse branch nunca é alcançado por jogos de pose).
- `aoTerminar` widen pra `(placar, vidas) => void`; guardar `vidasFinais` em state e passar pro `<Resultado>`.

**8. `src/ui/Partida.tsx`**
- `aoTerminar: (placar: number[]) => void` → `(placar: number[], vidas: number[]) => void`; atualizar a chamada no `useEffect` (linha ~59) pra `aoTerminar(placar, vidas)`.
- Pill de status: quando `manifest.capacidades.includes('pose')`, trocar "Mostre sua mão" por "Mostre-se para a câmera".

**9. `src/ui/Lobby.tsx`**
- `resolvedor: ResolvedorDeZonas` → `resolvedor: Tracker` (ajustar o tipo de retorno usado em `desenharCanvas`).
- Em `desenharCanvas`, ramificar por `manifest.capacidades.includes('pose')`: em vez de retângulos fixos em faixa (`x = i*larguraFaixa`), desenhar a caixa de cada jogador ativo na posição real do corpo via `bboxDeKeypoints(controle.points as PoseKeypoint[])` escalado pro canvas. Máquina de estados (`livre→detectada→pronta`, hover 2s) não muda — já opera por índice de `controles[i]`, que é exatamente o que o `PoseTracker` entrega.

**10. `src/ui/Resultado.tsx`**
- Novo prop `vidas: number[]`.
- Quando `resolverResultadoPor(manifest.resultadoPor, modo) === 'vidas'`: pular o bloco `registrarPontuacao`/`obterRecorde` inteiro; montar o `ranking` a partir de `vidas` (decrescente) em vez de `placar`.
- Caso contrário: lógica atual de placar/recorde, sem mudança (cobre o Pega-Frutas e o modo solo do Desvia!, que usa `'placar'` — ver próximo item).

**11. `src/games/desvia/manifest.ts` (novo)**
```ts
{
  id: 'desvia',
  titulo: 'Desvia!',
  jogadores: { min: 1, max: 2 },
  modos: ['solo', 'versus'],
  telaDividida: false,
  testeDeAlcance: 'inaplicavel',
  capacidades: ['pose'],
  resultadoPor: { versus: 'vidas' },
  vidasIniciais: 5,
  carregar: () => import('./game'),
}
```

**12. `src/games/desvia/game.ts` (novo)**
- `init`: guarda `perderVida`, `pontuar`, `viewports[0]`; inicializa `vidasRestantes = Array(jogadores).fill(params.vidasIniciais)` e `tempoSobrevivido = Array(jogadores).fill(0)`; um único timer de spawn (não por viewport — `viewports.length` é sempre 1 aqui).
- `update`: obstáculos crescem em direção ao jogador por `dt` (efeito de aproximação); pra cada jogador ativo com `vidasRestantes[i] > 0`, soma `dt` em `tempoSobrevivido[i]`; testa sobreposição AABB entre o bbox do jogador (via `bboxDeKeypoints` sobre `controle.points`) e cada obstáculo — em colisão: `vidasRestantes[i]--`, `perderVida(i)`, remove o obstáculo; se `vidasRestantes[i]` chegou a 0 nesse frame, `pontuar(i, Math.round(tempoSobrevivido[i]))` (uma vez só — alimenta o recorde do modo solo via o mecanismo de placar já existente; em versus esse valor simplesmente não é usado pro ranking, que é por vidas). Obstáculos que crescem além do limite sem colidir são removidos sem penalidade (desvio bem-sucedido).
- `render`: desenha os obstáculos crescendo; sempre um viewport só, sem os ramos de `dividido` que o Pega-Frutas usa.
- `destroy`: limpa o array de obstáculos.

**13. `src/games/registry.ts`** — importar o manifest do Desvia! e adicionar ao array.

**14. Assets** — `public/jogos/desvia/capa.png` precisa de uma imagem de capa real (não consigo gerar binário); fica como pendência separada, mesmo padrão do Pega-Frutas.

## Nota de UX aceita (não é bug)

Como o Desvia! nunca chama `pontuar()` durante o jogo (só uma vez, no momento em que um jogador zera as vidas), o HUD de placar existente (`Partida.tsx`, sempre visível) vai mostrar "0" a partida inteira e pular pro tempo sobrevivido só no instante da morte. Isso é aceitável e não exige um flag novo pra esconder o HUD de placar — mantém o núcleo simples.

## Verificação

- `npx tsc -b` depois de cada bloco de mudança de tipo (principalmente os passos 7–10, que mudam assinaturas de props entre `App.tsx`/`Lobby.tsx`/`Partida.tsx`/`Resultado.tsx`) — o projeto usa `verbatimModuleSyntax`/`noUnusedLocals` estritos, então erros de import/parâmetro aparecem na hora.
- `npm run build` depois de instalar as deps novas — conferir no output que `poseTracker`/tfjs formam um chunk separado carregado sob demanda (confirma que o import dinâmico do passo 6 está funcionando e uma sessão só-Pega-Frutas não baixa tfjs).
- `npm run lint` (oxlint).
- Teste manual via `npm run dev` (sem automação de câmera neste ambiente, mesmo padrão das fases anteriores): Lobby desenhando caixas na posição real do corpo pra 1 e 2 pessoas; Teste de Alcance sendo pulado pro Desvia!; jogar solo até zerar vidas e conferir o recorde em segundos no Resultado; jogar versus com 2 pessoas e conferir o ranking por vidas restantes; checar que, sem WebGL2 (se der pra forçar via flag do navegador), o `PoseTracker` cai pra CPU sem travar.
