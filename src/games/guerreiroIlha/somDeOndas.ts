// Som ambiente de ondas do mar sintetizado via WebAudio (decisão de produto: sem assets
// externos, mesmo princípio do core/audio.ts). Vive no jogo — o AudioManager do núcleo só
// expõe efeitos pontuais (ponto/vida/fim), não um canal de ambiente contínuo.

interface JanelaComWebAudio extends Window {
  webkitAudioContext?: typeof AudioContext
}

export class SomDeOndas {
  private ctx: AudioContext | null = null

  iniciar() {
    if (this.ctx) return
    const Construtor = window.AudioContext ?? (window as JanelaComWebAudio).webkitAudioContext
    if (!Construtor) return
    const ctx = new Construtor()
    this.ctx = ctx
    if (ctx.state === 'suspended') ctx.resume()

    // Ruído branco em loop, filtrado grave = "chiado" de mar.
    const duracaoSegundos = 4
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duracaoSegundos, ctx.sampleRate)
    const dados = buffer.getChannelData(0)
    for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1

    const fonte = ctx.createBufferSource()
    fonte.buffer = buffer
    fonte.loop = true

    const filtro = ctx.createBiquadFilter()
    filtro.type = 'lowpass'
    filtro.frequency.value = 480
    filtro.Q.value = 0.7

    const ganho = ctx.createGain()
    ganho.gain.value = 0.045

    // LFO lento no volume = vaivém das ondas quebrando na praia.
    const lfoVolume = ctx.createOscillator()
    lfoVolume.frequency.value = 0.08
    const profundidadeVolume = ctx.createGain()
    profundidadeVolume.gain.value = 0.03
    lfoVolume.connect(profundidadeVolume)
    profundidadeVolume.connect(ganho.gain)

    // Segundo LFO, em outra frequência, no corte do filtro — quebra a regularidade
    // pra não soar como um ciclo mecânico perfeito.
    const lfoFiltro = ctx.createOscillator()
    lfoFiltro.frequency.value = 0.053
    const profundidadeFiltro = ctx.createGain()
    profundidadeFiltro.gain.value = 160
    lfoFiltro.connect(profundidadeFiltro)
    profundidadeFiltro.connect(filtro.frequency)

    fonte.connect(filtro)
    filtro.connect(ganho)
    ganho.connect(ctx.destination)
    fonte.start()
    lfoVolume.start()
    lfoFiltro.start()
  }

  parar() {
    // close() derruba todos os nós de uma vez; ignora rejeição se já estiver fechado.
    this.ctx?.close().catch(() => {})
    this.ctx = null
  }
}
