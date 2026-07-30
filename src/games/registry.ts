import type { GameManifest } from './types'
import pegaFrutas from './pegaFrutas/manifest'
import desvia from './desvia/manifest'
import salta from './salta/manifest'
import guerreiroIlha from './guerreiroIlha/manifest'

export const registry: GameManifest[] = [pegaFrutas, desvia, salta, guerreiroIlha]
