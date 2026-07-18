import type { ControlState } from '../tracking/tracker'
import type { AudioManager } from '../core/audio'

export type Modo = 'solo' | 'coop' | 'versus'
export type TelaDividida = boolean
export type TesteDeAlcance = 'obrigatorio' | 'opcional'
export type Capacidade = 'cursor' | 'gestos' | 'pose' | 'zonas'

export interface Viewport {
  x: number
  y: number
  largura: number
  altura: number
}

export interface GameInitParams {
  jogadores: number
  modo: Modo
  viewports: Viewport[]
  audio: AudioManager
  pontuar: (jogador: number, valor: number) => void
  perderVida: (jogador: number) => void
  largura: number
  altura: number
}

export interface Game {
  init(params: GameInitParams): void
  update(dt: number, controles: ControlState[]): void
  render(ctx: CanvasRenderingContext2D, viewport: Viewport): void
  destroy(): void
}

export interface GameManifest {
  id: string
  titulo: string
  capa: string
  descricao: string
  jogadores: { min: number; max: number }
  modos: Modo[]
  telaDividida: TelaDividida
  testeDeAlcance: TesteDeAlcance
  capacidades: Capacidade[]
  vidasIniciais?: number
  carregar: () => Promise<{ default: new () => Game }>
}
