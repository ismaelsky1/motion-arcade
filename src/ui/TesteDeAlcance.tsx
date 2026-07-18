import { useEffect, useRef, useState } from 'react'
import type { Calibracao, ResolvedorDeZonas } from '../tracking/zonas'
import { criarHoverPress, type HoverPress } from '../hooks/useHoverPress'
import { corDoJogador, nomeDoJogador } from '../core/jogadores'
import type { GameManifest } from '../games/types'
import './TesteDeAlcance.css'

const LARGURA = 640
const ALTURA = 480
const MARGEM_ALVO = 0.14
const RAIO_ALVO = 0.09
const TEMPO_LIMITE_MS = 8000
const FATOR_ENCOLHER = 0.2
const DURACAO_PULAR_MS = 1500

const ALVOS: { x: number; y: number }[] = [
  { x: MARGEM_ALVO, y: MARGEM_ALVO },
  { x: 1 - MARGEM_ALVO, y: MARGEM_ALVO },
  { x: MARGEM_ALVO, y: 1 - MARGEM_ALVO },
  { x: 1 - MARGEM_ALVO, y: 1 - MARGEM_ALVO },
]
const ALVO_PULAR = { x: 0.5, y: 0.5 }

interface EstadoJogador {
  tocado: boolean[]
  posicaoTocada: ({ x: number; y: number } | null)[]
  melhorDistancia: number[]
  melhorPosicao: ({ x: number; y: number } | null)[]
  concluido: boolean
  inicio: number
  ausenteDesde: number | null
  hoverPular: HoverPress
  progressoPular: number
}

export default function TesteDeAlcance({
  manifest,
  jogadores,
  resolvedor,
  aoConcluir,
  aoJogadorSumiu,
}: {
  manifest: GameManifest
  jogadores: number
  resolvedor: ResolvedorDeZonas
  aoConcluir: () => void
  aoJogadorSumiu: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const podePular = manifest.testeDeAlcance === 'opcional'
  const estadosRef = useRef<EstadoJogador[]>(
    Array.from({ length: jogadores }, () => ({
      tocado: [false, false, false, false],
      posicaoTocada: [null, null, null, null],
      melhorDistancia: [Infinity, Infinity, Infinity, Infinity],
      melhorPosicao: [null, null, null, null],
      concluido: false,
      inicio: performance.now(),
      ausenteDesde: null,
      hoverPular: criarHoverPress(DURACAO_PULAR_MS),
      progressoPular: 0,
    })),
  )
  const [concluidos, setConcluidos] = useState(0)

  useEffect(() => {
    let rafId: number
    let ultimoTempo = performance.now()
    let ultimoConcluidos = -1
    let sumiu = false

    function calibracaoDe(estado: EstadoJogador): Calibracao {
      const pos = (i: number) => estado.posicaoTocada[i] ?? estado.melhorPosicao[i]
      const tl = pos(0)
      const tr = pos(1)
      const bl = pos(2)
      const br = pos(3)
      const centro = 0.5
      const aproximar = (v: number | undefined, alvo: number) =>
        v ?? centro + (alvo - centro) * (1 - FATOR_ENCOLHER)

      return {
        xMin: Math.min(aproximar(tl?.x, ALVOS[0].x), aproximar(bl?.x, ALVOS[2].x)),
        xMax: Math.max(aproximar(tr?.x, ALVOS[1].x), aproximar(br?.x, ALVOS[3].x)),
        yMin: Math.min(aproximar(tl?.y, ALVOS[0].y), aproximar(tr?.y, ALVOS[1].y)),
        yMax: Math.max(aproximar(bl?.y, ALVOS[2].y), aproximar(br?.y, ALVOS[3].y)),
      }
    }

    function desenhar(agora: number) {
      const dt = Math.min((agora - ultimoTempo) / 1000, 0.1)
      ultimoTempo = agora

      const controles = resolvedor.getState()
      const estados = estadosRef.current
      const larguraFaixa = LARGURA / jogadores

      estados.forEach((estado, jogador) => {
        if (estado.concluido) return
        const controle = controles[jogador]
        const ativo = controle?.ativo ?? false

        if (!ativo) {
          estado.progressoPular = 0
          estado.hoverPular.reiniciar()
          if (estado.ausenteDesde === null) estado.ausenteDesde = agora
          else if (agora - estado.ausenteDesde > 5000 && !sumiu) {
            sumiu = true
            aoJogadorSumiu()
          }
          return
        }
        estado.ausenteDesde = null

        ALVOS.forEach((alvo, i) => {
          if (estado.tocado[i]) return
          const distancia = Math.hypot(controle.cursor.x - alvo.x, controle.cursor.y - alvo.y)
          if (distancia < estado.melhorDistancia[i]) {
            estado.melhorDistancia[i] = distancia
            estado.melhorPosicao[i] = controle.cursor
          }
          if (distancia < RAIO_ALVO) {
            estado.tocado[i] = true
            estado.posicaoTocada[i] = controle.cursor
          }
        })

        if (podePular) {
          const distanciaPular = Math.hypot(controle.cursor.x - ALVO_PULAR.x, controle.cursor.y - ALVO_PULAR.y)
          const { progresso, completou } = estado.hoverPular.atualizar(distanciaPular < RAIO_ALVO, dt)
          estado.progressoPular = progresso
          if (completou) estado.concluido = true
        }

        const todosTocados = estado.tocado.every(Boolean)
        const expirou = agora - estado.inicio > TEMPO_LIMITE_MS
        if (todosTocados || expirou) {
          resolvedor.definirCalibracao(jogador, calibracaoDe(estado))
          estado.concluido = true
        }
      })

      const totalConcluidos = estados.filter((e) => e.concluido).length
      if (totalConcluidos !== ultimoConcluidos) {
        ultimoConcluidos = totalConcluidos
        setConcluidos(totalConcluidos)
      }

      if (totalConcluidos === jogadores) {
        aoConcluir()
        return
      }

      desenharCanvas(canvasRef.current, estados, controles, larguraFaixa, podePular)
      rafId = requestAnimationFrame(desenhar)
    }

    rafId = requestAnimationFrame(desenhar)
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedor, jogadores, podePular, aoConcluir, aoJogadorSumiu])

  return (
    <>
      <canvas ref={canvasRef} width={LARGURA} height={ALTURA} />

      <div className="teste-alcance-dica">
        Toque os 4 cantos da sua área com o cursor {podePular && '— ou segure o centro para pular'}
      </div>
      <div className="teste-alcance-progresso">
        {concluidos}/{jogadores} prontos
      </div>
    </>
  )
}

function desenharCanvas(
  canvas: HTMLCanvasElement | null,
  estados: EstadoJogador[],
  controles: ReturnType<ResolvedorDeZonas['getState']>,
  larguraFaixa: number,
  podePular: boolean,
) {
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  estados.forEach((estado, jogador) => {
    const inicioFaixa = jogador * larguraFaixa
    const cor = corDoJogador(jogador)
    const paraPx = (p: { x: number; y: number }) => ({
      x: inicioFaixa + p.x * larguraFaixa,
      y: p.y * canvas.height,
    })

    ctx.save()
    ctx.strokeStyle = cor
    ctx.globalAlpha = estado.concluido ? 0.3 : 1

    ALVOS.forEach((alvo, i) => {
      const { x, y } = paraPx(alvo)
      ctx.beginPath()
      ctx.arc(x, y, 14, 0, Math.PI * 2)
      ctx.setLineDash(estado.tocado[i] ? [] : [4, 4])
      ctx.lineWidth = 3
      ctx.stroke()
      if (estado.tocado[i]) {
        ctx.fillStyle = cor
        ctx.fill()
      }
    })
    ctx.setLineDash([])

    if (podePular && !estado.concluido) {
      const { x, y } = paraPx(ALVO_PULAR)
      ctx.beginPath()
      ctx.setLineDash([3, 3])
      ctx.arc(x, y, 22, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      if (estado.progressoPular > 0) {
        ctx.beginPath()
        ctx.arc(x, y, 22, -Math.PI / 2, -Math.PI / 2 + estado.progressoPular * Math.PI * 2)
        ctx.lineWidth = 4
        ctx.stroke()
      }
    }

    ctx.fillStyle = cor
    ctx.font = '700 15px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(
      estado.concluido ? `${nomeDoJogador(jogador)} ✓` : nomeDoJogador(jogador),
      inicioFaixa + larguraFaixa / 2,
      24,
    )

    const controle = controles[jogador]
    if (controle?.ativo && !estado.concluido) {
      const { x, y } = paraPx(controle.cursor)
      ctx.beginPath()
      ctx.arc(x, y, controle.gestures.pinch ? 10 : 14, 0, Math.PI * 2)
      ctx.lineWidth = 3
      ctx.stroke()
    }

    ctx.restore()
  })
}
