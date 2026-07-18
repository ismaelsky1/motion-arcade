# Motion Arcade — Documento de planejamento

> Plataforma web de jogos controlados por câmera, estilo "console playground".
> Nome provisório: **Motion Arcade**. Versão do documento: 1.1 (18/07/2026) — stack revisada para React + Vite desde o início.

---

## 1. Visão geral

Um site onde o jogador ativa a webcam e usa o próprio corpo (ou as mãos) como controle: os movimentos capturados pela câmera viram comandos dentro do jogo — mover um cursor, pegar objetos, desviar de obstáculos. Todo o processamento de visão computacional acontece no navegador do jogador; nenhum vídeo é enviado a servidor. Isso garante privacidade, latência baixa e custo zero de infraestrutura (hospedagem estática gratuita).

O site é uma **plataforma**, não um jogo: uma biblioteca estilo Steam lista vários mini-jogos, cada um implementado como plugin de um núcleo compartilhado.

## 2. Requisitos consolidados

- Visual inspirado na Steam (loja escura, cards com capas, destaque no topo).
- Menu inicial (biblioteca) para selecionar o jogo.
- Tipo de rastreamento facilmente trocável (mãos, corpo inteiro, movimento simples).
- Suporte a jogos de 1 a 4 jogadores na mesma câmera.
- Modos coop e versus; suporte a tela dividida quando o jogo declarar.
- Tela de teste de alcance antes da partida, onde cada jogador vê a fronteira da sua área de controle.
- Lobby e demais telas pré-partida 100% operáveis por gestos (ninguém está perto do mouse).

## 3. Stack tecnológica

| Camada | Escolha | Observações |
|---|---|---|
| Frontend | **React + Vite desde o início** | UI declarativa para biblioteca, lobby e telas; dev server rápido; code splitting nativo por jogo via `import()` dinâmico |
| Visão computacional | MediaPipe (Hands, Pose) via CDN; MoveNet MultiPose (TensorFlow.js) para multi-pessoa | Todos gratuitos, rodando no navegador |
| Renderização | Canvas 2D, **fora do ciclo de renderização do React** | Three.js/WebGL só se houver demanda de 3D no futuro |
| Hospedagem | GitHub Pages, Vercel ou Netlify | **HTTPS é obrigatório**: `getUserMedia` só funciona em conexão segura ou `localhost` |
| Persistência | `localStorage` (recordes por jogo) | Backend só na fase de ranking online |

**Divisão de papéis (regra de ouro do React em jogos):** o React cuida da interface — biblioteca, seleção de modo, lobby, teste de alcance, HUD e resultado. O loop do jogo e o rastreamento rodam **fora do React**, em módulos imperativos sobre Canvas: o `GameHost` é montado dentro de um componente (`<Partida>`) via `useEffect`/refs e roda a 60 fps sem provocar re-renders. O HUD atualiza por evento (mudou o placar), nunca por frame. As pastas `core/`, `tracking/` e `games/` não importam React — permanecem portáveis e testáveis, e o contrato dos jogos (`init/update/render`) não muda.

## 4. Direção visual (estilo Steam)

Inspiração no estilo — cores, densidade, layout — sem copiar logo, nome, ícones ou artes da Valve.

### Paleta

| Papel | Cor |
|---|---|
| Fundo geral | `#171A21` |
| Painéis e cards | `#1B2838` |
| Superfície elevada / placeholder de capa | `#2A475E` |
| Accent (links, bordas de hover, badges) | `#66C0F4` |
| Ação (botão Jogar/Começar) | `#A1D42A` com texto `#17250B` |
| Texto principal | `#C7D5E0` (títulos em `#FFFFFF`) |
| Texto secundário | `#8BA0B4` |
| Área de jogo / câmera | `#0E1015` |
| Cores dos jogadores (1–4) | `#66C0F4` · `#F5A623` · `#E24B4A` · `#A1D42A` |

### Tipografia

Inter (Google Fonts), pesos 400 / 600 / 700 — equivalente gratuito mais próximo da Motiva Sans usada pela Steam. Números de placar em fonte monoespaçada.

### Componentes-chave

- Header fixo com logo, navegação (Biblioteca, Como funciona, Ajustes) e busca.
- Hero de destaque: capa grande do jogo recomendado + descrição + botão verde "Jogar".
- Grade de "cápsulas": cards com capa, título e **badge do tipo de controle** ("Mãos", "Corpo inteiro", "Movimento") — informação mais importante antes de escolher, análoga ao "suporte a controle" da Steam.
- Card tracejado "em breve" reservando espaço na grade (novos jogos aparecem sozinhos via registro).
- Hover: borda azul `#66C0F4` e leve destaque.
- Cards podem exibir "seu recorde: N" lido do `localStorage`.

## 5. Fluxo de telas

```
Biblioteca → Seleção de modo → Lobby → Teste de alcance → Contagem → Partida → Resultado
                                  ↑__________________________|            |
                                  (jogador some do quadro)                ↓
                                  Biblioteca ←── jogar de novo ────── Resultado
```

### 5.1 Biblioteca (menu inicial)

Grade de jogos gerada automaticamente a partir dos manifestos (`registry.js`). A câmera **não** é ativada aqui — pedir permissão logo de cara assusta o usuário.

### 5.2 Seleção de modo

Após clicar em "Jogar": escolha de modo (solo, coop, versus — conforme o manifesto) e número de jogadores. Última tela operada por mouse/toque.

### 5.3 Lobby de entrada (por gestos)

- Fundo: vídeo da câmera ao vivo, **espelhado** — cada pessoa se enxerga e se alinha à própria faixa sem instrução.
- Quadro dividido em faixas verticais **pelo número de jogadores confirmados** (2 jogadores = 2 faixas largas), não pelo máximo do jogo.
- Estados de cada faixa: **livre** → **detectada** (acenou; entra, ganha cor e número) → **pronta** (joinha, ou mão parada por 2 s).
- Jogador confirmado que some da faixa por mais de 5 s: a faixa volta a "livre".
- Botão "Começar com N jogadores": texto dinâmico; habilita ao atingir o mínimo do manifesto; acionado por **hover-to-press** (segurar a mão sobre o botão por 2 s, com anel de progresso enchendo — padrão Kinect).
- Princípio geral: todo o lobby é operável por gestos; ninguém está perto do teclado.

### 5.4 Teste de alcance (calibração)

- Cada jogador vê a **moldura tracejada da sua área de controle** na própria cor, sobre o vídeo, com um alvo em cada canto.
- Tocar os 4 cantos com o cursor prova o alcance; quando todos terminam, a contagem inicia sozinha.
- **É calibração, não só visualização**: o núcleo mede o alcance real (criança, pessoa sentada, distância da câmera). Canto não alcançado em alguns segundos → o núcleo aproxima o canto e **encolhe a fronteira lógica daquele jogador**, ajustando a renormalização individualmente.
- Pode ser pulado por gesto (segurar a mão sobre "pular"); o manifesto declara `testeDeAlcance: 'obrigatorio' | 'opcional'`.

### 5.5 Contagem regressiva

3-2-1 na tela. Se um jogador sumir do quadro durante a contagem, volta ao lobby.

### 5.6 Partida (HUD)

- Placar + combo no canto superior esquerdo (fonte mono); vidas (corações) no superior direito; botão de pausa no canto.
- **Pill de status da detecção** na base central — o elemento mais importante da tela: detecção caiu → fica vermelho ("mostre sua mão"), o jogo pausa sozinho. No multiplayer, aviso por jogador ("Jogador 3 saiu do quadro").
- Miniatura da câmera no canto inferior direito (ocultável nos ajustes) para o jogador se enquadrar.
- Cursor: anel tracejado na cor do jogador, que "fecha" ao detectar gesto de pinça — feedback do gesto.
- Fronteira de controle: invisível durante o jogo; reaparece esmaecida na cor do jogador quando o cursor dele se aproxima da borda.

### 5.7 Resultado

Placar final, recorde, ranking entre jogadores (versus) ou resultado da equipe (coop). Ações: jogar de novo · voltar à biblioteca — também acionáveis por gesto.

## 6. Arquitetura da plataforma

### 6.1 Camadas

```
┌──────────────────────────────────────────────────┐
│ JOGOS (plugins)                                   │
│  Pega-Frutas · Desvia! · novo jogo = nova pasta   │
├──────────────────────────────────────────────────┤
│ NÚCLEO DA PLATAFORMA                              │
│  GameHost (loop, ciclo de vida, pausa)            │
│  HUD compartilhado (placar, vidas, status)        │
│  Serviços (áudio, recordes, telas, lobby,         │
│  teste de alcance)                                │
├──────────────────────────────────────────────────┤
│ RESOLVEDOR DE CAPACIDADES                         │
│  casa o que o jogo precisa ↔ rastreador           │
├──────────────────────────────────────────────────┤
│ RASTREADORES (trocáveis)                          │
│  Mãos (MediaPipe Hands)                           │
│  Corpo inteiro (MediaPipe Pose)                   │
│  Multi-pessoa (MoveNet MultiPose)                 │
│  Movimento (diferença de frames)                  │
└──────────────────────────────────────────────────┘
```

Princípio: **inversão de controle**. Os jogos não são programas completos — são plugins. O núcleo é dono do canvas, do loop, do HUD, da pausa e das telas. O custo de adicionar o jogo nº 7 é apenas a lógica dele.

### 6.2 Contrato do jogo

```js
export class Game {
  init({ jogadores, modo, viewports, audio, pontuar, largura, altura }) {}
  update(dt, controles) {}     // controles[i] = estado do jogador i
  render(ctx, viewport) {}     // chamado uma vez por viewport
  destroy() {}
}
```

### 6.3 Manifesto (separado da lógica, com lazy loading)

```js
// games/pegaFrutas/manifest.js
export default {
  id: 'pega-frutas',
  titulo: 'Pega-Frutas',
  capa: 'capa.png',
  descricao: 'Use sua mão como cursor e pegue as frutas antes que caiam.',
  jogadores: { min: 1, max: 4 },
  modos: ['solo', 'coop', 'versus'],
  telaDividida: false,               // false = arena compartilhada
  testeDeAlcance: 'opcional',
  capacidades: ['cursor'],           // o que o jogo PRECISA (não qual rastreador)
  carregar: () => import('./game.js'), // code splitting automático do Vite: baixa só ao clicar em Jogar
};
```

A biblioteca carrega apenas os manifestos (leves) e abre instantaneamente mesmo com 20 jogos.

### 6.4 Contrato do rastreador e estado de controle

```js
export class Tracker {
  static capacidades = ['cursor', 'gestos'];  // o que esta implementação oferece
  async start(videoElement) {}
  stop() {}
  getState() {
    return [                          // um item por jogador (array desde o dia 1)
      {
        cursor: { x: 0.5, y: 0.5 },   // normalizado 0–1, já renormalizado por zona
        gestures: { pinch: false, thumbsUp: false, wave: false },
        points: [],                   // pontos brutos (opcional)
        ativo: true,                  // detecção deste jogador está ok
        confidence: 0.9,
      },
    ];
  }
}

const tracker = createTracker(capacidadesNecessarias); // via resolvedor
```

### 6.5 Tabela de capacidades

| Capacidade | Mãos | Corpo inteiro | Multi-pessoa | Movimento |
|---|---|---|---|---|
| `cursor` (posição x, y) | ✓ | ✓ (punho) | ✓ | ✓ |
| `gestos` (pinça, joinha, aceno) | ✓ | ✓ | ✓ | — |
| `pose` (esqueleto completo) | — | ✓ | ✓ | — |
| `zonas` (atividade por região) | — | — | — | ✓ |

O jogo declara capacidades, o resolvedor encontra rastreadores compatíveis e o jogador pode escolher entre eles nos ajustes. Um rastreador novo dá suporte automático a todos os jogos compatíveis já existentes.

Nota: MediaPipe Pose detecta **uma** pessoa; jogos de corpo inteiro com 2+ jogadores exigem MoveNet MultiPose (TensorFlow.js), que entra como mais um rastreador plugável.

## 7. Divisão de responsabilidades: núcleo × jogo

Regra de decisão: **o núcleo responde "quem está jogando, onde está e o que cada um está fazendo"; o jogo responde "o que isso significa na partida"**. Na dúvida: se dois jogos diferentes implementariam idêntico, sobe para o núcleo.

| Responsabilidade | Onde | Por quê |
|---|---|---|
| Lobby de entrada ("acene na sua zona") | Núcleo | Idêntico para todo jogo |
| Atribuição mão→jogador e identidade estável entre frames | Núcleo | Problema de rastreamento, não de regra |
| Renormalização do cursor por zona | Núcleo | Infraestrutura de controle |
| Teste de alcance e calibração por jogador | Núcleo | O jogo recebe controles já calibrados |
| Cores, nomes e HUD por jogador (placar, vidas, combo) | Núcleo | Consistência entre jogos |
| Aviso e pausa quando um jogador sai do quadro | Núcleo | Igual em qualquer jogo |
| Recorte de viewports na tela dividida | Núcleo | Manipulação de canvas é infraestrutura |
| Ranking final e recordes por modo | Núcleo | Tela de resultado compartilhada |
| Utilitários de física (círculo-círculo, ponto-retângulo) | Núcleo (biblioteca opcional) | Todo jogo precisa |
| Condições de vitória e derrota | Jogo | É a regra |
| O que cada jogador pode fazer e como interagem | Jogo | É a regra |
| Significado de coop vs versus (pontos compartilhados? roubo?) | Jogo | Semântica varia por jogo |
| Objetos, física aplicada, ritmo, dificuldade | Jogo | Conteúdo |
| O que desenhar em cada viewport | Jogo | Conteúdo |

### Casos de fronteira (decisões registradas)

- **Modos coop/versus** — o núcleo conhece só o rótulo (para montar HUD e resultado certos: placar único no coop, um por jogador no versus). O significado do modo dentro da partida é 100% do jogo; o núcleo nunca implementa "regras de coop genéricas".
- **Tela dividida** — o núcleo divide o canvas, aplica recorte e chama `render(ctx, viewport)` por jogador. O jogo desenha o mundo daquele ponto de vista sem saber quantas divisões existem; apenas declara `telaDividida` no manifesto.
- **Pontuação** — o jogo decide quando e quanto (`pontuar(jogador, valor)`); o núcleo armazena, exibe, calcula combos e persiste recordes. Nenhum jogo desenha placar; o núcleo não conhece regra.
- **Colisão** — utilitários no núcleo; a consequência (perder vida? pegar fruta?) sempre no jogo.

## 8. Multiplayer local (até 4 jogadores, 1 câmera)

### 8.1 Zonas e identidade

O rastreador devolve "4 mãos detectadas", mas não diz de quem é cada uma. Solução no núcleo: dividir o quadro da câmera em faixas verticais, uma por jogador confirmado, e manter a identidade estável entre frames. O jogo recebe `controles[0..3]`.

### 8.2 Renormalização e calibração

O cursor de cada jogador é normalizado **dentro da própria faixa** (0–1 relativo a ela) — sem isso, o jogador 4 só alcançaria o canto direito da tela. O teste de alcance refina essa fronteira por jogador conforme o alcance físico real.

### 8.3 Realismo físico

2 jogadores é o confortável numa webcam comum; 4 pedem câmera de campo amplo e distância. Por isso `max` fica no manifesto e o pré-jogo pode avisar: "este jogo com 4 jogadores pede mais espaço". Performance: 4 mãos a 30 fps é pesado — usar `modelComplexity: 0` e resolução 640×480.

## 9. Estrutura de pastas

```
site/
├─ index.html
├─ package.json
├─ vite.config.js
└─ src/
   ├─ main.jsx            → bootstrap do React
   ├─ App.jsx             → máquina de telas (biblioteca → … → resultado)
   ├─ core/               → SEM React: módulos imperativos
   │  ├─ gameHost.js      → loop, ciclo de vida, pausa automática, viewports
   │  ├─ audio.js         → sons compartilhados + sons do jogo
   │  ├─ fisica.js        → utilitários de colisão (opcional aos jogos)
   │  └─ scores.js        → recordes por jogo/modo (localStorage)
   ├─ tracking/           → SEM React
   │  ├─ tracker.js       → contrato comum + capacidades declaradas
   │  ├─ resolver.js      → casa capacidades ↔ rastreadores disponíveis
   │  ├─ zonas.js         → atribuição de jogadores, renormalização e calibração de alcance
   │  ├─ handTracker.js
   │  ├─ poseTracker.js
   │  ├─ multiPoseTracker.js
   │  └─ motionTracker.js
   ├─ games/              → SEM React: cada jogo é um plugin de canvas
   │  ├─ registry.js      → importa só os manifestos
   │  └─ pegaFrutas/
   │     ├─ manifest.js
   │     ├─ game.js
   │     └─ capa.png
   ├─ hooks/              → ponte entre os módulos imperativos e o React
   │  ├─ useTracker.js    → liga/desliga o rastreamento, expõe estado leve
   │  ├─ useGameHost.js   → monta o host no canvas via ref (useEffect)
   │  └─ useHoverPress.js → botões acionados por segurar a mão (2 s)
   └─ ui/                 → componentes React (estilo Steam)
      ├─ Biblioteca.jsx
      ├─ SelecaoDeModo.jsx
      ├─ Lobby.jsx
      ├─ TesteDeAlcance.jsx
      ├─ Partida.jsx      → canvas + HUD atualizado por evento
      └─ Resultado.jsx
```

Mudanças em relação à versão vanilla: `screens.js` vira o `App.jsx`; `hud.js`, `lobby.js` e `alcance.js` viram componentes React em `ui/`, com a matemática de calibração movida para `tracking/zonas.js`; e a pasta `hooks/` é a única ponte entre o mundo imperativo (canvas, rastreadores) e o mundo declarativo (React).

## 10. Roadmap

| Fase | Entrega | Duração estimada |
|---|---|---|
| 0 — Definições | Primeiro jogo escolhido (Pega-Frutas), repositório criado com scaffold React + Vite (`npm create vite@latest`) | 1–2 dias |
| 1 — Prova de conceito | Câmera + contrato `Tracker` + rastreador de mãos + hook `useTracker` + cursor na tela; valida latência e precisão (`controles` já nasce como array) | 3–5 dias |
| 2 — Núcleo + primeiro jogo | GameHost, HUD, máquina de telas mínima; Pega-Frutas como primeiro plugin (`init/update/render`) | 1–2 semanas |
| 3 — Biblioteca e polimento | Visual Steam completo, `registry.js`, pré-jogo, sons, recordes, tratamento de erros (câmera negada, pouca luz) | 1 semana |
| 4 — Publicação | Deploy (HTTPS), testes em máquinas fracas e celulares, ajustes de performance | alguns dias |
| 5 — Multiplayer local | Zonas + identidade, lobby por gestos, teste de alcance, coop/versus, tela dividida | 2 semanas |
| 6 — Expansão | 2º jogo (teste real da arquitetura: deve nascer em dias), rastreador de corpo, MoveNet MultiPose, ranking online (primeiro item que exige backend) | contínuo |

Marcos de validação: **Fase 1** — o cursor responde bem? Se sim, o resto é jogo. **Fase 6** — o segundo jogo nasceu em poucos dias só com `init/update/render`? Se sim, a arquitetura provou seu valor.

## 11. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Máquinas fracas não rodam o modelo a 30 fps | Modelo "lite" (`modelComplexity: 0`), resolução 640×480, degradar para menos fps antes de travar |
| Iluminação ruim degrada a detecção | Feedback visual constante ("mão detectada"), instruções no pré-jogo, pausa automática |
| Variação grande entre celulares | Testar cedo (desde a Fase 1), não deixar para o final |
| 4 jogadores no mesmo quadro | Faixas adaptativas, aviso de espaço no pré-jogo, `max` no manifesto |
| Jogador não alcança os cantos da sua área | Calibração individual no teste de alcance |
| Desconfiança com a câmera | Aviso de privacidade: o vídeo nunca sai do dispositivo (verdadeiro nesta arquitetura) |
| Re-renders do React derrubando o fps do jogo | Loop e canvas fora do React (refs + `useEffect`); HUD atualiza por evento, nunca por frame; hooks só expõem estado leve |
| Acoplamento jogo↔rastreador | Capacidades no manifesto + resolvedor; jogos nunca falam com o MediaPipe |

## 12. Princípios de projeto (resumo)

1. **Inversão de controle** — a plataforma roda o jogo; o jogo implementa 4 funções.
2. **Capacidades, não rastreadores** — jogos declaram o que precisam; o resolvedor encontra quem entrega.
3. **Tudo pré-partida é operável por gestos** — ninguém está perto do mouse.
4. **Controles chegam calibrados** — zonas, renormalização e alcance são invisíveis para o jogo.
5. **Se dois jogos implementariam idêntico, é núcleo** — a regra que decide onde vive cada lógica.
6. **Privacidade por arquitetura** — nenhum vídeo sai do navegador.
7. **React na interface, imperativo no jogo** — `core/`, `tracking/` e `games/` não importam React; a pasta `hooks/` é a única ponte entre os dois mundos.
