import type { Game, GameInitParams, Viewport } from '../types'
import type { ControlState } from '../../tracking/tracker'

// Placeholder para a Fase 2 do roadmap (Núcleo + primeiro jogo).
export default class PegaFrutas implements Game {
  init(_params: GameInitParams): void {}
  update(_dt: number, _controles: ControlState[]): void {}
  render(_ctx: CanvasRenderingContext2D, _viewport: Viewport): void {}
  destroy(): void {}
}
