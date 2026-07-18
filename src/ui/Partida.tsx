import { useEffect, useRef, useState, type RefObject } from 'react'
import { useGameHost } from '../hooks/useGameHost'
import { AudioManager } from '../core/audio'
import { corDoJogador, nomeDoJogador } from '../core/jogadores'
import { resolverTelaDividida, type GameManifest, type Modo } from '../games/types'
import type { Tracker } from '../tracking/tracker'
import './Partida.css'

const LARGURA = 640
const ALTURA = 480
const CONTAGEM_INICIAL = 3
const TEMPO_AUSENCIA_MS = 5000

type Fase = 'contagem' | 'jogando'

export default function Partida({
  manifest,
  jogadores,
  modo,
  videoRef,
  trackerRef,
  poucaLuz,
  aoTerminar,
  aoVoltar,
  aoJogadorSumiu,
}: {
  manifest: GameManifest
  jogadores: number
  modo: Modo
  videoRef: RefObject<HTMLVideoElement | null>
  trackerRef: RefObject<Tracker | null>
  poucaLuz: boolean
  aoTerminar: (placar: number[]) => void
  aoVoltar: () => void
  aoJogadorSumiu: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<AudioManager | null>(null)
  if (!audioRef.current) audioRef.current = new AudioManager()

  const [fase, setFase] = useState<Fase>('contagem')
  const [contagem, setContagem] = useState(CONTAGEM_INICIAL)
  const ausenteDesdeRef = useRef<number | null>(null)

  const { status, placar, vidas, jogadoresInativos, terminou, pausar, retomar } = useGameHost(
    canvasRef,
    trackerRef,
    true,
    fase === 'jogando',
    manifest,
    audioRef.current,
    LARGURA,
    ALTURA,
    jogadores,
    modo,
  )

  useEffect(() => {
    if (terminou) aoTerminar(placar)
  }, [terminou, placar, aoTerminar])

  useEffect(() => {
    audioRef.current?.inicio()
  }, [])

  // O <video> é montado por App.tsx (persiste durante toda a sessão de câmera); aqui só
  // controlamos a classe visual (câmera de fundo durante a contagem, miniatura no jogo).
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.className = fase === 'jogando' ? 'camera-miniatura' : 'camera-fundo'
  }, [fase, videoRef])

  useEffect(() => {
    if (fase !== 'contagem') return
    if (contagem <= 0) {
      setFase('jogando')
      return
    }

    // Se um jogador confirmado sumir durante a contagem por mais de 5s, volta ao lobby
    // (loop indicado no diagrama de fluxo da seção 5 do planejamento).
    const controles = trackerRef.current?.getState() ?? []
    const algumInativo = controles.slice(0, jogadores).some((c) => !c.ativo)
    if (algumInativo) {
      if (ausenteDesdeRef.current === null) ausenteDesdeRef.current = performance.now()
      else if (performance.now() - ausenteDesdeRef.current > TEMPO_AUSENCIA_MS) {
        aoJogadorSumiu()
        return
      }
    } else {
      ausenteDesdeRef.current = null
    }

    audioRef.current?.contagem()
    const timeout = setTimeout(() => setContagem((n) => n - 1), 700)
    return () => clearTimeout(timeout)
  }, [fase, contagem, jogadores, trackerRef, aoJogadorSumiu])

  const placarExibido = modo === 'coop' ? placar.reduce((soma, p) => soma + p, 0) : (placar[0] ?? 0)
  const mostrarHudPorJogador = modo === 'versus' && jogadores > 1
  // Espelha a condição que o GameHost usa pra dividir os viewports (core/gameHost.ts): só
  // ancora o HUD na própria coluna do jogador quando a tela realmente está dividida.
  const dividido = resolverTelaDividida(manifest.telaDividida, modo) && jogadores > 1

  return (
    <>
      <canvas ref={canvasRef} width={LARGURA} height={ALTURA} />

      {fase === 'contagem' && (
        <div className="pre-jogo-sobreposicao">
          <p className="contagem-numero">{contagem}</p>
        </div>
      )}

      {fase === 'jogando' && (
        <>
          {dividido ? (
            <div className="hud-zonas">
              {placar.map((p, i) => (
                <div
                  key={i}
                  className="hud-zona"
                  style={{ left: `${(i * 100) / jogadores}%`, width: `${100 / jogadores}%`, color: corDoJogador(i) }}
                >
                  <span className="hud-zona-placar">{p}</span>
                  <span className="hud-zona-vidas">{'♥'.repeat(vidas[i] ?? 0)}</span>
                </div>
              ))}
            </div>
          ) : mostrarHudPorJogador ? (
            <>
              <div className="hud-placar-versus">
                {placar.map((p, i) => (
                  <span key={i} style={{ color: corDoJogador(i) }}>
                    {nomeDoJogador(i)}: {p}
                  </span>
                ))}
              </div>
              <div className="hud-vidas-versus">
                {vidas.map((v, i) => (
                  <span key={i} style={{ color: corDoJogador(i) }}>
                    {'♥'.repeat(v)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="hud-placar">{placarExibido}</div>
              <div className="hud-vidas">{'♥'.repeat(vidas[0] ?? 0)}</div>
            </>
          )}

          <button className="hud-pausa" onClick={() => (status === 'pausado' ? retomar() : pausar())}>
            {status === 'pausado' ? '▶' : '⏸'}
          </button>

          <button className="voltar-partida" onClick={aoVoltar}>
            ← Sair
          </button>

          {poucaLuz && <div className="aviso-pouca-luz flutuante">Pouca luz</div>}

          <div className={`pill ${status === 'jogando' ? 'pill-ok' : 'pill-alerta'}`}>
            {status === 'jogando'
              ? 'Jogando'
              : jogadoresInativos.length > 0 && jogadores > 1
                ? jogadoresInativos.map((i) => nomeDoJogador(i)).join(', ') + ' saiu do quadro'
                : 'Mostre sua mão'}
          </div>
        </>
      )}
    </>
  )
}
