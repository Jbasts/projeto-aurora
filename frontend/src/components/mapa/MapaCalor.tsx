import type { ComponentProps } from 'react'

import { CamadaCalor, type PontoCalor } from './CamadaCalor'
import { Mapa } from './Mapa'

type MapaCalorProps = Omit<ComponentProps<typeof Mapa>, 'children' | 'marcador' | 'aoClicar'> & {
  pontos: PontoCalor[]
}

/** Mapa com a camada de calor dos avistamentos (seção 3.10). */
export function MapaCalor({ pontos, ...props }: MapaCalorProps) {
  return (
    <Mapa {...props}>
      <CamadaCalor pontos={pontos} />
    </Mapa>
  )
}
