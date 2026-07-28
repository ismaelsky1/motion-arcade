import type { ControlState } from '../tracking/tracker'
import type { AudioManager } from '../core/audio'

export type Modo = 'solo' | 'coop' | 'versus'
export type TelaDividida = boolean | Partial<Record<Modo, boolean>>
export type TesteDeAlcance = 'obrigatorio' | 'opcional' | 'inaplicavel'
export type Capacidade = 'cursor' | 'gestos' | 'pose' | 'zonas'
export type ResultadoPor = 'placar' | 'vidas'

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
  vidasIniciais: number
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

// Mesma ideia de resolverTelaDividida: resultadoPor pode ser fixo ou variar por modo (ex.:
// jogos sem placar tradicional rankeiam o versus por vidas, mas o solo continua por placar).
export function resolverResultadoPor(
  resultadoPor: ResultadoPor | Partial<Record<Modo, ResultadoPor>> | undefined,
  modo: Modo,
): ResultadoPor {
  if (!resultadoPor) return 'placar'
  return typeof resultadoPor === 'string' ? resultadoPor : (resultadoPor[modo] ?? 'placar')
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
  resultadoPor?: ResultadoPor | Partial<Record<Modo, ResultadoPor>>
  carregar: () => Promise<{ default: new () => Game }>
}
