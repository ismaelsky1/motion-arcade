import { useMemo } from 'react'
import { resolverResultadoPor, type GameManifest, type Modo } from '../games/types'
import { obterRecorde, registrarPontuacao } from '../core/scores'
import { corDoJogador, nomeDoJogador } from '../core/jogadores'
import './Resultado.css'

export default function Resultado({
  manifest,
  modo,
  placar,
  vidas,
  aoJogarDeNovo,
  aoVoltarBiblioteca,
}: {
  manifest: GameManifest
  modo: Modo
  placar: number[]
  vidas: number[]
  aoJogarDeNovo: () => void
  aoVoltarBiblioteca: () => void
}) {
  const porVidas = resolverResultadoPor(manifest.resultadoPor, modo) === 'vidas'

  const pontuacaoParaRecorde =
    modo === 'coop' ? placar.reduce((soma, p) => soma + p, 0) : Math.max(0, ...placar)

  const { recorde, novoRecorde } = useMemo(() => {
    // Jogos rankeados por vidas (sem placar comparável) não alimentam o sistema de recorde.
    if (porVidas) return { recorde: 0, novoRecorde: false }
    const novoRecorde = registrarPontuacao(manifest.id, pontuacaoParaRecorde)
    return { recorde: obterRecorde(manifest.id), novoRecorde }
    // recalcula só quando muda a partida (jogo ou pontuação final), não a cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest.id, pontuacaoParaRecorde, porVidas])

  const ranking =
    modo === 'versus' && placar.length > 1
      ? (porVidas ? vidas : placar)
          .map((valor, i) => ({ jogador: i, pontos: valor }))
          .sort((a, b) => b.pontos - a.pontos)
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
              <span className="resultado-ranking-pontos">
                {porVidas ? '♥'.repeat(pontos) : pontos}
              </span>
            </li>
          ))}
        </ol>
      ) : !porVidas ? (
        <p className="resultado-placar">{pontuacaoParaRecorde}</p>
      ) : null}

      {!porVidas &&
        (novoRecorde ? (
          <p className="resultado-recorde novo">Novo recorde!</p>
        ) : (
          <p className="resultado-recorde">Recorde: {recorde}</p>
        ))}

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
