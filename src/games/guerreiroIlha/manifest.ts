import type { GameManifest } from '../types'

export default {
  id: 'guerreiro-ilha',
  titulo: 'Guerreiro Solitário',
  capa: '/jogos/guerreiro-ilha/capa.png',
  descricao:
    'Um guerreiro 3D de cabelo espetado e gi laranja imita cada movimento seu numa ilha tropical — sem pontos, sem vidas, só o espelho do seu corpo.',
  jogadores: { min: 1, max: 1 },
  modos: ['solo'],
  telaDividida: false,
  testeDeAlcance: 'inaplicavel',
  capacidades: ['pose'],
  // Experiência sem objetivo: nunca chama pontuar/perderVida, então a sessão só termina
  // pelo botão "Sair". vidasIniciais: 0 evita corações fantasma e semHud esconde o placar.
  vidasIniciais: 0,
  semHud: true,
  carregar: () => import('./game'),
} satisfies GameManifest
