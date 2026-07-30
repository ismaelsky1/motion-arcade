// Cenário da ilha: mar, ilhota de areia, um único coqueiro, sol e nuvens — tudo com
// geometria/materiais próprios do Three.js, sem assets externos.

import * as THREE from 'three'

// Altura do topo da ilha — o avatar e o coqueiro apoiam os pés aqui.
export const CHAO_Y = 0.6

export interface Cenario {
  grupo: THREE.Group
  animar(tempo: number): void
}

export function montarCenario(): Cenario {
  const grupo = new THREE.Group()

  // Luzes: hemisférica (céu azulado / areia quente) + sol direcional.
  grupo.add(new THREE.HemisphereLight(0xbfe3ff, 0xe8d09a, 0.95))
  const sol = new THREE.DirectionalLight(0xfff2d0, 1.3)
  sol.position.set(5, 9, 4)
  grupo.add(sol)

  // Mar.
  const mar = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: 0x1e6fb0, roughness: 0.45, metalness: 0.1 }),
  )
  mar.rotation.x = -Math.PI / 2
  grupo.add(mar)

  // Espuma na borda da ilha.
  const espuma = new THREE.Mesh(
    new THREE.RingGeometry(5.2, 6.1, 48),
    new THREE.MeshBasicMaterial({ color: 0xdff2ff, transparent: true, opacity: 0.45 }),
  )
  espuma.rotation.x = -Math.PI / 2
  espuma.position.y = 0.015
  grupo.add(espuma)

  // Ilha de areia.
  const ilha = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 5.4, CHAO_Y, 40),
    new THREE.MeshStandardMaterial({ color: 0xe9d29b, roughness: 1 }),
  )
  ilha.position.y = CHAO_Y / 2
  grupo.add(ilha)

  // Disco do sol no horizonte + nuvens (MeshBasic: não reagem à luz, ficam chapadas de longe).
  const discoSol = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  )
  discoSol.position.set(-11, 9, -32)
  grupo.add(discoSol)

  const materialNuvem = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const geometriaNuvem = new THREE.SphereGeometry(1, 10, 8)
  const posicoesNuvens: [number, number, number, number][] = [
    [9, 8.5, -28, 1.6],
    [11.4, 8.2, -28, 1.1],
    [-4, 10.5, -30, 1.3],
    [-2.2, 10.2, -30, 0.9],
  ]
  for (const [x, y, z, escala] of posicoesNuvens) {
    const nuvem = new THREE.Mesh(geometriaNuvem, materialNuvem)
    nuvem.position.set(x, y, z)
    nuvem.scale.set(escala * 1.8, escala * 0.7, escala)
    grupo.add(nuvem)
  }

  // O único coqueiro da ilha.
  const { coqueiro, folhas } = montarCoqueiro()
  coqueiro.position.set(-2.7, CHAO_Y, -1)
  grupo.add(coqueiro)

  return {
    grupo,
    animar(tempo: number) {
      // Balanço suave das folhas com a brisa.
      folhas.rotation.z = Math.sin(tempo * 0.9) * 0.05
      folhas.rotation.x = Math.cos(tempo * 0.7) * 0.03
    },
  }
}

function montarCoqueiro(): { coqueiro: THREE.Group; folhas: THREE.Group } {
  const coqueiro = new THREE.Group()

  // Tronco curvado: tubo ao longo de uma curva, do chão até o topo.
  const curvaTronco = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.12, 0.9, 0),
    new THREE.Vector3(0.32, 1.8, 0),
    new THREE.Vector3(0.58, 2.5, 0),
  ])
  const tronco = new THREE.Mesh(
    new THREE.TubeGeometry(curvaTronco, 12, 0.11, 8),
    new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.95 }),
  )
  coqueiro.add(tronco)

  const topo = new THREE.Vector3(0.58, 2.5, 0)

  // Copa: folhas em leque caindo pra fora, a partir do topo do tronco.
  const folhas = new THREE.Group()
  folhas.position.copy(topo)
  const materialFolha = new THREE.MeshStandardMaterial({ color: 0x2f9e50, roughness: 0.85 })
  const geometriaFolha = new THREE.ConeGeometry(0.12, 1, 6)
  const eixoY = new THREE.Vector3(0, 1, 0)
  const totalFolhas = 7
  for (let i = 0; i < totalFolhas; i++) {
    const angulo = (i / totalFolhas) * Math.PI * 2
    const direcao = new THREE.Vector3(Math.cos(angulo), -0.5, Math.sin(angulo)).normalize()
    const folha = new THREE.Mesh(geometriaFolha, materialFolha)
    folha.quaternion.setFromUnitVectors(eixoY, direcao)
    folha.position.copy(direcao).multiplyScalar(0.72)
    folha.scale.set(0.9, 1.55, 0.28)
    folhas.add(folha)
  }
  coqueiro.add(folhas)

  // Cocos pendurados no topo.
  const materialCoco = new THREE.MeshStandardMaterial({ color: 0x5f4126, roughness: 0.9 })
  const geometriaCoco = new THREE.SphereGeometry(0.09, 10, 8)
  const deslocamentosCocos: [number, number, number][] = [
    [0.1, -0.12, 0.06],
    [-0.08, -0.14, -0.05],
    [0.02, -0.18, 0.1],
  ]
  for (const [dx, dy, dz] of deslocamentosCocos) {
    const coco = new THREE.Mesh(geometriaCoco, materialCoco)
    coco.position.set(topo.x + dx, topo.y + dy, topo.z + dz)
    coqueiro.add(coco)
  }

  return { coqueiro, folhas }
}
