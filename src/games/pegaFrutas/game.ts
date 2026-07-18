import type { Game, GameInitParams, Viewport } from '../types'
import type { ControlState } from '../../tracking/tracker'
import { corDoJogador } from '../../core/jogadores'

type TipoFruta = 'maca' | 'laranja' | 'lima' | 'uva'

interface Fruta {
  x: number
  y: number
  raio: number
  velocidade: number
  tipo: TipoFruta
  zona: number
}

const RAIO_FRUTA = 18
const RAIO_CAPTURA = 34
const MARGEM_LATERAL = RAIO_FRUTA * 3
const INTERVALO_SPAWN_MS = 900
const VELOCIDADE_MIN = 90
const VELOCIDADE_MAX = 160
const TIPOS_FRUTA: TipoFruta[] = ['maca', 'laranja', 'lima', 'uva']
const CORES_FRUTA: Record<TipoFruta, { clara: string; escura: string }> = {
  maca: { clara: '#FF7A70', escura: '#E24B4A' },
  laranja: { clara: '#FFC66B', escura: '#F5A623' },
  lima: { clara: '#C7ED5E', escura: '#A1D42A' },
  uva: { clara: '#9DD9F7', escura: '#66C0F4' },
}

export default class PegaFrutas implements Game {
  private altura = 0
  private jogadores = 1
  private viewports: Viewport[] = []
  private pontuar: GameInitParams['pontuar'] = () => {}
  private perderVida: GameInitParams['perderVida'] = () => {}
  private frutas: Fruta[] = []
  private tempoDesdeSpawn: number[] = []

  init(params: GameInitParams) {
    this.altura = params.altura
    this.jogadores = params.jogadores
    this.viewports = params.viewports
    this.pontuar = params.pontuar
    this.perderVida = params.perderVida
    this.frutas = []
    this.tempoDesdeSpawn = this.viewports.map(() => 0)
  }

  update(dt: number, controles: ControlState[]) {
    // Tela dividida (versus): cada viewport é a zona exclusiva do jogador de mesmo índice,
    // com spawn, colisão e vida próprios. Arena única (solo/coop): todos disputam as mesmas
    // frutas e uma queda penaliza todo mundo que estava ativo.
    const dividido = this.viewports.length > 1

    this.viewports.forEach((viewport, zona) => {
      this.tempoDesdeSpawn[zona] += dt * 1000
      if (this.tempoDesdeSpawn[zona] >= INTERVALO_SPAWN_MS) {
        this.tempoDesdeSpawn[zona] = 0
        this.spawnFruta(zona, viewport)
      }
    })

    const cursores = controles.slice(0, this.jogadores).map((c, i) => {
      const viewport = dividido ? this.viewports[i] : this.viewports[0]
      return {
        ativo: c.ativo,
        x: c.cursor.x * viewport.largura,
        y: c.cursor.y * viewport.altura,
      }
    })

    this.frutas = this.frutas.filter((fruta) => {
      fruta.y += fruta.velocidade * dt

      if (dividido) {
        const cursor = cursores[fruta.zona]
        if (cursor?.ativo) {
          const distancia = Math.hypot(fruta.x - cursor.x, fruta.y - cursor.y)
          if (distancia < RAIO_CAPTURA) {
            this.pontuar(fruta.zona, 1)
            return false
          }
        }
        if (fruta.y - fruta.raio > this.viewports[fruta.zona].altura) {
          this.perderVida(fruta.zona)
          return false
        }
        return true
      }

      for (let i = 0; i < cursores.length; i++) {
        const cursor = cursores[i]
        if (!cursor.ativo) continue
        const distancia = Math.hypot(fruta.x - cursor.x, fruta.y - cursor.y)
        if (distancia < RAIO_CAPTURA) {
          this.pontuar(i, 1)
          return false
        }
      }

      if (fruta.y - fruta.raio > this.altura) {
        cursores.forEach((cursor, i) => {
          if (cursor.ativo) this.perderVida(i)
        })
        return false
      }
      return true
    })
  }

  render(ctx: CanvasRenderingContext2D, viewport: Viewport, indice: number) {
    const dividido = this.viewports.length > 1

    ctx.fillStyle = '#0e1015'
    ctx.fillRect(viewport.x, viewport.y, viewport.largura, viewport.altura)

    if (dividido) {
      ctx.strokeStyle = corDoJogador(indice)
      ctx.lineWidth = 3
      ctx.strokeRect(viewport.x + 1.5, viewport.y + 1.5, viewport.largura - 3, viewport.altura - 3)
    }

    for (const fruta of this.frutas) {
      if (dividido && fruta.zona !== indice) continue
      this.desenharFruta(ctx, viewport.x + fruta.x, viewport.y + fruta.y, fruta.raio, fruta.tipo)
    }
  }

  destroy() {
    this.frutas = []
  }

  private desenharFruta(ctx: CanvasRenderingContext2D, x: number, y: number, raio: number, tipo: TipoFruta) {
    const cores = CORES_FRUTA[tipo]

    if (tipo === 'uva') {
      const raioBago = raio * 0.62
      const offsets: Array<[number, number]> = [
        [0, -raioBago * 0.65],
        [-raioBago * 0.75, raioBago * 0.55],
        [raioBago * 0.75, raioBago * 0.55],
      ]
      for (const [dx, dy] of offsets) {
        this.desenharCirculoGradiente(ctx, x + dx, y + dy, raioBago, cores)
      }
      return
    }

    this.desenharCirculoGradiente(ctx, x, y, raio, cores)

    if (tipo === 'maca') {
      ctx.fillStyle = '#7A9A3A'
      ctx.save()
      ctx.translate(x - raio * 0.15, y - raio * 0.85)
      ctx.rotate((18 * Math.PI) / 180)
      ctx.fillRect(-raio * 0.1, -raio * 0.3, raio * 0.22, raio * 0.45)
      ctx.restore()
    }
  }

  private desenharCirculoGradiente(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    raio: number,
    cores: { clara: string; escura: string },
  ) {
    const gradiente = ctx.createRadialGradient(
      x - raio * 0.3,
      y - raio * 0.3,
      raio * 0.1,
      x,
      y,
      raio,
    )
    gradiente.addColorStop(0, cores.clara)
    gradiente.addColorStop(1, cores.escura)
    ctx.fillStyle = gradiente
    ctx.beginPath()
    ctx.arc(x, y, raio, 0, Math.PI * 2)
    ctx.fill()
  }

  private spawnFruta(zona: number, viewport: Viewport) {
    const margem = Math.min(MARGEM_LATERAL, viewport.largura / 2 - RAIO_FRUTA)
    const inicio = RAIO_FRUTA + Math.max(margem, 0)
    const fim = viewport.largura - RAIO_FRUTA - Math.max(margem, 0)
    this.frutas.push({
      zona,
      x: inicio + Math.random() * Math.max(fim - inicio, 0),
      y: -RAIO_FRUTA,
      raio: RAIO_FRUTA,
      velocidade: VELOCIDADE_MIN + Math.random() * (VELOCIDADE_MAX - VELOCIDADE_MIN),
      tipo: TIPOS_FRUTA[Math.floor(Math.random() * TIPOS_FRUTA.length)],
    })
  }
}
