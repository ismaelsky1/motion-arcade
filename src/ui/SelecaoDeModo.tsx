import { useState } from 'react'
import type { GameManifest, Modo } from '../games/types'
import './SelecaoDeModo.css'

const ROTULO_MODO: Record<Modo, string> = {
  solo: 'Solo',
  coop: 'Cooperativo',
  versus: 'Versus',
}

const DESCRICAO_MODO: Record<Modo, string> = {
  solo: 'Você sozinho contra o jogo.',
  coop: 'Todo mundo joga junto por um placar em equipe.',
  versus: 'Cada jogador com seu próprio placar — quem se sai melhor?',
}

export default function SelecaoDeModo({
  manifest,
  aoConfirmar,
  aoVoltar,
}: {
  manifest: GameManifest
  aoConfirmar: (opcoes: { modo: Modo; jogadores: number }) => void
  aoVoltar: () => void
}) {
  const [modo, setModo] = useState<Modo>(manifest.modos[0])
  const [jogadores, setJogadores] = useState(manifest.jogadores.min)

  const { min, max } = manifest.jogadores

  return (
    <div className="selecao-modo">
      <button className="voltar" onClick={aoVoltar}>
        ← Voltar
      </button>

      <h1>{manifest.titulo}</h1>
      <p className="selecao-modo-descricao">{manifest.descricao}</p>

      {manifest.modos.length > 1 && (
        <section className="selecao-bloco">
          <h2>Modo</h2>
          <div className="opcoes-modo">
            {manifest.modos.map((m) => (
              <button
                key={m}
                className={`opcao-modo ${modo === m ? 'selecionada' : ''}`}
                onClick={() => setModo(m)}
              >
                <span className="opcao-modo-titulo">{ROTULO_MODO[m]}</span>
                <span className="opcao-modo-descricao">{DESCRICAO_MODO[m]}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {max > 1 && (
        <section className="selecao-bloco">
          <h2>Jogadores</h2>
          <div className="stepper-jogadores">
            <button
              disabled={jogadores <= min}
              onClick={() => setJogadores((n) => Math.max(min, n - 1))}
            >
              −
            </button>
            <span className="stepper-valor">{jogadores}</span>
            <button
              disabled={jogadores >= max}
              onClick={() => setJogadores((n) => Math.min(max, n + 1))}
            >
              +
            </button>
          </div>
          {jogadores > 2 && (
            <p className="selecao-modo-dica">
              Jogos com mais jogadores pedem mais espaço na frente da câmera.
            </p>
          )}
        </section>
      )}

      <button className="acao-primaria" onClick={() => aoConfirmar({ modo, jogadores })}>
        Continuar
      </button>
    </div>
  )
}
