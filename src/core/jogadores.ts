export const CORES_JOGADORES = ['#66c0f4', '#f5a623', '#e24b4a', '#a1d42a']

export function corDoJogador(indice: number): string {
  return CORES_JOGADORES[indice % CORES_JOGADORES.length]
}

export function nomeDoJogador(indice: number): string {
  return `Jogador ${indice + 1}`
}
