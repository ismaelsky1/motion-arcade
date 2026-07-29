import * as tf from '@tensorflow/tfjs'
import {
  createDetector,
  movenet,
  SupportedModels,
  TrackerType,
  type Keypoint,
  type Pose,
  type PoseDetector,
} from '@tensorflow-models/pose-detection'
import type { Capacidade } from '../games/types'
import type { ControlState, Tracker } from './tracker'
import { bboxDeKeypoints, type PoseKeypoint } from './poseUtils'

const MAX_PESSOAS = 4
// Distância máxima (coordenadas normalizadas 0-1 do quadro cheio) pra considerar que uma pose
// detectada neste frame ainda é a mesma pessoa de um slot conhecido — mesma ideia do
// DISTANCIA_MAX_IDENTIDADE em zonas.ts, mas maior porque o centro do bbox do corpo se move
// mais entre frames do que o cursor de uma mão.
const DISTANCIA_MAX_IDENTIDADE = 0.3

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

interface Candidato {
  cursor: { x: number; y: number }
  pontos: PoseKeypoint[]
  score: number
}

export class PoseTracker implements Tracker {
  static capacidades: Capacidade[] = ['pose']

  private detector: PoseDetector | null = null
  private video: HTMLVideoElement | null = null
  private rafId = 0
  private detectando = false
  // undefined = slot nunca usado (não conta pro tamanho ocupado); null = slot já usado, mas
  // ausente no frame atual (mantém a posição pra permitir a pessoa voltar sem trocar de slot).
  private ultimaPosicao: ({ x: number; y: number } | null)[] = []
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
    this.ultimaPosicao = []
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
        .estimatePoses(video, { maxPoses: MAX_PESSOAS })
        .then((poses) => {
          this.atualizarEstados(poses, largura, altura)
        })
        .finally(() => {
          this.detectando = false
        })
    }
    this.rafId = requestAnimationFrame(this.loop)
  }

  // Identidade por proximidade ao último quadro — igual ao ResolvedorDeZonas (tracking/zonas.ts)
  // pra mãos, só que sem faixa/calibração. Não depende do `id` que a lib devolve com
  // enableTracking: esse id nem sempre vem preenchido de forma confiável em todo navegador, e
  // sem esse fallback o Lobby ficava travado em "0 jogadores" pra sempre.
  private atualizarEstados(poses: Pose[], largura: number, altura: number) {
    if (largura === 0 || altura === 0) return

    const candidatos: Candidato[] = poses
      .map((pose): Candidato | null => {
        const pontos = normalizarKeypoints(pose.keypoints, largura, altura)
        const bbox = bboxDeKeypoints(pontos)
        if (!bbox) return null
        return {
          pontos,
          score: pose.score ?? 0,
          cursor: { x: bbox.x + bbox.largura / 2, y: bbox.y + bbox.altura / 2 },
        }
      })
      .filter((c): c is Candidato => c !== null)

    const usados = new Set<number>()
    const vistos = new Set<number>()

    // 1) preserva identidade: casa cada slot conhecido com o candidato mais próximo da última posição
    for (let slot = 0; slot < this.ultimaPosicao.length; slot++) {
      const ultima = this.ultimaPosicao[slot]
      if (!ultima) continue
      let melhor: { indice: number; distancia: number } | null = null
      for (let indice = 0; indice < candidatos.length; indice++) {
        if (usados.has(indice)) continue
        const distancia = Math.hypot(candidatos[indice].cursor.x - ultima.x, candidatos[indice].cursor.y - ultima.y)
        if (distancia > DISTANCIA_MAX_IDENTIDADE) continue
        if (!melhor || distancia < melhor.distancia) melhor = { indice, distancia }
      }
      if (melhor) {
        usados.add(melhor.indice)
        this.aplicarCandidato(slot, candidatos[melhor.indice])
        vistos.add(slot)
      }
    }

    // 2) candidatos não casados ocupam o primeiro slot livre (novo ou vago), até MAX_PESSOAS
    candidatos.forEach((c, indice) => {
      if (usados.has(indice)) return
      let slot = this.ultimaPosicao.findIndex((p) => p === null)
      if (slot === -1) {
        if (this.ultimaPosicao.length >= MAX_PESSOAS) return
        slot = this.ultimaPosicao.length
        this.ultimaPosicao.push(null)
      }
      this.aplicarCandidato(slot, c)
      vistos.add(slot)
    })

    // 3) slots conhecidos não vistos neste frame ficam inativos
    for (let slot = 0; slot < this.estados.length; slot++) {
      if (!vistos.has(slot) && this.estados[slot]) {
        this.estados[slot] = estadoInativo(this.estados[slot].cursor)
        this.ultimaPosicao[slot] = null
      }
    }
  }

  private aplicarCandidato(slot: number, candidato: Candidato) {
    this.estados[slot] = {
      cursor: candidato.cursor,
      gestures: { pinch: false, thumbsUp: false, wave: false },
      points: candidato.pontos,
      ativo: true,
      confidence: candidato.score,
    }
    this.ultimaPosicao[slot] = candidato.cursor
  }
}
