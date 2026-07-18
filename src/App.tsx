import { useState } from 'react'
import Biblioteca from './ui/Biblioteca'
import TesteCamera from './ui/TesteCamera'

type Tela = 'biblioteca' | 'testeCamera'

function App() {
  const [tela, setTela] = useState<Tela>('biblioteca')

  if (tela === 'testeCamera') {
    return <TesteCamera aoVoltar={() => setTela('biblioteca')} />
  }

  return <Biblioteca aoTestarCamera={() => setTela('testeCamera')} />
}

export default App
