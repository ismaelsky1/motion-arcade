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
  getState(): ControlState[]
}

export interface TrackerConstructor {
  new (): Tracker
  capacidades: Capacidade[]
}
