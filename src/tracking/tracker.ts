import type { Capacidade } from '../games/types'

export interface Gestures {
  pinch: boolean
  thumbsUp: boolean
  wave: boolean
}

export interface ControlState {
  cursor: { x: number; y: number }
  gestures: Gestures
  points: unknown[]
  ativo: boolean
  confidence: number
}

export interface Tracker {
  start(videoElement: HTMLVideoElement): Promise<void>
  stop(): void
  // Lista bruta de detecções deste frame (0..N, sem identidade de jogador estável).
  // Um ResolvedorDeZonas (tracking/zonas.ts) converte isso em controles[0..jogadores-1].
  getState(): ControlState[]
}

export interface TrackerConstructor {
  new (): Tracker
  capacidades: Capacidade[]
}
