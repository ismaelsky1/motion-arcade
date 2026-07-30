import type { GameManifest } from '../types'

export default {
  id: 'salta',
  titulo: 'Salta!',
  capa: '/jogos/salta/capa.svg',
  descricao: 'Corra sem parar e pule de verdade pra desviar de buracos e inimigos e pegar moedas.',
  jogadores: { min: 1, max: 2 },
  modos: ['solo', 'versus'],
  telaDividida: { versus: true },
  testeDeAlcance: 'inaplicavel',
  capacidades: ['pose'],
  vidasIniciais: 3,
  carregar: () => import('./game'),
} satisfies GameManifest
