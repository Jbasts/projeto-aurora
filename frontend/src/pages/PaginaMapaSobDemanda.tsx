import { lazy, Suspense } from 'react'

import { TelaCarregando } from '../components/TelaCarregando'

// O mapa (Leaflet + agrupamento) só é baixado quando a pessoa abre a tela.
const PaginaMapa = lazy(() =>
  import('./PaginaMapa').then((modulo) => ({ default: modulo.PaginaMapa })),
)

export function PaginaMapaSobDemanda() {
  return (
    <Suspense fallback={<TelaCarregando />}>
      <PaginaMapa />
    </Suspense>
  )
}
