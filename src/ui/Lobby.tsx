import { useEffect, useRef, useState } from 'react'
import type { ResolvedorDeZonas } from '../tracking/zonas'
import { criarHoverPress, type HoverPress } from '../hooks/useHoverPress'
import { corDoJogador, nomeDoJogador } from '../core/jogadores'
import type { GameManifest } from '../games/types'
import './Lobby.css'

const LARGURA = 640
const ALTURA = 480
const DURACAO_PRONTO_MS = 2000
const DURACAO_BOTAO_MS = 2000
const TEMPO_AUSENCIA_MS = 5000

type EstadoFaixa = 'livre' | 'detectada' | 'pronta'

interface Faixa {
  estado: EstadoFaixa
  ausenteDesde: number | null
  hover: HoverPress
  progressoHover: number
}

export default function Lobby({
  manifest,
  jogadoresAlvo,
  resolvedor,
  aoConfirmar,
  aoVoltar,
}: {
  manifest: GameManifest
  jogadoresAlvo: number
  resolvedor: ResolvedorDeZonas
  aoConfirmar: (jogadoresProntos: number) => void
  aoVoltar: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const faixasRef = useRef<Faixa[]>(
    Array.from({ length: jogadoresAlvo }, () => ({
      estado: 'livre',
      ausenteDesde: null,
      hover: criarHoverPress(DURACAO_PRONTO_MS),
      progressoHover: 0,
    })),
  )
  const botaoHoverRef = useRef<HoverPress>(criarHoverPress(DURACAO_BOTAO_MS))
  const [prontos, setProntos] = useState(0)
  const [progressoBotao, setProgressoBotao] = useState(0)

  const minimo = manifest.jogadores.min

  useEffect(() => {
    let rafId: number
    let ultimoTempo = performance.now()
    let ultimoProntos = -1

    function desenhar(agora: number) {
      const dt = Math.min((agora - ultimoTempo) / 1000, 0.1)
      ultimoTempo = agora

      const controles = resolvedor.getState()
      const faixas = faixasRef.current
      const larguraFaixa = LARGURA / jogadoresAlvo
      let algumDentroDoBotao = false
      const botaoRect = { x: LARGURA / 2 - 130, y: ALTURA - 64, largura: 260, altura: 44 }

      faixas.forEach((faixa, i) => {
        const controle = controles[i]
        const ativo = controle?.ativo ?? false

        if (!ativo) {
          faixa.progressoHover = 0
          if (faixa.estado === 'pronta') {
            if (faixa.ausenteDesde === null) faixa.ausenteDesde = agora
            if (agora - faixa.ausenteDesde > TEMPO_AUSENCIA_MS) {
              faixa.estado = 'livre'
              faixa.ausenteDesde = null
              faixa.hover.reiniciar()
            }
          } else {
            faixa.estado = 'livre'
            faixa.ausenteDesde = null
            faixa.hover.reiniciar()
          }
          return
        }

        faixa.ausenteDesde = null
        if (faixa.estado === 'livre') faixa.estado = 'detectada'

        if (faixa.estado === 'detectada') {
          if (controle.gestures.pinch) {
            faixa.estado = 'pronta'
            faixa.progressoHover = 0
            faixa.hover.reiniciar()
          } else {
            const { progresso, completou } = faixa.hover.atualizar(true, dt)
            faixa.progressoHover = progresso
            if (completou) faixa.estado = 'pronta'
          }
        }

        const globalX = i * larguraFaixa + controle.cursor.x * larguraFaixa
        const globalY = controle.cursor.y * ALTURA
        if (
          globalX >= botaoRect.x &&
          globalX <= botaoRect.x + botaoRect.largura &&
          globalY >= botaoRect.y &&
          globalY <= botaoRect.y + botaoRect.altura
        ) {
          algumDentroDoBotao = true
        }
      })

      const totalProntos = faixas.filter((f) => f.estado === 'pronta').length
      if (totalProntos !== ultimoProntos) {
        ultimoProntos = totalProntos
        setProntos(totalProntos)
      }

      const habilitado = totalProntos >= minimo
      const resultadoBotao = botaoHoverRef.current.atualizar(algumDentroDoBotao && habilitado, dt)
      setProgressoBotao(resultadoBotao.progresso)
      if (resultadoBotao.completou) {
        aoConfirmar(totalProntos)
        return
      }

      desenharCanvas(canvasRef.current, faixas, controles, jogadoresAlvo, botaoRect, resultadoBotao.progresso, habilitado)
      rafId = requestAnimationFrame(desenhar)
    }

    rafId = requestAnimationFrame(desenhar)
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedor, jogadoresAlvo, minimo])

  return (
    <>
      <canvas ref={canvasRef} width={LARGURA} height={ALTURA} />

      <button className="lobby-voltar" onClick={aoVoltar}>
        ← Voltar
      </button>

      <div className="lobby-dica">
        Acene para uma faixa ficar com você. Feche a mão ou fique parado 2s para confirmar.
      </div>

      <div className={`lobby-botao-info ${progressoBotao > 0 ? 'ativo' : ''}`}>
        Começar com {prontos} jogador{prontos === 1 ? '' : 'es'}
        {prontos < minimo && <span> (mínimo {minimo})</span>}
      </div>
    </>
  )
}

function desenharCanvas(
  canvas: HTMLCanvasElement | null,
  faixas: Faixa[],
  controles: ReturnType<ResolvedorDeZonas['getState']>,
  jogadores: number,
  botaoRect: { x: number; y: number; largura: number; altura: number },
  progressoBotao: number,
  botaoHabilitado: boolean,
) {
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  const larguraFaixa = canvas.width / jogadores

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  faixas.forEach((faixa, i) => {
    const x = i * larguraFaixa
    const cor = corDoJogador(i)

    ctx.save()
    ctx.strokeStyle = faixa.estado === 'livre' ? 'rgba(199, 213, 224, 0.35)' : cor
    ctx.lineWidth = faixa.estado === 'pronta' ? 4 : 2
    ctx.setLineDash(faixa.estado === 'pronta' ? [] : [8, 8])
    ctx.strokeRect(x + 6, 6, larguraFaixa - 12, canvas.height - 12)

    if (faixa.estado === 'pronta') {
      ctx.globalAlpha = 0.12
      ctx.fillStyle = cor
      ctx.fillRect(x + 6, 6, larguraFaixa - 12, canvas.height - 12)
      ctx.globalAlpha = 1
    }

    ctx.fillStyle = faixa.estado === 'livre' ? 'rgba(199, 213, 224, 0.6)' : cor
    ctx.font = '700 16px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(nomeDoJogador(i), x + larguraFaixa / 2, 30)

    const rotulo = faixa.estado === 'pronta' ? 'Pronto ✓' : faixa.estado === 'detectada' ? 'Confirmando…' : 'Livre'
    ctx.font = '400 13px Inter, sans-serif'
    ctx.fillText(rotulo, x + larguraFaixa / 2, 50)

    if (faixa.estado === 'detectada' && faixa.progressoHover > 0) {
      desenharAnelProgresso(ctx, x + larguraFaixa / 2, canvas.height / 2, 30, faixa.progressoHover, cor)
    }

    const controle = controles[i]
    if (controle?.ativo) {
      const cx = x + controle.cursor.x * larguraFaixa
      const cy = controle.cursor.y * canvas.height
      ctx.beginPath()
      ctx.arc(cx, cy, controle.gestures.pinch ? 12 : 16, 0, Math.PI * 2)
      ctx.strokeStyle = cor
      ctx.lineWidth = 3
      ctx.setLineDash(controle.gestures.pinch ? [] : [5, 5])
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.restore()
  })

  ctx.save()
  ctx.fillStyle = botaoHabilitado ? 'rgba(161, 212, 42, 0.85)' : 'rgba(139, 160, 180, 0.4)'
  ctx.fillRect(botaoRect.x, botaoRect.y, botaoRect.largura, botaoRect.altura)
  if (progressoBotao > 0) {
    ctx.fillStyle = 'rgba(23, 26, 33, 0.35)'
    ctx.fillRect(botaoRect.x, botaoRect.y, botaoRect.largura * progressoBotao, botaoRect.altura)
  }
  ctx.restore()
}

function desenharAnelProgresso(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  raio: number,
  progresso: number,
  cor: string,
) {
  if (progresso <= 0) return
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, raio, -Math.PI / 2, -Math.PI / 2 + progresso * Math.PI * 2)
  ctx.strokeStyle = cor
  ctx.lineWidth = 5
  ctx.stroke()
  ctx.restore()
}
