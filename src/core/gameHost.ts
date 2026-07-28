import type { Tracker } from '../tracking/tracker'
import type { Game, Modo, Viewport } from '../games/types'
import { AudioManager } from './audio'
import { CORES_JOGADORES } from './jogadores'

export type StatusPartida = 'jogando' | 'pausado'

export interface GameHostOpcoes {
  jogadores: number
  modo: Modo
  telaDividida: boolean
  largura: number
  altura: number
  vidasIniciais: number
  mostrarCursorPadrao?: boolean
}

export interface GameHostEventos {
  aoMudarStatus: (status: StatusPartida) => void
  aoMudarPlacar: (placar: number[]) => void
  aoMudarVidas: (vidas: number[]) => void
  aoMudarJogadoresInativos: (indices: number[]) => void
  aoTerminar: () => void
}

// Loop e ciclo de vida do jogo, fora do React (seção 6.1 do planejamento).
// HUD atualiza por evento (placar, vidas, status), nunca por frame.
export class GameHost {
  private ctx: CanvasRenderingContext2D
  private viewports: Viewport[]
  private placar: number[]
  private vidas: number[]
  private rafId = 0
  private ultimoTempo = 0
  private pausaManual = false
  private statusAnterior: StatusPartida | null = null
  private jogadoresInativosAnterior: number[] = []
  private terminou = false
  private canvas: HTMLCanvasElement
  private jogo: Game
  private tracker: Tracker
  private opcoes: GameHostOpcoes
  private eventos: GameHostEventos
  private audio: AudioManager

  constructor(
    canvas: HTMLCanvasElement,
    jogo: Game,
    tracker: Tracker,
    opcoes: GameHostOpcoes,
    eventos: GameHostEventos,
    audio: AudioManager,
  ) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D não suportado')
    this.canvas = canvas
    this.jogo = jogo
    this.tracker = tracker
    this.opcoes = opcoes
    this.eventos = eventos
    this.audio = audio
    this.ctx = ctx
    this.placar = Array(opcoes.jogadores).fill(0)
    this.vidas = Array(opcoes.jogadores).fill(opcoes.vidasIniciais)
    this.viewports =
      opcoes.telaDividida && opcoes.jogadores > 1
        ? Array.from({ length: opcoes.jogadores }, (_, i) => ({
            x: (i * opcoes.largura) / opcoes.jogadores,
            y: 0,
            largura: opcoes.largura / opcoes.jogadores,
            altura: opcoes.altura,
          }))
        : [{ x: 0, y: 0, largura: opcoes.largura, altura: opcoes.altura }]
  }

  iniciar() {
    this.jogo.init({
      jogadores: this.opcoes.jogadores,
      modo: this.opcoes.modo,
      viewports: this.viewports,
      audio: this.audio,
      pontuar: this.pontuar,
      perderVida: this.perderVida,
      largura: this.opcoes.largura,
      altura: this.opcoes.altura,
      vidasIniciais: this.opcoes.vidasIniciais,
    })
    this.ultimoTempo = performance.now()
    this.rafId = requestAnimationFrame(this.loop)
  }

  pausar() {
    this.pausaManual = true
  }

  retomar() {
    this.pausaManual = false
  }

  destruir() {
    cancelAnimationFrame(this.rafId)
    this.jogo.destroy()
  }

  private pontuar = (jogador: number, valor: number) => {
    this.placar[jogador] = (this.placar[jogador] ?? 0) + valor
    this.eventos.aoMudarPlacar([...this.placar])
    this.audio.ponto()
  }

  private perderVida = (jogador: number) => {
    this.vidas[jogador] = Math.max(0, (this.vidas[jogador] ?? 0) - 1)
    this.eventos.aoMudarVidas([...this.vidas])
    this.audio.perdaDeVida()
    if (this.vidas.every((v) => v <= 0)) this.terminar()
  }

  private terminar() {
    if (this.terminou) return
    this.terminou = true
    this.audio.fimDeJogo()
    this.eventos.aoTerminar()
  }

  private loop = (agora: number) => {
    if (this.terminou) return

    const dt = Math.min((agora - this.ultimoTempo) / 1000, 0.1)
    this.ultimoTempo = agora

    const controles = this.tracker.getState()
    const jogadoresInativos = controles
      .slice(0, this.opcoes.jogadores)
      .reduce<number[]>((acc, c, i) => (c.ativo ? acc : [...acc, i]), [])
    if (
      jogadoresInativos.length !== this.jogadoresInativosAnterior.length ||
      jogadoresInativos.some((v, i) => v !== this.jogadoresInativosAnterior[i])
    ) {
      this.jogadoresInativosAnterior = jogadoresInativos
      this.eventos.aoMudarJogadoresInativos(jogadoresInativos)
    }

    const status: StatusPartida = this.pausaManual || jogadoresInativos.length > 0 ? 'pausado' : 'jogando'
    if (status !== this.statusAnterior) {
      this.statusAnterior = status
      this.eventos.aoMudarStatus(status)
    }

    if (status === 'jogando') {
      this.jogo.update(dt, controles)
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.viewports.forEach((viewport, indice) => this.jogo.render(this.ctx, viewport, indice))
    if (this.opcoes.mostrarCursorPadrao !== false) this.desenharCursores(controles)

    this.rafId = requestAnimationFrame(this.loop)
  }

  private desenharCursores(controles: ReturnType<Tracker['getState']>) {
    controles.slice(0, this.opcoes.jogadores).forEach((estado, i) => {
      if (!estado.ativo) return
      const viewport = this.viewports.length > 1 ? this.viewports[i] : this.viewports[0]
      const x = viewport.x + estado.cursor.x * viewport.largura
      const y = viewport.y + estado.cursor.y * viewport.altura
      const cor = CORES_JOGADORES[i % CORES_JOGADORES.length]

      this.ctx.beginPath()
      this.ctx.arc(x, y, estado.gestures.pinch ? 14 : 20, 0, Math.PI * 2)
      this.ctx.strokeStyle = cor
      this.ctx.lineWidth = 3
      this.ctx.setLineDash(estado.gestures.pinch ? [] : [6, 6])
      this.ctx.stroke()
      this.ctx.setLineDash([])
    })
  }
}
