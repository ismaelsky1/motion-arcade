import type { Game, GameInitParams, Viewport } from '../types'
import type { ControlState } from '../../tracking/tracker'

interface Fruta {
  x: number
  y: number
  raio: number
  velocidade: number
}

const RAIO_FRUTA = 18
const RAIO_CAPTURA = 34
const INTERVALO_SPAWN_MS = 900
const VELOCIDADE_MIN = 90
const VELOCIDADE_MAX = 160

export default class PegaFrutas implements Game {
  private largura = 0
  private altura = 0
  private pontuar: GameInitParams['pontuar'] = () => {}
  private perderVida: GameInitParams['perderVida'] = () => {}
  private frutas: Fruta[] = []
  private tempoDesdeSpawn = 0

  init(params: GameInitParams) {
    this.largura = params.largura
    this.altura = params.altura
    this.pontuar = params.pontuar
    this.perderVida = params.perderVida
    this.frutas = []
    this.tempoDesdeSpawn = 0
  }

  update(dt: number, controles: ControlState[]) {
    this.tempoDesdeSpawn += dt * 1000
    if (this.tempoDesdeSpawn >= INTERVALO_SPAWN_MS) {
      this.tempoDesdeSpawn = 0
      this.spawnFruta()
    }

    const cursor = controles[0]
    const cursorAtivo = cursor?.ativo ?? false
    const cx = cursorAtivo ? cursor.cursor.x * this.largura : -1000
    const cy = cursorAtivo ? cursor.cursor.y * this.altura : -1000

    this.frutas = this.frutas.filter((fruta) => {
      fruta.y += fruta.velocidade * dt

      const distancia = Math.hypot(fruta.x - cx, fruta.y - cy)
      if (distancia < RAIO_CAPTURA) {
        this.pontuar(0, 1)
        return false
      }
      if (fruta.y - fruta.raio > this.altura) {
        this.perderVida(0)
        return false
      }
      return true
    })
  }

  render(ctx: CanvasRenderingContext2D, viewport: Viewport) {
    ctx.fillStyle = '#0e1015'
    ctx.fillRect(viewport.x, viewport.y, viewport.largura, viewport.altura)

    ctx.fillStyle = '#a1d42a'
    for (const fruta of this.frutas) {
      ctx.beginPath()
      ctx.arc(viewport.x + fruta.x, viewport.y + fruta.y, fruta.raio, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  destroy() {
    this.frutas = []
  }

  private spawnFruta() {
    this.frutas.push({
      x: RAIO_FRUTA + Math.random() * (this.largura - RAIO_FRUTA * 2),
      y: -RAIO_FRUTA,
      raio: RAIO_FRUTA,
      velocidade: VELOCIDADE_MIN + Math.random() * (VELOCIDADE_MAX - VELOCIDADE_MIN),
    })
  }
}
