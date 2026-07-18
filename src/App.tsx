import { useState } from 'react'
import Biblioteca from './ui/Biblioteca'
import TesteCamera from './ui/TesteCamera'
import Partida from './ui/Partida'
import Resultado from './ui/Resultado'
import type { GameManifest } from './games/types'

type Tela = 'biblioteca' | 'testeCamera' | 'partida' | 'resultado'

function App() {
  const [tela, setTela] = useState<Tela>('biblioteca')
  const [jogoAtual, setJogoAtual] = useState<GameManifest | null>(null)
  const [placarFinal, setPlacarFinal] = useState<number[]>([])

  if (tela === 'testeCamera') {
    return <TesteCamera aoVoltar={() => setTela('biblioteca')} />
  }

  if (tela === 'partida' && jogoAtual) {
    return (
      <Partida
        manifest={jogoAtual}
        aoTerminar={(placar) => {
          setPlacarFinal(placar)
          setTela('resultado')
        }}
        aoVoltar={() => setTela('biblioteca')}
      />
    )
  }

  if (tela === 'resultado' && jogoAtual) {
    return (
      <Resultado
        manifest={jogoAtual}
        placar={placarFinal}
        aoJogarDeNovo={() => setTela('partida')}
        aoVoltarBiblioteca={() => setTela('biblioteca')}
      />
    )
  }

  return (
    <Biblioteca
      aoTestarCamera={() => setTela('testeCamera')}
      aoJogar={(manifest) => {
        setJogoAtual(manifest)
        setTela('partida')
      }}
    />
  )
}

export default App
