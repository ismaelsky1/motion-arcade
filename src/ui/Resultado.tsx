import { useMemo } from 'react'
import type { GameManifest } from '../games/types'
import { obterRecorde, registrarPontuacao } from '../core/scores'
import './Resultado.css'

export default function Resultado({
  manifest,
  placar,
  aoJogarDeNovo,
  aoVoltarBiblioteca,
}: {
  manifest: GameManifest
  placar: number[]
  aoJogarDeNovo: () => void
  aoVoltarBiblioteca: () => void
}) {
  const pontuacao = placar[0] ?? 0
  const { recorde, novoRecorde } = useMemo(() => {
    const novoRecorde = registrarPontuacao(manifest.id, pontuacao)
    return { recorde: obterRecorde(manifest.id), novoRecorde }
    // recalcula só quando muda a partida (jogo ou pontuação final), não a cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest.id, pontuacao])

  return (
    <div className="resultado">
      <p className="resultado-jogo">{manifest.titulo}</p>
      <h1>Fim de jogo</h1>
      <p className="resultado-placar">{pontuacao}</p>
      {novoRecorde ? (
        <p className="resultado-recorde novo">Novo recorde!</p>
      ) : (
        <p className="resultado-recorde">Seu recorde: {recorde}</p>
      )}

      <div className="resultado-acoes">
        <button className="acao-primaria" onClick={aoJogarDeNovo}>
          Jogar de novo
        </button>
        <button className="acao-secundaria" onClick={aoVoltarBiblioteca}>
          Voltar à biblioteca
        </button>
      </div>
    </div>
  )
}
