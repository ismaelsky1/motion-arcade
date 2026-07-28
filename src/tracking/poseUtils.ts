// Módulo leve, sem dependência de @tensorflow/*, pra poder ser importado estaticamente por
// consumidores (Lobby, jogos) sem puxar o tfjs no bundle principal — só poseTracker.ts (que
// é sempre importado dinamicamente) carrega essa dependência pesada.

export interface PoseKeypoint {
  x: number
  y: number
  score: number
  name?: string
}

export interface Bbox {
  x: number
  y: number
  largura: number
  altura: number
}

const LIMIAR_CONFIANCA_PADRAO = 0.3

// Bounding box (0-1 normalizado) a partir dos keypoints com confiança suficiente. Usado tanto
// pelo Lobby (desenhar a caixa do jogador na posição real do corpo) quanto pelo jogo (colisão).
export function bboxDeKeypoints(
  points: unknown[],
  limiarConfianca = LIMIAR_CONFIANCA_PADRAO,
): Bbox | null {
  const pontos = (points as PoseKeypoint[]).filter((p) => p.score >= limiarConfianca)
  if (pontos.length === 0) return null

  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  for (const p of pontos) {
    if (p.x < xMin) xMin = p.x
    if (p.x > xMax) xMax = p.x
    if (p.y < yMin) yMin = p.y
    if (p.y > yMax) yMax = p.y
  }
  return { x: xMin, y: yMin, largura: xMax - xMin, altura: yMax - yMin }
}
