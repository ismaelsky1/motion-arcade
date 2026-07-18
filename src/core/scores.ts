// Recordes por jogo (localStorage). Ver seção 9 do planejamento.

const PREFIXO_CHAVE = 'motion-arcade:recorde:'

function chave(jogoId: string) {
  return `${PREFIXO_CHAVE}${jogoId}`
}

export function obterRecorde(jogoId: string): number {
  const bruto = localStorage.getItem(chave(jogoId))
  const valor = bruto ? Number(bruto) : 0
  return Number.isFinite(valor) ? valor : 0
}

// Retorna true se o valor superou o recorde anterior (e já persiste o novo).
export function registrarPontuacao(jogoId: string, valor: number): boolean {
  const recordeAtual = obterRecorde(jogoId)
  if (valor <= recordeAtual) return false
  localStorage.setItem(chave(jogoId), String(valor))
  return true
}
