import { useEffect, useRef, useState, type RefObject } from 'react'
import { GameHost, type StatusPartida } from '../core/gameHost'
import type { AudioManager } from '../core/audio'
import type { Tracker } from '../tracking/tracker'
import { resolverTelaDividida, type Game, type GameManifest, type Modo } from '../games/types'

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
  jogadores: number,
  modo: Modo,
) {
  const [jogoInstancia, setJogoInstancia] = useState<Game | null>(null)
  const [status, setStatus] = useState<StatusPartida>('pausado')
  const [placar, setPlacar] = useState<number[]>(() => Array(jogadores).fill(0))
  const [vidas, setVidas] = useState<number[]>(() =>
    Array(jogadores).fill(manifest.vidasIniciais ?? VIDAS_PADRAO),
  )
  const [jogadoresInativos, setJogadoresInativos] = useState<number[]>([])
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
        jogadores,
        modo,
        telaDividida: resolverTelaDividida(manifest.telaDividida, modo),
        largura,
        altura,
        vidasIniciais: manifest.vidasIniciais ?? VIDAS_PADRAO,
      },
      {
        aoMudarStatus: setStatus,
        aoMudarPlacar: setPlacar,
        aoMudarVidas: setVidas,
        aoMudarJogadoresInativos: setJogadoresInativos,
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
    // largura/altura/manifest/audio/jogadores/modo são fixos para a tela de Partida; só
    // remonta o host quando o tracker fica pronto, o jogador confirma o início ou o jogo
    // carregado muda.
  }, [
    trackerPronto,
    podeIniciar,
    jogoInstancia,
    canvasRef,
    trackerRef,
    largura,
    altura,
    manifest,
    audio,
    jogadores,
    modo,
  ])

  return {
    status,
    placar,
    vidas,
    jogadoresInativos,
    terminou,
    pausar: () => hostRef.current?.pausar(),
    retomar: () => hostRef.current?.retomar(),
  }
}
