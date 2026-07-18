// Utilitário de "segurar por N segundos" usado pelas telas de pré-jogo operadas por gesto
// (Lobby, Teste de Alcance). É imperativo, não um hook React com setState por frame: cada
// tela chama .atualizar(dentroDoAlvo, dt) dentro do próprio loop requestAnimationFrame
// (mesmo padrão já usado em TesteCamera.tsx e no GameHost) e só leva o resultado para o
// React em transições relevantes (progresso da UI, conclusão do hold).
export interface HoverPress {
  atualizar(dentroDoAlvo: boolean, dt: number): { progresso: number; completou: boolean }
  reiniciar(): void
}

export function criarHoverPress(duracaoMs: number): HoverPress {
  let acumuladoMs = 0
  let completo = false

  return {
    atualizar(dentroDoAlvo: boolean, dt: number) {
      if (completo) return { progresso: 1, completou: false }

      if (!dentroDoAlvo) {
        acumuladoMs = 0
        return { progresso: 0, completou: false }
      }

      acumuladoMs = Math.min(duracaoMs, acumuladoMs + dt * 1000)
      const progresso = acumuladoMs / duracaoMs
      if (progresso >= 1) {
        completo = true
        return { progresso: 1, completou: true }
      }
      return { progresso, completou: false }
    },
    reiniciar() {
      acumuladoMs = 0
      completo = false
    },
  }
}
