import type { GameManifest } from '../types'

export default {
  id: 'desvia',
  titulo: 'Desvia!',
  capa: '/jogos/desvia/capa.png',
  descricao: 'Desvie dos obstáculos com o corpo todo antes que eles cheguem em você.',
  jogadores: { min: 1, max: 2 },
  modos: ['solo', 'versus'],
  telaDividida: false,
  testeDeAlcance: 'inaplicavel',
  capacidades: ['pose'],
  resultadoPor: { versus: 'vidas' },
  vidasIniciais: 5,
  carregar: () => import('./game'),
} satisfies GameManifest
