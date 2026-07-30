// Guerreiro Solitário — espelho de movimento em 3D: um avatar de corpo inteiro imita a pose
// do jogador em tempo real numa ilha tropical. Sem pontuação, sem vidas, sem cronômetro
// (nunca chama pontuar/perderVida; a sessão termina só pelo botão "Sair" da Partida).
//
// Integração com o núcleo sem mexer no contrato: o Game.render recebe um contexto 2D, então
// o Three.js renderiza num canvas WebGL offscreen próprio e o resultado é copiado por frame
// com ctx.drawImage — tudo dentro de init/update/render/destroy.

import * as THREE from 'three'
import type { Game, GameInitParams, Viewport } from '../types'
import type { ControlState } from '../../tracking/tracker'
import type { PoseKeypoint } from '../../tracking/poseUtils'
import { Avatar, type Junta, type PoseAlvo } from './avatar'
import { montarCenario, CHAO_Y, type Cenario } from './cenario'
import { SomDeOndas } from './somDeOndas'

const LIMIAR_CONFIANCA = 0.3
// Distância ombros→quadril do avatar em metros: âncora da escala corpo real → mundo 3D
// (o tamanho aparente do jogador na câmera muda com a distância; o avatar, não).
const COMPRIMENTO_TRONCO_3D = 0.55
// Quanto o avatar passeia pela ilha quando o jogador anda pros lados no quadro.
const LARGURA_PASSEIO = 3.4
// Quando os tornozelos não estão visíveis (jogador enquadrado da cintura pra cima),
// estima o chão a partir do quadril: ~1,6 troncos abaixo dele.
const FATOR_CHAO_ESTIMADO = 1.6

// Pares junta do avatar ↔ keypoint do MoveNet (nomes COCO emitidos pelo PoseTracker).
const MAPA_JUNTAS: [Junta, string][] = [
  ['ombroE', 'left_shoulder'],
  ['ombroD', 'right_shoulder'],
  ['cotoveloE', 'left_elbow'],
  ['cotoveloD', 'right_elbow'],
  ['punhoE', 'left_wrist'],
  ['punhoD', 'right_wrist'],
  ['quadrilE', 'left_hip'],
  ['quadrilD', 'right_hip'],
  ['joelhoE', 'left_knee'],
  ['joelhoD', 'right_knee'],
  ['tornozeloE', 'left_ankle'],
  ['tornozeloD', 'right_ankle'],
]

export default class GuerreiroIlha implements Game {
  private largura = 0
  private altura = 0
  private canvas3d: HTMLCanvasElement | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private cena: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private cenario: Cenario | null = null
  private avatar: Avatar | null = null
  private som = new SomDeOndas()
  private tempo = 0
  // Estado de calibração contínua (suavizados por EMA, ver update):
  private tronco2DSuave = 0
  private chao2D: number | null = null
  private deslocX = 0

  init(params: GameInitParams) {
    this.largura = params.largura
    this.altura = params.altura
    this.tempo = 0
    this.tronco2DSuave = 0
    this.chao2D = null
    this.deslocX = 0

    this.canvas3d = document.createElement('canvas')
    this.canvas3d.width = params.largura
    this.canvas3d.height = params.altura

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas3d, antialias: true })
    this.renderer.setSize(params.largura, params.altura, false)

    this.cena = new THREE.Scene()
    this.cena.background = new THREE.Color(0x87ceeb)
    this.cena.fog = new THREE.Fog(0x9fd4f0, 25, 80)

    this.camera = new THREE.PerspectiveCamera(50, params.largura / params.altura, 0.1, 150)
    this.camera.position.set(0, 2.4, 6.4)
    this.camera.lookAt(0, 1.4, 0)

    this.cenario = montarCenario()
    this.cena.add(this.cenario.grupo)

    this.avatar = new Avatar()
    this.avatar.grupo.position.set(0, CHAO_Y, 0)
    this.cena.add(this.avatar.grupo)

    this.som.iniciar()
  }

  update(dt: number, controles: ControlState[]) {
    this.tempo += dt
    this.cenario?.animar(this.tempo)

    const controle = controles[0]
    if (!controle?.ativo || !this.avatar) return

    const keypoints = new Map<string, PoseKeypoint>()
    for (const ponto of controle.points as PoseKeypoint[]) {
      if (ponto.name && ponto.score >= LIMIAR_CONFIANCA) keypoints.set(ponto.name, ponto)
    }

    const ombroE = keypoints.get('left_shoulder')
    const ombroD = keypoints.get('right_shoulder')
    const quadrilE = keypoints.get('left_hip')
    const quadrilD = keypoints.get('right_hip')
    // Sem tronco confiável não há escala nem âncora — mantém a última pose.
    if (!ombroE || !ombroD || !quadrilE || !quadrilD) return

    // Os keypoints são normalizados 0-1 por eixo num quadro 4:3; corrige o x pelo aspecto
    // pra distâncias horizontais e verticais ficarem na mesma unidade física.
    const aspecto = this.largura / this.altura
    const midOmbro = { x: (ombroE.x + ombroD.x) / 2, y: (ombroE.y + ombroD.y) / 2 }
    const midQuadril = { x: (quadrilE.x + quadrilD.x) / 2, y: (quadrilE.y + quadrilD.y) / 2 }

    const tronco2D = Math.hypot((midOmbro.x - midQuadril.x) * aspecto, midOmbro.y - midQuadril.y)
    if (tronco2D < 0.02) return
    this.tronco2DSuave = this.tronco2DSuave === 0 ? tronco2D : lerp(this.tronco2DSuave, tronco2D, 0.1)
    const escala = COMPRIMENTO_TRONCO_3D / this.tronco2DSuave

    // Linha do chão: EMA lenta do ponto mais baixo dos tornozelos. Lenta de propósito —
    // agachar/pular muda a pose rápido, mas o chão de verdade quase não muda; assim o
    // avatar levanta os pés da areia num pulo em vez de o mundo "descer" junto.
    const tornozeloE = keypoints.get('left_ankle')
    const tornozeloD = keypoints.get('right_ankle')
    const chaoAlvo =
      tornozeloE || tornozeloD
        ? Math.max(tornozeloE?.y ?? -Infinity, tornozeloD?.y ?? -Infinity) + 0.02
        : midQuadril.y + this.tronco2DSuave * FATOR_CHAO_ESTIMADO
    if (this.chao2D === null) this.chao2D = chaoAlvo
    else this.chao2D = lerp(this.chao2D, chaoAlvo, 1 - Math.exp(-dt * (tornozeloE || tornozeloD ? 1.2 : 0.4)))
    const chao2D = this.chao2D

    // Andar pros lados no quadro passeia o avatar pela ilha (suavizado).
    const deslocAlvo = clamp(midQuadril.x - 0.5, -0.5, 0.5) * LARGURA_PASSEIO
    this.deslocX = lerp(this.deslocX, deslocAlvo, 1 - Math.exp(-dt * 6))

    const para3D = (p: { x: number; y: number }) =>
      new THREE.Vector3(
        (p.x - midQuadril.x) * aspecto * escala + this.deslocX,
        Math.max((chao2D - p.y) * escala, 0.02),
        0,
      )

    const alvos: PoseAlvo = {}
    for (const [junta, nomeKeypoint] of MAPA_JUNTAS) {
      const ponto = keypoints.get(nomeKeypoint)
      if (ponto) alvos[junta] = para3D(ponto)
    }

    // Cabeça: nariz quando visível; senão, extrapola acima do meio dos ombros.
    const nariz = keypoints.get('nose')
    alvos.cabeca = nariz
      ? para3D(nariz).add(ALTURA_CENTRO_CABECA)
      : para3D(midOmbro).add(CABECA_ESTIMADA)

    // Suavização dependente do dt (não do frame rate) contra o jitter do MoveNet.
    this.avatar.aplicarPose(alvos, 1 - Math.exp(-dt * 14))
  }

  render(ctx: CanvasRenderingContext2D, viewport: Viewport) {
    if (!this.renderer || !this.cena || !this.camera || !this.canvas3d) return
    this.renderer.render(this.cena, this.camera)
    ctx.drawImage(this.canvas3d, viewport.x, viewport.y, viewport.largura, viewport.altura)
  }

  destroy() {
    this.som.parar()
    this.cena?.traverse((objeto) => {
      if (objeto instanceof THREE.Mesh) {
        objeto.geometry.dispose()
        const materiais = Array.isArray(objeto.material) ? objeto.material : [objeto.material]
        for (const material of materiais) material.dispose()
      }
    })
    // forceContextLoss libera o contexto WebGL de verdade — sem isso, jogar várias vezes
    // seguidas acumularia contextos até o navegador começar a derrubá-los.
    this.renderer?.dispose()
    this.renderer?.forceContextLoss()
    this.renderer = null
    this.cena = null
    this.camera = null
    this.cenario = null
    this.avatar = null
    this.canvas3d = null
  }
}

// O nariz fica na face; o centro do crânio fica um pouco acima dele.
const ALTURA_CENTRO_CABECA = new THREE.Vector3(0, 0.06, 0)
const CABECA_ESTIMADA = new THREE.Vector3(0, 0.33, 0)

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor))
}
