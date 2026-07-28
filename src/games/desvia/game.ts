import type { Game, GameInitParams, Viewport } from '../types'
import type { ControlState } from '../../tracking/tracker'
import { bboxDeKeypoints } from '../../tracking/poseUtils'

interface Obstaculo {
  x: number // posição 0-1 normalizada ao quadro, mesma convenção do bbox da pose
  y: number
  raio: number
  raioMax: number
  velocidadeCrescimento: number // px/s (em coordenadas do canvas)
}

const INTERVALO_SPAWN_MS = 1400
const RAIO_INICIAL = 10
const RAIO_MAX_MIN = 90
const RAIO_MAX_MAX = 160
const TEMPO_CRESCIMENTO_MIN_S = 1.6
const TEMPO_CRESCIMENTO_MAX_S = 2.6
const MARGEM = 0.12

export default class Desvia implements Game {
  private largura = 0
  private altura = 0
  private jogadores = 1
  private pontuar: GameInitParams['pontuar'] = () => {}
  private perderVida: GameInitParams['perderVida'] = () => {}
  private obstaculos: Obstaculo[] = []
  private tempoDesdeSpawn = 0
  // Espelha localmente o vidas[] do núcleo (GameHost só aceita decrementar via perderVida, não
  // expõe o valor atual) — necessário pra saber quando parar de contar tempo de sobrevivência
  // e pra não pontuar duas vezes o mesmo jogador.
  private vidasRestantes: number[] = []
  private tempoSobrevivido: number[] = []

  init(params: GameInitParams) {
    this.largura = params.largura
    this.altura = params.altura
    this.jogadores = params.jogadores
    this.pontuar = params.pontuar
    this.perderVida = params.perderVida
    this.obstaculos = []
    this.tempoDesdeSpawn = 0
    this.vidasRestantes = Array(params.jogadores).fill(params.vidasIniciais)
    this.tempoSobrevivido = Array(params.jogadores).fill(0)
  }

  update(dt: number, controles: ControlState[]) {
    this.tempoDesdeSpawn += dt * 1000
    if (this.tempoDesdeSpawn >= INTERVALO_SPAWN_MS) {
      this.tempoDesdeSpawn = 0
      this.spawnObstaculo()
    }

    const jogadoresAtivos = controles.slice(0, this.jogadores)
    jogadoresAtivos.forEach((controle, i) => {
      if (controle.ativo && this.vidasRestantes[i] > 0) this.tempoSobrevivido[i] += dt
    })

    this.obstaculos = this.obstaculos.filter((obstaculo) => {
      obstaculo.raio += obstaculo.velocidadeCrescimento * dt
      if (obstaculo.raio >= obstaculo.raioMax) return false // cresceu até o fim: desvio bem-sucedido

      const cx = obstaculo.x * this.largura
      const cy = obstaculo.y * this.altura

      for (let i = 0; i < jogadoresAtivos.length; i++) {
        const controle = jogadoresAtivos[i]
        if (!controle.ativo || this.vidasRestantes[i] <= 0) continue
        const bbox = bboxDeKeypoints(controle.points)
        if (!bbox) continue
        const retangulo = {
          x: bbox.x * this.largura,
          y: bbox.y * this.altura,
          largura: bbox.largura * this.largura,
          altura: bbox.altura * this.altura,
        }
        if (circuloSobrepoeRetangulo(cx, cy, obstaculo.raio, retangulo)) {
          this.vidasRestantes[i] = Math.max(0, this.vidasRestantes[i] - 1)
          this.perderVida(i)
          if (this.vidasRestantes[i] === 0) this.pontuar(i, Math.round(this.tempoSobrevivido[i]))
          return false
        }
      }

      return true
    })
  }

  render(ctx: CanvasRenderingContext2D, viewport: Viewport) {
    ctx.fillStyle = '#0e1015'
    ctx.fillRect(viewport.x, viewport.y, viewport.largura, viewport.altura)

    for (const obstaculo of this.obstaculos) {
      const cx = viewport.x + obstaculo.x * viewport.largura
      const cy = viewport.y + obstaculo.y * viewport.altura
      const progresso = obstaculo.raio / obstaculo.raioMax

      const gradiente = ctx.createRadialGradient(cx, cy, obstaculo.raio * 0.3, cx, cy, obstaculo.raio)
      gradiente.addColorStop(0, `rgba(255, 122, 112, ${0.9 - progresso * 0.3})`)
      gradiente.addColorStop(1, `rgba(226, 75, 74, ${0.5 - progresso * 0.2})`)
      ctx.fillStyle = gradiente
      ctx.beginPath()
      ctx.arc(cx, cy, obstaculo.raio, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  destroy() {
    this.obstaculos = []
  }

  private spawnObstaculo() {
    const raioMax = RAIO_MAX_MIN + Math.random() * (RAIO_MAX_MAX - RAIO_MAX_MIN)
    const tempoCrescimento =
      TEMPO_CRESCIMENTO_MIN_S + Math.random() * (TEMPO_CRESCIMENTO_MAX_S - TEMPO_CRESCIMENTO_MIN_S)
    this.obstaculos.push({
      x: MARGEM + Math.random() * (1 - MARGEM * 2),
      y: MARGEM + Math.random() * (1 - MARGEM * 2),
      raio: RAIO_INICIAL,
      raioMax,
      velocidadeCrescimento: (raioMax - RAIO_INICIAL) / tempoCrescimento,
    })
  }
}

function circuloSobrepoeRetangulo(
  cx: number,
  cy: number,
  raio: number,
  retangulo: { x: number; y: number; largura: number; altura: number },
): boolean {
  const px = Math.max(retangulo.x, Math.min(cx, retangulo.x + retangulo.largura))
  const py = Math.max(retangulo.y, Math.min(cy, retangulo.y + retangulo.altura))
  return Math.hypot(cx - px, cy - py) < raio
}
