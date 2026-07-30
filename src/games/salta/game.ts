import type { Game, GameInitParams, Viewport } from '../types'
import type { ControlState } from '../../tracking/tracker'
import { bboxDeKeypoints } from '../../tracking/poseUtils'
import { corDoJogador } from '../../core/jogadores'

type TipoElemento = 'buraco' | 'inimigo' | 'moeda'

interface Elemento {
  zona: number
  tipo: TipoElemento
  x: number // px, coordenadas do viewport da própria zona
  largura: number // extensão horizontal usada tanto pra colisão quanto pra desenho
}

interface Personagem {
  pulando: boolean
  tempoPulo: number // s decorridos desde o início do pulo atual
}

// Corredor automático: o personagem sempre avança sozinho (sem controle de X), então o único
// comando do jogador é o pulo, detectado por um salto físico de verdade em frente à câmera.
const POS_X_PERSONAGEM_FRACAO = 0.24
const FRACAO_CHAO = 0.76
const LARGURA_PERSONAGEM = 42
const ALTURA_PERSONAGEM = 56

// Detecção de pulo: em vez de medir velocidade vertical (frágil, porque o PoseTracker só
// atualiza a cada detecção do modelo, não a cada frame do jogo — dividir por um dt de frame
// pequeno gera picos falsos), comparamos a altura atual do centro do corpo com uma "linha de
// base" que segue lentamente a posição de repouso do jogador (EMA, só atualizada fora do
// pulo). Um deslocamento repentino pra cima em relação a essa base dispara o pulo do jogo.
const LIMIAR_DESLOCAMENTO_SALTO = 0.07 // fração da altura do quadro (0-1)
const FATOR_EMA_BASELINE_POR_S = 3
const COOLDOWN_SALTO_S = 0.45
const DURACAO_PULO_S = 0.62
const ALTURA_PULO_PX = 130
const ALTURA_MIN_CLEARANCE_PX = 32 // altura mínima no ar pra passar por cima de buraco/inimigo

const INTERVALO_SPAWN_MS = 1300
const VELOCIDADE_MUNDO_INICIAL = 230 // px/s
const VELOCIDADE_MUNDO_MAX = 420
const ACELERACAO_MUNDO_POR_S = 5 // dificuldade sobe com o tempo de corrida

const RAIO_INIMIGO = 22
const RAIO_MOEDA = 13
const LARGURA_BURACO = 74
const ALTURA_MOEDA_PX = 95 // altura (a partir do chão) em que a moeda fica no ar
const TOLERANCIA_MOEDA_PX = 45

// Pontuação por evento (não por frame, seguindo o padrão do núcleo): cada obstáculo desviado
// com sucesso vale como "distância percorrida"; moedas são bônus. Não existe pontuação
// contínua por metro pra não disparar o som de ponto a cada frame.
const PONTOS_OBSTACULO = 1
const PONTOS_MOEDA = 3

export default class Salta implements Game {
  private jogadores = 1
  private viewports: Viewport[] = []
  private pontuar: GameInitParams['pontuar'] = () => {}
  private perderVida: GameInitParams['perderVida'] = () => {}

  private elementos: Elemento[] = []
  private personagens: Personagem[] = []
  private baselineY: (number | null)[] = []
  private cooldownSalto: number[] = []
  // Espelha localmente o vidas[] do núcleo (GameHost só decrementa via perderVida, não expõe
  // o valor atual) — necessário pra parar de gerar/mover obstáculos da zona de quem já saiu no
  // versus, sem interromper a pista do outro jogador.
  private vidasRestantes: number[] = []
  private tempoDesdeSpawn: number[] = []
  private indiceSpawn: number[] = []
  private tempoDecorrido: number[] = []
  private distanciaPercorrida: number[] = []
  // Mesma semente pras duas pistas: em versus, cada jogador tem sua própria metade de tela,
  // mas como os timers de spawn avançam em lockstep (mesmo dt, mesmo intervalo fixo), usar uma
  // função determinística de (semente, índice do spawn) garante o mesmo layout de obstáculos e
  // moedas nas duas pistas — corrida justa, sem precisar sincronizar um stream de RNG.
  private semente = 0

  init(params: GameInitParams) {
    this.jogadores = params.jogadores
    this.viewports = params.viewports
    this.pontuar = params.pontuar
    this.perderVida = params.perderVida
    this.semente = Math.floor(Math.random() * 1_000_000_000)

    this.elementos = []
    this.personagens = Array.from({ length: params.jogadores }, () => ({ pulando: false, tempoPulo: 0 }))
    this.baselineY = Array(params.jogadores).fill(null)
    this.cooldownSalto = Array(params.jogadores).fill(0)
    this.vidasRestantes = Array(params.jogadores).fill(params.vidasIniciais)
    this.tempoDesdeSpawn = Array(params.jogadores).fill(0)
    this.indiceSpawn = Array(params.jogadores).fill(0)
    this.tempoDecorrido = Array(params.jogadores).fill(0)
    this.distanciaPercorrida = Array(params.jogadores).fill(0)
  }

  update(dt: number, controles: ControlState[]) {
    const dividido = this.viewports.length > 1

    for (let i = 0; i < this.jogadores; i++) {
      if (this.vidasRestantes[i] <= 0) continue

      const viewport = this.viewports[dividido ? i : 0]
      this.detectarSalto(i, dt, controles[i])
      this.atualizarArcoDoPulo(i, dt)

      this.tempoDecorrido[i] += dt
      const velocidadeMundo = this.velocidadeMundo(i)
      this.distanciaPercorrida[i] += velocidadeMundo * dt

      this.tempoDesdeSpawn[i] += dt * 1000
      if (this.tempoDesdeSpawn[i] >= INTERVALO_SPAWN_MS) {
        this.tempoDesdeSpawn[i] -= INTERVALO_SPAWN_MS
        this.spawnElemento(i, viewport, this.indiceSpawn[i])
        this.indiceSpawn[i] += 1
      }
    }

    this.elementos = this.elementos.filter((elemento) => {
      if (this.vidasRestantes[elemento.zona] <= 0) return false

      const viewport = this.viewports[dividido ? elemento.zona : 0]
      elemento.x -= this.velocidadeMundo(elemento.zona) * dt

      const personagem = this.personagens[elemento.zona]
      const posXPersonagem = viewport.largura * POS_X_PERSONAGEM_FRACAO
      const meiaLarguraPersonagem = LARGURA_PERSONAGEM / 2
      const meiaLarguraElemento = elemento.largura / 2
      const sobrepoeX =
        elemento.x + meiaLarguraElemento > posXPersonagem - meiaLarguraPersonagem &&
        elemento.x - meiaLarguraElemento < posXPersonagem + meiaLarguraPersonagem

      if (elemento.tipo === 'moeda') {
        if (sobrepoeX && Math.abs(this.alturaSalto(personagem) - ALTURA_MOEDA_PX) < TOLERANCIA_MOEDA_PX) {
          this.pontuar(elemento.zona, PONTOS_MOEDA)
          return false
        }
      } else {
        if (sobrepoeX && this.alturaSalto(personagem) < ALTURA_MIN_CLEARANCE_PX) {
          this.vidasRestantes[elemento.zona] = Math.max(0, this.vidasRestantes[elemento.zona] - 1)
          this.perderVida(elemento.zona)
          return false
        }
        if (elemento.x + meiaLarguraElemento < posXPersonagem - meiaLarguraPersonagem) {
          this.pontuar(elemento.zona, PONTOS_OBSTACULO)
          return false
        }
      }

      return elemento.x + meiaLarguraElemento > -50
    })
  }

  render(ctx: CanvasRenderingContext2D, viewport: Viewport, indice: number) {
    const dividido = this.viewports.length > 1
    const yChao = viewport.y + viewport.altura * FRACAO_CHAO

    this.desenharFundo(ctx, viewport, yChao, indice)

    if (dividido) {
      ctx.strokeStyle = corDoJogador(indice)
      ctx.lineWidth = 3
      ctx.strokeRect(viewport.x + 1.5, viewport.y + 1.5, viewport.largura - 3, viewport.altura - 3)
    }

    for (const elemento of this.elementos) {
      if (elemento.zona !== indice) continue
      const cx = viewport.x + elemento.x
      if (elemento.tipo === 'buraco') this.desenharBuraco(ctx, cx, yChao, elemento.largura)
      else if (elemento.tipo === 'inimigo') this.desenharInimigo(ctx, cx, yChao)
      else this.desenharMoeda(ctx, cx, yChao, this.tempoDecorrido[indice])
    }

    this.desenharPersonagem(ctx, viewport, yChao, indice)

    if (this.vidasRestantes[indice] <= 0) {
      ctx.fillStyle = 'rgba(14, 16, 21, 0.65)'
      ctx.fillRect(viewport.x, viewport.y, viewport.largura, viewport.altura)
      ctx.fillStyle = '#e24b4a'
      ctx.font = '700 28px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Fora!', viewport.x + viewport.largura / 2, viewport.y + viewport.altura / 2)
    }
  }

  destroy() {
    this.elementos = []
  }

  private velocidadeMundo(zona: number): number {
    return Math.min(VELOCIDADE_MUNDO_MAX, VELOCIDADE_MUNDO_INICIAL + this.tempoDecorrido[zona] * ACELERACAO_MUNDO_POR_S)
  }

  private alturaSalto(personagem: Personagem): number {
    if (!personagem.pulando) return 0
    const progresso = Math.min(personagem.tempoPulo / DURACAO_PULO_S, 1)
    return ALTURA_PULO_PX * Math.sin(Math.PI * progresso)
  }

  private detectarSalto(zona: number, dt: number, controle: ControlState | undefined) {
    this.cooldownSalto[zona] = Math.max(0, this.cooldownSalto[zona] - dt)
    if (!controle?.ativo) return

    const bbox = bboxDeKeypoints(controle.points)
    if (!bbox) return

    const centroY = bbox.y + bbox.altura / 2
    if (this.baselineY[zona] === null) {
      this.baselineY[zona] = centroY
      return
    }

    const base = this.baselineY[zona] as number
    const personagem = this.personagens[zona]
    const deslocamento = base - centroY // positivo = corpo subiu em relação à base

    if (!personagem.pulando && this.cooldownSalto[zona] <= 0 && deslocamento > LIMIAR_DESLOCAMENTO_SALTO) {
      personagem.pulando = true
      personagem.tempoPulo = 0
      this.cooldownSalto[zona] = COOLDOWN_SALTO_S
    }

    if (!personagem.pulando) {
      const fator = Math.min(1, FATOR_EMA_BASELINE_POR_S * dt)
      this.baselineY[zona] = base + (centroY - base) * fator
    }
  }

  private atualizarArcoDoPulo(zona: number, dt: number) {
    const personagem = this.personagens[zona]
    if (!personagem.pulando) return
    personagem.tempoPulo += dt
    if (personagem.tempoPulo >= DURACAO_PULO_S) {
      personagem.pulando = false
      personagem.tempoPulo = 0
    }
  }

  private spawnElemento(zona: number, viewport: Viewport, indiceSpawn: number) {
    const r = rngDeterministico(this.semente, indiceSpawn)
    let tipo: TipoElemento
    let largura: number
    if (r < 0.4) {
      tipo = 'buraco'
      largura = LARGURA_BURACO
    } else if (r < 0.75) {
      tipo = 'inimigo'
      largura = RAIO_INIMIGO * 2
    } else {
      tipo = 'moeda'
      largura = RAIO_MOEDA * 2
    }
    this.elementos.push({ zona, tipo, largura, x: viewport.largura + largura })
  }

  private desenharFundo(ctx: CanvasRenderingContext2D, viewport: Viewport, yChao: number, indice: number) {
    const ceu = ctx.createLinearGradient(0, viewport.y, 0, yChao)
    ceu.addColorStop(0, '#5fb4f0')
    ceu.addColorStop(1, '#bfe6ff')
    ctx.fillStyle = ceu
    ctx.fillRect(viewport.x, viewport.y, viewport.largura, yChao - viewport.y)

    ctx.fillStyle = '#4f9a3a'
    ctx.fillRect(viewport.x, yChao, viewport.largura, 12)

    ctx.fillStyle = '#8a5a34'
    ctx.fillRect(viewport.x, yChao + 12, viewport.largura, viewport.y + viewport.altura - (yChao + 12))

    // Listras se movendo no chão pra reforçar a sensação de corrida automática.
    const LARGURA_LISTRA = 46
    const deslocamento = this.distanciaPercorrida[indice] % LARGURA_LISTRA
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'
    for (let x = viewport.largura + deslocamento; x > -LARGURA_LISTRA; x -= LARGURA_LISTRA) {
      ctx.fillRect(viewport.x + x - 10, yChao + 14, 10, viewport.y + viewport.altura - yChao - 18)
    }
  }

  private desenharBuraco(ctx: CanvasRenderingContext2D, cx: number, yChao: number, largura: number) {
    const gradiente = ctx.createRadialGradient(cx, yChao, 2, cx, yChao, largura / 2)
    gradiente.addColorStop(0, '#000000')
    gradiente.addColorStop(1, '#1c1208')
    ctx.fillStyle = gradiente
    ctx.beginPath()
    ctx.ellipse(cx, yChao, largura / 2, 10, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  private desenharInimigo(ctx: CanvasRenderingContext2D, cx: number, yChao: number) {
    const cy = yChao - RAIO_INIMIGO * 0.8
    const gradiente = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, RAIO_INIMIGO)
    gradiente.addColorStop(0, '#c9714f')
    gradiente.addColorStop(1, '#8a3f24')
    ctx.fillStyle = gradiente
    ctx.beginPath()
    ctx.arc(cx, cy, RAIO_INIMIGO, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#8a3f24'
    ctx.fillRect(cx - RAIO_INIMIGO * 0.7, cy + RAIO_INIMIGO * 0.7, RAIO_INIMIGO * 0.4, RAIO_INIMIGO * 0.4)
    ctx.fillRect(cx + RAIO_INIMIGO * 0.3, cy + RAIO_INIMIGO * 0.7, RAIO_INIMIGO * 0.4, RAIO_INIMIGO * 0.4)

    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(cx - 7, cy - 2, 5, 0, Math.PI * 2)
    ctx.arc(cx + 7, cy - 2, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath()
    ctx.arc(cx - 7, cy - 2, 2.2, 0, Math.PI * 2)
    ctx.arc(cx + 7, cy - 2, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }

  private desenharMoeda(ctx: CanvasRenderingContext2D, cx: number, yChao: number, tempo: number) {
    const cy = yChao - ALTURA_MOEDA_PX
    const escalaX = Math.max(0.25, Math.abs(Math.cos(tempo * 4)))
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(escalaX, 1)
    const gradiente = ctx.createRadialGradient(-4, -4, 1, 0, 0, RAIO_MOEDA)
    gradiente.addColorStop(0, '#fff3b0')
    gradiente.addColorStop(1, '#f0b429')
    ctx.fillStyle = gradiente
    ctx.beginPath()
    ctx.arc(0, 0, RAIO_MOEDA, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private desenharPersonagem(ctx: CanvasRenderingContext2D, viewport: Viewport, yChao: number, indice: number) {
    const personagem = this.personagens[indice]
    const alturaSalto = this.alturaSalto(personagem)
    const cx = viewport.x + viewport.largura * POS_X_PERSONAGEM_FRACAO
    const pesY = yChao - alturaSalto
    const cor = corDoJogador(indice)

    // Sombra no chão: encolhe conforme o personagem sobe, reforça a leitura de altura do pulo.
    const escalaSombra = Math.max(0.25, 1 - alturaSalto / ALTURA_PULO_PX)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.beginPath()
    ctx.ellipse(cx, yChao + 4, (LARGURA_PERSONAGEM / 2) * escalaSombra, 6 * escalaSombra, 0, 0, Math.PI * 2)
    ctx.fill()

    const alturaCorpo = ALTURA_PERSONAGEM * 0.68
    const topoCorpo = pesY - ALTURA_PERSONAGEM
    ctx.fillStyle = corPerna(cor)
    ctx.fillRect(cx - LARGURA_PERSONAGEM / 2 + 3, topoCorpo + alturaCorpo - 4, LARGURA_PERSONAGEM * 0.32, ALTURA_PERSONAGEM - alturaCorpo)
    ctx.fillRect(cx + LARGURA_PERSONAGEM / 2 - LARGURA_PERSONAGEM * 0.32 - 3, topoCorpo + alturaCorpo - 4, LARGURA_PERSONAGEM * 0.32, ALTURA_PERSONAGEM - alturaCorpo)

    ctx.fillStyle = cor
    ctx.beginPath()
    ctx.roundRect(cx - LARGURA_PERSONAGEM / 2, topoCorpo, LARGURA_PERSONAGEM, alturaCorpo, 8)
    ctx.fill()

    ctx.fillStyle = '#ffd8b0'
    ctx.beginPath()
    ctx.arc(cx, pesY - ALTURA_PERSONAGEM - ALTURA_PERSONAGEM * 0.14, ALTURA_PERSONAGEM * 0.22, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = cor
    ctx.beginPath()
    ctx.arc(cx, pesY - ALTURA_PERSONAGEM - ALTURA_PERSONAGEM * 0.26, ALTURA_PERSONAGEM * 0.24, Math.PI, 0)
    ctx.fill()
  }
}

// Tom mais escuro da cor do jogador, só pra diferenciar visualmente pernas do tronco.
function corPerna(cor: string): string {
  return cor === '#66c0f4'
    ? '#3d8fc2'
    : cor === '#f5a623'
      ? '#c47f12'
      : cor === '#e24b4a'
        ? '#a8302f'
        : '#78a01e'
}

// Hash determinístico (semente, índice) -> [0, 1). Usado pra decidir o tipo de obstáculo de
// cada spawn: como as duas pistas do versus avançam o mesmo índice de spawn no mesmo instante
// (mesmo dt, mesmo intervalo fixo), a mesma semente garante layout idêntico nas duas metades.
function rngDeterministico(semente: number, indice: number): number {
  let t = (semente ^ Math.imul(indice + 0x9e3779b9, 0x85ebca6b)) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
