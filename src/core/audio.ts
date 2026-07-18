// Sons compartilhados do núcleo (placar, vida perdida, fim de jogo).
// Sintetizados via WebAudio para não depender de arquivos de áudio externos.

type Nota = { frequencia: number; duracao: number; tipo?: OscillatorType }

export class AudioManager {
  private ctx: AudioContext | null = null
  private silenciado = false

  private obterContexto(): AudioContext | null {
    if (this.silenciado) return null
    if (!this.ctx) {
      const Construtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Construtor) return null
      this.ctx = new Construtor()
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return this.ctx
  }

  private tocarNotas(notas: Nota[]) {
    const ctx = this.obterContexto()
    if (!ctx) return

    let inicio = ctx.currentTime
    for (const nota of notas) {
      const osc = ctx.createOscillator()
      const ganho = ctx.createGain()
      osc.type = nota.tipo ?? 'sine'
      osc.frequency.value = nota.frequencia
      ganho.gain.setValueAtTime(0.15, inicio)
      ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + nota.duracao)
      osc.connect(ganho)
      ganho.connect(ctx.destination)
      osc.start(inicio)
      osc.stop(inicio + nota.duracao)
      inicio += nota.duracao * 0.6
    }
  }

  ponto() {
    this.tocarNotas([{ frequencia: 880, duracao: 0.1 }])
  }

  perdaDeVida() {
    this.tocarNotas([{ frequencia: 220, duracao: 0.18, tipo: 'square' }])
  }

  fimDeJogo() {
    this.tocarNotas([
      { frequencia: 392, duracao: 0.15 },
      { frequencia: 330, duracao: 0.15 },
      { frequencia: 262, duracao: 0.3 },
    ])
  }

  contagem() {
    this.tocarNotas([{ frequencia: 523, duracao: 0.08 }])
  }

  inicio() {
    this.tocarNotas([
      { frequencia: 523, duracao: 0.09 },
      { frequencia: 784, duracao: 0.18 },
    ])
  }

  definirSilenciado(valor: boolean) {
    this.silenciado = valor
  }
}
