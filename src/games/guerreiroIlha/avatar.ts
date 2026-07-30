// Avatar 3D estilizado de guerreiro (cabelo preto espetado, gi laranja, faixa/punhos/botas
// azuis) montado só com primitivas do Three.js — modelagem própria, sem assets de terceiros.
//
// O esqueleto não usa bones/skinning: cada segmento (braço, antebraço, coxa, canela, tronco)
// é um cilindro/caixa reposicionado por frame entre as posições 3D das juntas, que o game.ts
// calcula a partir dos 17 keypoints do PoseTracker (MoveNet).

import * as THREE from 'three'

export type Junta =
  | 'cabeca'
  | 'ombroE'
  | 'ombroD'
  | 'cotoveloE'
  | 'cotoveloD'
  | 'punhoE'
  | 'punhoD'
  | 'quadrilE'
  | 'quadrilD'
  | 'joelhoE'
  | 'joelhoD'
  | 'tornozeloE'
  | 'tornozeloD'

export type PoseAlvo = Partial<Record<Junta, THREE.Vector3>>

const CORES = {
  pele: 0xf2c18d,
  gi: 0xf07818,
  azul: 0x27408f,
  bota: 0x1c2a5e,
  cabelo: 0x191919,
}

// Pose inicial em pé (relaxada), usada antes da primeira detecção — em metros, com o chão
// do avatar em y = 0 (o game.ts posiciona o grupo no topo da ilha).
const POSE_INICIAL: Record<Junta, [number, number, number]> = {
  cabeca: [0, 1.62, 0],
  ombroE: [-0.22, 1.42, 0],
  ombroD: [0.22, 1.42, 0],
  cotoveloE: [-0.34, 1.14, 0],
  cotoveloD: [0.34, 1.14, 0],
  punhoE: [-0.42, 0.88, 0],
  punhoD: [0.42, 0.88, 0],
  quadrilE: [-0.12, 0.92, 0],
  quadrilD: [0.12, 0.92, 0],
  joelhoE: [-0.14, 0.5, 0],
  joelhoD: [0.14, 0.5, 0],
  tornozeloE: [-0.15, 0.07, 0],
  tornozeloD: [0.15, 0.07, 0],
}

const EIXO_Y = new THREE.Vector3(0, 1, 0)

// Cilindro unitário (raio 1, altura 1) posicionado entre duas juntas: meio no ponto médio,
// eixo Y alinhado à direção, escala = (espessura, comprimento, espessura).
function posicionarOsso(malha: THREE.Mesh, de: THREE.Vector3, ate: THREE.Vector3, espessura: number) {
  const direcao = new THREE.Vector3().subVectors(ate, de)
  const comprimento = Math.max(direcao.length(), 0.001)
  malha.position.copy(de).addScaledVector(direcao, 0.5)
  malha.quaternion.setFromUnitVectors(EIXO_Y, direcao.divideScalar(comprimento))
  malha.scale.set(espessura, comprimento, espessura)
}

interface Osso {
  malha: THREE.Mesh
  de: Junta
  ate: Junta
  espessura: number
}

export class Avatar {
  readonly grupo = new THREE.Group()
  private juntas: Record<Junta, THREE.Vector3>
  private ossos: Osso[] = []
  private tronco: THREE.Mesh
  private faixa: THREE.Mesh
  private pescoco: THREE.Mesh
  private cabeca: THREE.Group
  private ombroEsferaE: THREE.Mesh
  private ombroEsferaD: THREE.Mesh
  private pulseiraE: THREE.Mesh
  private pulseiraD: THREE.Mesh
  private maoE: THREE.Mesh
  private maoD: THREE.Mesh
  private peE: THREE.Mesh
  private peD: THREE.Mesh

  constructor() {
    this.juntas = Object.fromEntries(
      Object.entries(POSE_INICIAL).map(([nome, [x, y, z]]) => [nome, new THREE.Vector3(x, y, z)]),
    ) as Record<Junta, THREE.Vector3>

    const materialPele = new THREE.MeshStandardMaterial({ color: CORES.pele, roughness: 0.8 })
    const materialGi = new THREE.MeshStandardMaterial({ color: CORES.gi, roughness: 0.85 })
    const materialAzul = new THREE.MeshStandardMaterial({ color: CORES.azul, roughness: 0.8 })
    const materialBota = new THREE.MeshStandardMaterial({ color: CORES.bota, roughness: 0.85 })

    const cilindro = new THREE.CylinderGeometry(1, 1, 1, 10)
    const esfera = new THREE.SphereGeometry(1, 14, 12)
    const caixa = new THREE.BoxGeometry(1, 1, 1)

    // Membros: braço (manga azul da camiseta de baixo), antebraço (pele), pernas (calça laranja).
    const definirOsso = (de: Junta, ate: Junta, espessura: number, material: THREE.Material) => {
      const malha = new THREE.Mesh(cilindro, material)
      this.grupo.add(malha)
      this.ossos.push({ malha, de, ate, espessura })
    }
    definirOsso('ombroE', 'cotoveloE', 0.058, materialAzul)
    definirOsso('ombroD', 'cotoveloD', 0.058, materialAzul)
    definirOsso('cotoveloE', 'punhoE', 0.05, materialPele)
    definirOsso('cotoveloD', 'punhoD', 0.05, materialPele)
    definirOsso('quadrilE', 'joelhoE', 0.08, materialGi)
    definirOsso('quadrilD', 'joelhoD', 0.08, materialGi)
    definirOsso('joelhoE', 'tornozeloE', 0.065, materialGi)
    definirOsso('joelhoD', 'tornozeloD', 0.065, materialGi)

    // Tronco (gi laranja) e faixa azul na cintura — caixas orientadas pela base
    // ombros/quadril, com largura acompanhando a distância real entre os ombros.
    this.tronco = new THREE.Mesh(caixa, materialGi)
    this.faixa = new THREE.Mesh(caixa, materialAzul)
    this.pescoco = new THREE.Mesh(cilindro, materialPele)
    this.grupo.add(this.tronco, this.faixa, this.pescoco)

    // Ombreiras arredondadas do gi.
    this.ombroEsferaE = new THREE.Mesh(esfera, materialGi)
    this.ombroEsferaD = new THREE.Mesh(esfera, materialGi)
    this.ombroEsferaE.scale.setScalar(0.085)
    this.ombroEsferaD.scale.setScalar(0.085)
    this.grupo.add(this.ombroEsferaE, this.ombroEsferaD)

    // Munhequeiras azuis + mãos de pele (a mão extrapola um pouco além do punho).
    this.pulseiraE = new THREE.Mesh(esfera, materialAzul)
    this.pulseiraD = new THREE.Mesh(esfera, materialAzul)
    this.pulseiraE.scale.setScalar(0.065)
    this.pulseiraD.scale.setScalar(0.065)
    this.maoE = new THREE.Mesh(esfera, materialPele)
    this.maoD = new THREE.Mesh(esfera, materialPele)
    this.maoE.scale.setScalar(0.055)
    this.maoD.scale.setScalar(0.055)
    this.grupo.add(this.pulseiraE, this.pulseiraD, this.maoE, this.maoD)

    // Botas azul-escuras.
    this.peE = new THREE.Mesh(caixa, materialBota)
    this.peD = new THREE.Mesh(caixa, materialBota)
    this.peE.scale.set(0.14, 0.1, 0.26)
    this.peD.scale.set(0.14, 0.1, 0.26)
    this.grupo.add(this.peE, this.peD)

    this.cabeca = montarCabeca(materialPele)
    this.grupo.add(this.cabeca)

    this.reposicionarMalhas()
  }

  // Interpola as juntas atuais em direção aos alvos (suavização contra o jitter do MoveNet)
  // e reposiciona todas as malhas. Juntas ausentes no alvo mantêm a última posição.
  aplicarPose(alvos: PoseAlvo, alpha: number) {
    for (const nome of Object.keys(this.juntas) as Junta[]) {
      const alvo = alvos[nome]
      if (alvo) this.juntas[nome].lerp(alvo, alpha)
    }
    this.reposicionarMalhas()
  }

  private reposicionarMalhas() {
    const j = this.juntas
    const midOmbro = j.ombroE.clone().add(j.ombroD).multiplyScalar(0.5)
    const midQuadril = j.quadrilE.clone().add(j.quadrilD).multiplyScalar(0.5)

    // Tronco: base ortonormal (Y = quadril→ombros, X = linha dos ombros) pra acompanhar
    // inclinação e rotação do corpo sem perder o "rolamento".
    const eixoY = midOmbro.clone().sub(midQuadril)
    const alturaTronco = Math.max(eixoY.length(), 0.001)
    eixoY.divideScalar(alturaTronco)
    const eixoXBruto = j.ombroD.clone().sub(j.ombroE)
    const eixoZ = new THREE.Vector3().crossVectors(eixoXBruto, eixoY)
    if (eixoZ.lengthSq() < 1e-6) eixoZ.set(0, 0, 1)
    eixoZ.normalize()
    const eixoX = new THREE.Vector3().crossVectors(eixoY, eixoZ).normalize()
    const larguraOmbros = j.ombroE.distanceTo(j.ombroD)

    this.tronco.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(eixoX, eixoY, eixoZ))
    this.tronco.position.copy(midOmbro).add(midQuadril).multiplyScalar(0.5)
    this.tronco.scale.set(larguraOmbros + 0.14, alturaTronco + 0.14, 0.22)

    this.faixa.quaternion.copy(this.tronco.quaternion)
    this.faixa.position.copy(midQuadril).addScaledVector(eixoY, 0.03)
    this.faixa.scale.set((larguraOmbros + 0.14) * 0.84, 0.1, 0.24)

    posicionarOsso(this.pescoco, midOmbro, j.cabeca, 0.05)

    this.cabeca.position.copy(j.cabeca)
    const direcaoCabeca = j.cabeca.clone().sub(midOmbro)
    this.cabeca.quaternion.setFromUnitVectors(
      EIXO_Y,
      direcaoCabeca.lengthSq() > 1e-6 ? direcaoCabeca.normalize() : EIXO_Y,
    )

    for (const osso of this.ossos) {
      posicionarOsso(osso.malha, j[osso.de], j[osso.ate], osso.espessura)
    }

    this.ombroEsferaE.position.copy(j.ombroE)
    this.ombroEsferaD.position.copy(j.ombroD)
    this.pulseiraE.position.copy(j.punhoE)
    this.pulseiraD.position.copy(j.punhoD)
    posicionarMao(this.maoE, j.cotoveloE, j.punhoE)
    posicionarMao(this.maoD, j.cotoveloD, j.punhoD)
    this.peE.position.copy(j.tornozeloE).add(POSICAO_RELATIVA_PE)
    this.peD.position.copy(j.tornozeloD).add(POSICAO_RELATIVA_PE)
  }
}

const POSICAO_RELATIVA_PE = new THREE.Vector3(0, -0.04, 0.07)

// A mão fica um pouco além do punho, na direção do antebraço.
function posicionarMao(mao: THREE.Mesh, cotovelo: THREE.Vector3, punho: THREE.Vector3) {
  const direcao = punho.clone().sub(cotovelo)
  if (direcao.lengthSq() > 1e-6) direcao.normalize()
  mao.position.copy(punho).addScaledVector(direcao, 0.09)
}

function montarCabeca(materialPele: THREE.MeshStandardMaterial): THREE.Group {
  const cabeca = new THREE.Group()

  const cranio = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 14), materialPele)
  cranio.scale.setScalar(0.15)
  cabeca.add(cranio)

  // Olhos e boca simples, virados pra câmera (+Z).
  const materialEscuro = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 })
  const geometriaOlho = new THREE.SphereGeometry(0.018, 8, 6)
  const olhoE = new THREE.Mesh(geometriaOlho, materialEscuro)
  const olhoD = new THREE.Mesh(geometriaOlho, materialEscuro)
  olhoE.position.set(-0.055, 0.015, 0.132)
  olhoD.position.set(0.055, 0.015, 0.132)
  const boca = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.01), materialEscuro)
  boca.position.set(0, -0.06, 0.14)
  cabeca.add(olhoE, olhoD, boca)

  // Cabelo espetado: coroa de espigas (cones pretos) apontando pra cima/fora, com
  // inclinações e comprimentos variados, + franja caindo sobre a testa.
  const materialCabelo = new THREE.MeshStandardMaterial({ color: CORES.cabelo, roughness: 0.6 })
  const geometriaEspiga = new THREE.ConeGeometry(0.055, 1, 5)
  const cabelo = new THREE.Group()
  const totalEspigas = 11
  for (let i = 0; i < totalEspigas; i++) {
    const anguloY = (i / totalEspigas) * Math.PI * 2
    const inclinacao = 0.4 + (i % 3) * 0.24 // radianos a partir da vertical
    const direcao = new THREE.Vector3(
      Math.sin(anguloY) * Math.sin(inclinacao),
      Math.cos(inclinacao),
      Math.cos(anguloY) * Math.sin(inclinacao),
    )
    const comprimento = 0.26 + (i % 4) * 0.05
    const espiga = new THREE.Mesh(geometriaEspiga, materialCabelo)
    espiga.quaternion.setFromUnitVectors(EIXO_Y, direcao)
    espiga.position.copy(direcao).multiplyScalar(0.09 + comprimento / 2)
    espiga.scale.set(1, comprimento, 1)
    cabelo.add(espiga)
  }
  const direcoesFranja: [number, number, number][] = [
    [-0.4, 0.3, 0.85],
    [0.05, 0.35, 0.95],
    [0.42, 0.28, 0.82],
  ]
  for (const [x, y, z] of direcoesFranja) {
    const direcao = new THREE.Vector3(x, y, z).normalize()
    const franja = new THREE.Mesh(geometriaEspiga, materialCabelo)
    franja.quaternion.setFromUnitVectors(EIXO_Y, direcao)
    franja.position.copy(direcao).multiplyScalar(0.09 + 0.09)
    franja.scale.set(0.9, 0.18, 0.9)
    cabelo.add(franja)
  }
  cabeca.add(cabelo)

  return cabeca
}
