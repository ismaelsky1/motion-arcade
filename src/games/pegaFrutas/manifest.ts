import type { GameManifest } from '../types'

export default {
  id: 'pega-frutas',
  titulo: 'Pega-Frutas',
  capa: '/jogos/pega-frutas/capa.png',
  descricao: 'Use sua mão como cursor e pegue as frutas antes que caiam.',
  jogadores: { min: 1, max: 4 },
  modos: ['solo', 'coop', 'versus'],
  telaDividida: { versus: true },
  testeDeAlcance: 'opcional',
  capacidades: ['cursor'],
  carregar: () => import('./game'),
} satisfies GameManifest
