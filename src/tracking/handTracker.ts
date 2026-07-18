import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision'
import type { Capacidade } from '../games/types'
import type { ControlState, Tracker } from './tracker'

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

const PINCA_LIMIAR = 0.06

function estadoVazio(): ControlState {
  return {
    cursor: { x: 0.5, y: 0.5 },
    gestures: { pinch: false, thumbsUp: false, wave: false },
    points: [],
    ativo: false,
    confidence: 0,
  }
}

function interpretar(resultado: HandLandmarkerResult): ControlState {
  const pontos = resultado.landmarks[0]
  if (!pontos) return estadoVazio()

  const base = pontos[9] // base do dedo médio: ponto estável para o cursor
  const polegar = pontos[4]
  const indicador = pontos[8]
  const distanciaPinca = Math.hypot(polegar.x - indicador.x, polegar.y - indicador.y)

  return {
    cursor: { x: 1 - base.x, y: base.y }, // espelhado para casar com o vídeo espelhado
    gestures: {
      pinch: distanciaPinca < PINCA_LIMIAR,
      thumbsUp: false,
      wave: false,
    },
    points: pontos,
    ativo: true,
    confidence: resultado.handedness[0]?.[0]?.score ?? 0,
  }
}

export class HandTracker implements Tracker {
  static capacidades: Capacidade[] = ['cursor', 'gestos']

  private landmarker: HandLandmarker | null = null
  private video: HTMLVideoElement | null = null
  private rafId = 0
  private estado: ControlState[] = [estadoVazio()]

  async start(videoElement: HTMLVideoElement) {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL)
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
    })
    this.video = videoElement
    this.loop()
  }

  stop() {
    cancelAnimationFrame(this.rafId)
    this.landmarker?.close()
    this.landmarker = null
    this.video = null
    this.estado = [estadoVazio()]
  }

  getState() {
    return this.estado
  }

  private loop = () => {
    if (!this.landmarker || !this.video) return
    if (this.video.readyState >= 2) {
      const resultado = this.landmarker.detectForVideo(this.video, performance.now())
      this.estado = [interpretar(resultado)]
    }
    this.rafId = requestAnimationFrame(this.loop)
  }
}
