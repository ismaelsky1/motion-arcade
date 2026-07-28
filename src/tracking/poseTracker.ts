import * as tf from '@tensorflow/tfjs'
import {
  createDetector,
  movenet,
  SupportedModels,
  TrackerType,
  type Keypoint,
  type PoseDetector,
} from '@tensorflow-models/pose-detection'
import type { Capacidade } from '../games/types'
import type { ControlState, Tracker } from './tracker'
import { bboxDeKeypoints, type PoseKeypoint } from './poseUtils'

const MAX_PESSOAS = 4

function estadoInativo(cursorAnterior: { x: number; y: number }): ControlState {
  return {
    cursor: cursorAnterior,
    gestures: { pinch: false, thumbsUp: false, wave: false },
    points: [],
    ativo: false,
    confidence: 0,
  }
}

function normalizarKeypoints(pontos: Keypoint[], largura: number, altura: number): PoseKeypoint[] {
  return pontos.map((p) => ({
    x: 1 - p.x / largura, // espelhado, mesma convenção do HandTracker
    y: p.y / altura,
    score: p.score ?? 0,
    name: p.name,
  }))
}

export class PoseTracker implements Tracker {
  static capacidades: Capacidade[] = ['pose']

  private detector: PoseDetector | null = null
  private video: HTMLVideoElement | null = null
  private rafId = 0
  private detectando = false
  private idParaIndice = new Map<number, number>()
  private estados: ControlState[] = []

  async start(videoElement: HTMLVideoElement) {
    const ok = await tf.setBackend('webgl')
    if (!ok) await tf.setBackend('cpu')
    await tf.ready()

    this.detector = await createDetector(SupportedModels.MoveNet, {
      modelType: movenet.modelType.MULTIPOSE_LIGHTNING,
      enableTracking: true,
      trackerType: TrackerType.BoundingBox,
    })
    this.video = videoElement
    this.loop()
  }

  stop() {
    cancelAnimationFrame(this.rafId)
    this.detector?.dispose()
    this.detector = null
    this.video = null
    this.idParaIndice.clear()
    this.estados = []
  }

  getState() {
    return this.estados
  }

  private loop = () => {
    if (!this.detector || !this.video) return
    if (!this.detectando && this.video.readyState >= 2) {
      this.detectando = true
      const video = this.video
      const largura = video.videoWidth
      const altura = video.videoHeight
      this.detector
        .estimatePoses(video)
        .then((poses) => {
          this.atualizarEstados(poses, largura, altura)
        })
        .finally(() => {
          this.detectando = false
        })
    }
    this.rafId = requestAnimationFrame(this.loop)
  }

  private atualizarEstados(
    poses: Awaited<ReturnType<PoseDetector['estimatePoses']>>,
    largura: number,
    altura: number,
  ) {
    if (largura === 0 || altura === 0) return

    const vistos = new Set<number>()

    for (const pose of poses) {
      if (pose.id === undefined) continue
      if (!this.idParaIndice.has(pose.id)) {
        if (this.idParaIndice.size >= MAX_PESSOAS) continue
        this.idParaIndice.set(pose.id, this.idParaIndice.size)
      }
      const indice = this.idParaIndice.get(pose.id)!
      const pontos = normalizarKeypoints(pose.keypoints, largura, altura)
      const bbox = bboxDeKeypoints(pontos)
      const cursor = bbox
        ? { x: bbox.x + bbox.largura / 2, y: bbox.y + bbox.altura / 2 }
        : { x: 0.5, y: 0.5 }

      this.estados[indice] = {
        cursor,
        gestures: { pinch: false, thumbsUp: false, wave: false },
        points: pontos,
        ativo: true,
        confidence: pose.score ?? 0,
      }
      vistos.add(indice)
    }

    for (let i = 0; i < this.estados.length; i++) {
      if (!vistos.has(i) && this.estados[i]) {
        this.estados[i] = estadoInativo(this.estados[i].cursor)
      }
    }
  }
}
