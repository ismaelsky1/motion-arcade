import { useMemo, useState } from 'react'
import { registry } from '../games/registry'
import type { Capacidade, GameManifest } from '../games/types'
import { obterRecorde } from '../core/scores'
import './Biblioteca.css'

const ROTULO_CAPACIDADE: Record<Capacidade, string> = {
  cursor: 'Mãos',
  gestos: 'Gestos',
  pose: 'Corpo inteiro',
  zonas: 'Movimento',
}

export default function Biblioteca({
  aoTestarCamera,
  aoJogar,
}: {
  aoTestarCamera: () => void
  aoJogar: (manifest: GameManifest) => void
}) {
  const [busca, setBusca] = useState('')
  const [comoFunciona, setComoFunciona] = useState(false)

  const destaque = registry[0]
  const jogosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return registry
    return registry.filter((jogo) => jogo.titulo.toLowerCase().includes(termo))
  }, [busca])

  return (
    <div className="biblioteca">
      <header className="cabecalho">
        <span className="logo">Motion Arcade</span>
        <nav className="navegacao">
          <button className="link-nav" onClick={() => setBusca('')}>
            Biblioteca
          </button>
          <button className="link-nav" onClick={() => setComoFunciona((v) => !v)}>
            Como funciona
          </button>
          <button className="link-nav" onClick={aoTestarCamera}>
            Ajustes
          </button>
        </nav>
        <input
          className="busca"
          type="search"
          placeholder="Buscar jogo…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </header>

      {comoFunciona && (
        <div className="como-funciona">
          <p>
            Você ativa a câmera e usa o próprio corpo ou as mãos como controle. Todo o
            processamento acontece no seu navegador — nenhum vídeo é enviado a nenhum
            servidor.
          </p>
        </div>
      )}

      {destaque && !busca && (
        <section className="hero" onClick={() => aoJogar(destaque)}>
          <div className="hero-capa">
            {destaque.capa ? <img src={destaque.capa} alt="" /> : <span>{destaque.titulo}</span>}
          </div>
          <div className="hero-info">
            <span className="hero-etiqueta">Recomendado</span>
            <h1>{destaque.titulo}</h1>
            <p>{destaque.descricao}</p>
            <button
              className="hero-jogar"
              onClick={(e) => {
                e.stopPropagation()
                aoJogar(destaque)
              }}
            >
              Jogar
            </button>
          </div>
        </section>
      )}

      <section className="grade">
        {jogosFiltrados.map((jogo) => {
          const recorde = obterRecorde(jogo.id)
          return (
            <article key={jogo.id} className="capsula" onClick={() => aoJogar(jogo)}>
              <div className="capa-placeholder">
                {jogo.capa ? (
                  <img src={jogo.capa} alt={jogo.titulo} />
                ) : (
                  <span>{jogo.titulo}</span>
                )}
              </div>
              <div className="capsula-info">
                <h2>{jogo.titulo}</h2>
                <span className="badge">{ROTULO_CAPACIDADE[jogo.capacidades[0]]}</span>
                {recorde > 0 && <p className="capsula-recorde">Seu recorde: {recorde}</p>}
              </div>
            </article>
          )
        })}

        {!busca && (
          <article className="capsula em-breve">
            <div className="capa-placeholder">
              <span>Em breve</span>
            </div>
          </article>
        )}

        {busca && jogosFiltrados.length === 0 && (
          <p className="sem-resultados">Nenhum jogo encontrado para "{busca}".</p>
        )}
      </section>
    </div>
  )
}
