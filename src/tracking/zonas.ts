import type { ControlState, Tracker } from './tracker'

export interface Calibracao {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

const CALIBRACAO_PADRAO: Calibracao = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }

// Distância máxima (em coordenadas normalizadas 0-1 do frame cheio) para considerar que uma
// mão detectada neste frame ainda é a mesma pessoa do frame anterior.
const DISTANCIA_MAX_IDENTIDADE = 0.18

function estadoInativo(cursorAnterior: { x: number; y: number }): ControlState {
  return {
    cursor: cursorAnterior,
    gestures: { pinch: false, thumbsUp: false, wave: false },
    points: [],
    ativo: false,
    confidence: 0,
  }
}

function aplicarCalibracao(valor: number, min: number, max: number): number {
  if (max <= min) return valor
  return Math.min(1, Math.max(0, (valor - min) / (max - min)))
}

// Converte a lista bruta e sem identidade de mãos detectadas (devolvida pelo Tracker) em
// controles[0..jogadores-1] estáveis: divide o quadro em faixas verticais, mantém a
// identidade de cada jogador entre frames por proximidade e renormaliza o cursor dentro da
// própria faixa, já aplicando a calibração do teste de alcance (seções 6.4/8.1 do
// planejamento). Implementa Tracker para poder substituir o tracker bruto em qualquer
// consumidor existente (GameHost, telas de pré-jogo) sem mudar seus contratos.
export class ResolvedorDeZonas implements Tracker {
  private readonly interno: Tracker
  private readonly jogadores: number
  private ultimaPosicao: { x: number; y: number }[]
  private calibracoes: Calibracao[]

  constructor(interno: Tracker, jogadores: number) {
    this.interno = interno
    this.jogadores = jogadores
    this.ultimaPosicao = Array.from({ length: jogadores }, (_, i) => ({
      x: (i + 0.5) / jogadores,
      y: 0.5,
    }))
    this.calibracoes = Array.from({ length: jogadores }, () => CALIBRACAO_PADRAO)
  }

  async start(videoElement: HTMLVideoElement) {
    await this.interno.start(videoElement)
  }

  stop() {
    this.interno.stop()
  }

  definirCalibracao(jogador: number, calibracao: Calibracao) {
    this.calibracoes[jogador] = calibracao
  }

  getState(): ControlState[] {
    return this.resolver(this.interno.getState())
  }

  private resolver(brutas: ControlState[]): ControlState[] {
    const largura = 1 / this.jogadores
    const candidatos = brutas.map((estado, indice) => ({ estado, indice }))
    const usados = new Set<number>()
    const resultado: (ControlState | null)[] = Array(this.jogadores).fill(null)

    // 1) preserva identidade: casa cada jogador com a mão bruta mais próxima da sua última posição
    for (let jogador = 0; jogador < this.jogadores; jogador++) {
      const ultima = this.ultimaPosicao[jogador]
      let melhor: { indice: number; distancia: number } | null = null
      for (const { estado, indice } of candidatos) {
        if (usados.has(indice)) continue
        const distancia = Math.hypot(estado.cursor.x - ultima.x, estado.cursor.y - ultima.y)
        if (distancia > DISTANCIA_MAX_IDENTIDADE) continue
        if (!melhor || distancia < melhor.distancia) melhor = { indice, distancia }
      }
      if (melhor) {
        usados.add(melhor.indice)
        resultado[jogador] = candidatos[melhor.indice].estado
      }
    }

    // 2) mãos ainda não casadas vão para o slot livre cuja faixa vertical contém a posição
    for (const { estado, indice } of candidatos) {
      if (usados.has(indice)) continue
      const faixaAlvo = Math.min(this.jogadores - 1, Math.floor(estado.cursor.x / largura))
      let jogador = faixaAlvo
      if (resultado[jogador] !== null) {
        jogador = resultado.findIndex((v) => v === null)
        if (jogador === -1) continue
      }
      usados.add(indice)
      resultado[jogador] = estado
    }

    // 3) monta a saída final: renormaliza dentro da faixa + calibração, ou marca inativo
    return resultado.map((estado, jogador) => {
      const calibracao = this.calibracoes[jogador]
      if (!estado) return estadoInativo(this.ultimaPosicao[jogador])

      this.ultimaPosicao[jogador] = estado.cursor
      const inicioFaixa = jogador * largura
      const xLocal = (estado.cursor.x - inicioFaixa) / largura

      return {
        ...estado,
        cursor: {
          x: aplicarCalibracao(xLocal, calibracao.xMin, calibracao.xMax),
          y: aplicarCalibracao(estado.cursor.y, calibracao.yMin, calibracao.yMax),
        },
      }
    })
  }
}
