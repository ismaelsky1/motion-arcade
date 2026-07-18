import { useEffect, useRef, useState, type RefObject } from 'react'
import { GameHost, type StatusPartida } from '../core/gameHost'
import type { AudioManager } from '../core/audio'
import type { Tracker } from '../tracking/tracker'
import type { Game, GameManifest } from '../games/types'

const VIDAS_PADRAO = 3

export function useGameHost(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  trackerRef: RefObject<Tracker | null>,
  trackerPronto: boolean,
  podeIniciar: boolean,
  manifest: GameManifest,
  audio: AudioManager,
  largura: number,
  altura: number,
) {
  const [jogoInstancia, setJogoInstancia] = useState<Game | null>(null)
  const [status, setStatus] = useState<StatusPartida>('pausado')
  const [placar, setPlacar] = useState<number[]>([0])
  const [vidas, setVidas] = useState<number[]>([manifest.vidasIniciais ?? VIDAS_PADRAO])
  const [terminou, setTerminou] = useState(false)
  const hostRef = useRef<GameHost | null>(null)

  useEffect(() => {
    let cancelado = false
    manifest.carregar().then((modulo) => {
      if (!cancelado) setJogoInstancia(new modulo.default())
    })
    return () => {
      cancelado = true
    }
  }, [manifest])

  useEffect(() => {
    if (!trackerPronto || !podeIniciar || !jogoInstancia || !canvasRef.current || !trackerRef.current) return

    const host = new GameHost(
      canvasRef.current,
      jogoInstancia,
      trackerRef.current,
      {
        jogadores: 1,
        modo: 'solo',
        largura,
        altura,
        vidasIniciais: manifest.vidasIniciais ?? VIDAS_PADRAO,
      },
      {
        aoMudarStatus: setStatus,
        aoMudarPlacar: setPlacar,
        aoMudarVidas: setVidas,
        aoTerminar: () => setTerminou(true),
      },
      audio,
    )
    hostRef.current = host
    host.iniciar()

    return () => {
      host.destruir()
      hostRef.current = null
    }
    // largura/altura/manifest/audio são fixos para a tela de Partida; só remonta o host
    // quando o tracker fica pronto, o jogador confirma o início ou o jogo carregado muda.
  }, [trackerPronto, podeIniciar, jogoInstancia, canvasRef, trackerRef, largura, altura, manifest, audio])

  return {
    status,
    placar,
    vidas,
    terminou,
    pausar: () => hostRef.current?.pausar(),
    retomar: () => hostRef.current?.retomar(),
  }
}
