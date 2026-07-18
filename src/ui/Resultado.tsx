import { useMemo } from 'react'
import type { GameManifest, Modo } from '../games/types'
import { obterRecorde, registrarPontuacao } from '../core/scores'
import { corDoJogador, nomeDoJogador } from '../core/jogadores'
import './Resultado.css'

export default function Resultado({
  manifest,
  modo,
  placar,
  aoJogarDeNovo,
  aoVoltarBiblioteca,
}: {
  manifest: GameManifest
  modo: Modo
  placar: number[]
  aoJogarDeNovo: () => void
  aoVoltarBiblioteca: () => void
}) {
  const pontuacaoParaRecorde =
    modo === 'coop' ? placar.reduce((soma, p) => soma + p, 0) : Math.max(0, ...placar)

  const { recorde, novoRecorde } = useMemo(() => {
    const novoRecorde = registrarPontuacao(manifest.id, pontuacaoParaRecorde)
    return { recorde: obterRecorde(manifest.id), novoRecorde }
    // recalcula só quando muda a partida (jogo ou pontuação final), não a cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest.id, pontuacaoParaRecorde])

  const ranking =
    modo === 'versus' && placar.length > 1
      ? placar.map((p, i) => ({ jogador: i, pontos: p })).sort((a, b) => b.pontos - a.pontos)
      : null

  return (
    <div className="resultado">
      <p className="resultado-jogo">{manifest.titulo}</p>
      <h1>Fim de jogo</h1>

      {ranking ? (
        <ol className="resultado-ranking">
          {ranking.map(({ jogador, pontos }, posicao) => (
            <li key={jogador} className={posicao === 0 ? 'primeiro' : ''}>
              <span className="resultado-ranking-cor" style={{ background: corDoJogador(jogador) }} />
              <span className="resultado-ranking-nome">{nomeDoJogador(jogador)}</span>
              <span className="resultado-ranking-pontos">{pontos}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="resultado-placar">{pontuacaoParaRecorde}</p>
      )}

      {novoRecorde ? (
        <p className="resultado-recorde novo">Novo recorde!</p>
      ) : (
        <p className="resultado-recorde">Recorde: {recorde}</p>
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
