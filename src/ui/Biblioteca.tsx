import { registry } from '../games/registry'
import type { Capacidade } from '../games/types'
import './Biblioteca.css'

const ROTULO_CAPACIDADE: Record<Capacidade, string> = {
  cursor: 'Mãos',
  gestos: 'Gestos',
  pose: 'Corpo inteiro',
  zonas: 'Movimento',
}

export default function Biblioteca({ aoTestarCamera }: { aoTestarCamera: () => void }) {
  return (
    <div className="biblioteca">
      <header className="biblioteca-header">
        <h1>Motion Arcade</h1>
        <p className="subtitulo">Jogos controlados pela câmera, direto no navegador.</p>
        <button className="link-teste" onClick={aoTestarCamera}>
          Teste de câmera (Fase 1)
        </button>
      </header>

      <section className="grade">
        {registry.map((jogo) => (
          <article key={jogo.id} className="capsula">
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
            </div>
          </article>
        ))}

        <article className="capsula em-breve">
          <div className="capa-placeholder">
            <span>Em breve</span>
          </div>
        </article>
      </section>
    </div>
  )
}
