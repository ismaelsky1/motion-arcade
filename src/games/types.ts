import type { ControlState } from '../tracking/tracker'
import type { AudioManager } from '../core/audio'

export type Modo = 'solo' | 'coop' | 'versus'
export type TelaDividida = boolean | Partial<Record<Modo, boolean>>
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
  render(ctx: CanvasRenderingContext2D, viewport: Viewport, indice: number): void
  destroy(): void
}

// telaDividida pode ser fixo pro jogo inteiro ou variar por modo (ex.: versus divide,
// coop compartilha a mesma arena). Resolve pro boolean que o GameHost espera.
export function resolverTelaDividida(telaDividida: TelaDividida, modo: Modo): boolean {
  return typeof telaDividida === 'boolean' ? telaDividida : (telaDividida[modo] ?? false)
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
