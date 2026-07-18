import { useEffect, useRef, useState } from 'react'
import { useTracker } from '../hooks/useTracker'
import { useGameHost } from '../hooks/useGameHost'
import { AudioManager } from '../core/audio'
import type { GameManifest } from '../games/types'
import './Partida.css'

const LARGURA = 640
const ALTURA = 480
const CONTAGEM_INICIAL = 3

type Fase = 'instrucoes' | 'contagem' | 'jogando'

export default function Partida({
  manifest,
  aoTerminar,
  aoVoltar,
}: {
  manifest: GameManifest
  aoTerminar: (placar: number[]) => void
  aoVoltar: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<AudioManager | null>(null)
  if (!audioRef.current) audioRef.current = new AudioManager()

  const { trackerRef, status: statusCamera, erro, poucaLuz, tentarNovamente } = useTracker(videoRef)
  const [fase, setFase] = useState<Fase>('instrucoes')
  const [contagem, setContagem] = useState(CONTAGEM_INICIAL)

  const { status, placar, vidas, terminou, pausar, retomar } = useGameHost(
    canvasRef,
    trackerRef,
    statusCamera === 'pronto',
    fase === 'jogando',
    manifest,
    audioRef.current,
    LARGURA,
    ALTURA,
  )

  useEffect(() => {
    if (terminou) aoTerminar(placar)
  }, [terminou, placar, aoTerminar])

  useEffect(() => {
    if (fase !== 'contagem') return
    if (contagem <= 0) {
      setFase('jogando')
      return
    }
    audioRef.current?.contagem()
    const timeout = setTimeout(() => setContagem((n) => n - 1), 700)
    return () => clearTimeout(timeout)
  }, [fase, contagem])

  function comecar() {
    audioRef.current?.inicio()
    setContagem(CONTAGEM_INICIAL)
    setFase('contagem')
  }

  if (statusCamera === 'erro') {
    return (
      <div className="pre-jogo pre-jogo-erro">
        <h1>Não foi possível acessar a câmera</h1>
        <p>{erro}</p>
        <p className="pre-jogo-dica">
          Verifique se você permitiu o acesso à câmera para este site e se nenhum outro
          aplicativo está usando-a.
        </p>
        <div className="pre-jogo-acoes">
          <button className="acao-primaria" onClick={tentarNovamente}>
            Tentar novamente
          </button>
          <button className="acao-secundaria" onClick={aoVoltar}>
            Voltar à biblioteca
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="partida">
      <div className="palco" style={{ aspectRatio: `${LARGURA} / ${ALTURA}` }}>
        <canvas ref={canvasRef} width={LARGURA} height={ALTURA} />
        <video
          ref={videoRef}
          className={fase === 'jogando' ? 'camera-miniatura' : 'camera-fundo'}
          muted
          playsInline
        />

        {statusCamera === 'iniciando' && (
          <div className="pre-jogo-sobreposicao">
            <p>Iniciando câmera…</p>
          </div>
        )}

        {statusCamera === 'pronto' && fase === 'instrucoes' && (
          <div className="pre-jogo-sobreposicao">
            <h1>{manifest.titulo}</h1>
            <p>{manifest.descricao}</p>
            <p className="pre-jogo-dica">Use sua mão como cursor. Feche os dedos para "pegar".</p>
            {poucaLuz && (
              <p className="aviso-pouca-luz">
                Pouca luz detectada — aproxime-se de uma fonte de luz para melhorar o rastreio.
              </p>
            )}
            <div className="pre-jogo-acoes">
              <button className="acao-primaria" onClick={comecar}>
                Começar
              </button>
              <button className="acao-secundaria" onClick={aoVoltar}>
                Voltar
              </button>
            </div>
          </div>
        )}

        {fase === 'contagem' && (
          <div className="pre-jogo-sobreposicao">
            <p className="contagem-numero">{contagem}</p>
          </div>
        )}

        {fase === 'jogando' && (
          <>
            <div className="hud-placar">{placar[0] ?? 0}</div>
            <div className="hud-vidas">{'♥'.repeat(vidas[0] ?? 0)}</div>

            <button
              className="hud-pausa"
              onClick={() => (status === 'pausado' ? retomar() : pausar())}
            >
              {status === 'pausado' ? '▶' : '⏸'}
            </button>

            <button className="voltar-partida" onClick={aoVoltar}>
              ← Sair
            </button>

            {poucaLuz && <div className="aviso-pouca-luz flutuante">Pouca luz</div>}

            <div className={`pill ${status === 'jogando' ? 'pill-ok' : 'pill-alerta'}`}>
              {status === 'jogando' ? 'Jogando' : 'Mostre sua mão'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
