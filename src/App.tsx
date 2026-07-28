import { useEffect, useRef, useState } from 'react'
import Biblioteca from './ui/Biblioteca'
import TesteCamera from './ui/TesteCamera'
import SelecaoDeModo from './ui/SelecaoDeModo'
import Lobby from './ui/Lobby'
import TesteDeAlcance from './ui/TesteDeAlcance'
import Partida from './ui/Partida'
import Resultado from './ui/Resultado'
import { useTracker } from './hooks/useTracker'
import { ResolvedorDeZonas } from './tracking/zonas'
import type { Tracker } from './tracking/tracker'
import type { GameManifest, Modo } from './games/types'
import './ui/Partida.css'

type Tela =
  | 'biblioteca'
  | 'testeCamera'
  | 'selecaoDeModo'
  | 'lobby'
  | 'testeDeAlcance'
  | 'partida'
  | 'resultado'

const TELAS_COM_CAMERA: Tela[] = ['lobby', 'testeDeAlcance', 'partida']
const LARGURA = 640
const ALTURA = 480

function App() {
  const [tela, setTela] = useState<Tela>('biblioteca')
  const [jogoAtual, setJogoAtual] = useState<GameManifest | null>(null)
  const [modo, setModo] = useState<Modo>('solo')
  const [jogadoresAlvo, setJogadoresAlvo] = useState(1)
  const [jogadoresConfirmados, setJogadoresConfirmados] = useState(1)
  const [placarFinal, setPlacarFinal] = useState<number[]>([])
  const [vidasFinais, setVidasFinais] = useState<number[]>([])
  const [precisaNovoResolvedor, setPrecisaNovoResolvedor] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const resolvedorRef = useRef<Tracker | null>(null)

  const cameraAtiva = TELAS_COM_CAMERA.includes(tela)
  const usaZonas = !jogoAtual?.capacidades.includes('pose')
  const { trackerRef, status: statusCamera, erro, poucaLuz, tentarNovamente } = useTracker(
    videoRef,
    cameraAtiva,
    jogoAtual?.capacidades ?? [],
  )

  useEffect(() => {
    if (precisaNovoResolvedor && statusCamera === 'pronto' && trackerRef.current) {
      resolvedorRef.current = usaZonas
        ? new ResolvedorDeZonas(trackerRef.current, jogadoresAlvo)
        : trackerRef.current
      setPrecisaNovoResolvedor(false)
    }
  }, [precisaNovoResolvedor, statusCamera, jogadoresAlvo, trackerRef, usaZonas])

  function voltarBiblioteca() {
    resolvedorRef.current = null
    setJogoAtual(null)
    setTela('biblioteca')
  }

  function aoJogar(manifest: GameManifest) {
    setJogoAtual(manifest)
    setTela('selecaoDeModo')
  }

  function aoConfirmarSelecaoDeModo(opcoes: { modo: Modo; jogadores: number }) {
    setModo(opcoes.modo)
    setJogadoresAlvo(opcoes.jogadores)
    setPrecisaNovoResolvedor(true)
    setTela('lobby')
  }

  function aoConfirmarLobby(jogadoresProntos: number) {
    if (trackerRef.current) {
      resolvedorRef.current = usaZonas
        ? new ResolvedorDeZonas(trackerRef.current, jogadoresProntos)
        : trackerRef.current
    }
    setJogadoresConfirmados(jogadoresProntos)
    setTela(jogoAtual?.testeDeAlcance === 'inaplicavel' ? 'partida' : 'testeDeAlcance')
  }

  function voltarParaLobbyPorAusencia() {
    setPrecisaNovoResolvedor(true)
    setTela('lobby')
  }

  if (tela === 'testeCamera') {
    return <TesteCamera aoVoltar={voltarBiblioteca} />
  }

  if (tela === 'selecaoDeModo' && jogoAtual) {
    return (
      <SelecaoDeModo
        manifest={jogoAtual}
        aoConfirmar={aoConfirmarSelecaoDeModo}
        aoVoltar={voltarBiblioteca}
      />
    )
  }

  const precisaCamera = TELAS_COM_CAMERA.includes(tela)
  const cameraPronta = statusCamera === 'pronto' && resolvedorRef.current !== null

  // O <video> é montado UMA vez aqui e persiste por toda a sessão de câmera (Lobby → Teste
  // de Alcance → Partida): se cada tela montasse o seu próprio <video>, a troca de tela
  // desmontaria o elemento que o tracker está lendo e travaria em "Iniciando câmera…".
  // Durante a Partida, ela mesma assume a classe do vídeo via ref (ver Partida.tsx) — por
  // isso não passamos className quando tela === 'partida', para o React não sobrescrever.
  if (precisaCamera) {
    return (
      <div className="partida">
        <div className="palco" style={{ aspectRatio: `${LARGURA} / ${ALTURA}` }}>
          <video
            ref={videoRef}
            className={tela === 'partida' ? undefined : 'video-espelhado'}
            muted
            playsInline
          />

          {!cameraPronta &&
            (statusCamera === 'erro' ? (
              <div className="pre-jogo-sobreposicao">
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
                  <button className="acao-secundaria" onClick={voltarBiblioteca}>
                    Voltar à biblioteca
                  </button>
                </div>
              </div>
            ) : (
              <div className="pre-jogo-sobreposicao">
                <p>Iniciando câmera…</p>
              </div>
            ))}

          {cameraPronta && tela === 'lobby' && jogoAtual && resolvedorRef.current && (
            <Lobby
              manifest={jogoAtual}
              jogadoresAlvo={jogadoresAlvo}
              resolvedor={resolvedorRef.current}
              aoConfirmar={aoConfirmarLobby}
              aoVoltar={voltarBiblioteca}
            />
          )}

          {cameraPronta && tela === 'testeDeAlcance' && jogoAtual && resolvedorRef.current && (
            <TesteDeAlcance
              manifest={jogoAtual}
              jogadores={jogadoresConfirmados}
              resolvedor={resolvedorRef.current as ResolvedorDeZonas}
              aoConcluir={() => setTela('partida')}
              aoJogadorSumiu={voltarParaLobbyPorAusencia}
            />
          )}

          {cameraPronta && tela === 'partida' && jogoAtual && resolvedorRef.current && (
            <Partida
              manifest={jogoAtual}
              jogadores={jogadoresConfirmados}
              modo={modo}
              videoRef={videoRef}
              trackerRef={resolvedorRef}
              poucaLuz={poucaLuz}
              aoTerminar={(placar, vidas) => {
                setPlacarFinal(placar)
                setVidasFinais(vidas)
                setTela('resultado')
              }}
              aoVoltar={voltarBiblioteca}
              aoJogadorSumiu={voltarParaLobbyPorAusencia}
            />
          )}
        </div>
      </div>
    )
  }

  if (tela === 'resultado' && jogoAtual) {
    return (
      <Resultado
        manifest={jogoAtual}
        modo={modo}
        placar={placarFinal}
        vidas={vidasFinais}
        aoJogarDeNovo={() => {
          setPrecisaNovoResolvedor(true)
          setTela('lobby')
        }}
        aoVoltarBiblioteca={voltarBiblioteca}
      />
    )
  }

  return (
    <Biblioteca
      aoTestarCamera={() => setTela('testeCamera')}
      aoJogar={aoJogar}
    />
  )
}

export default App
