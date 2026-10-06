import { lazy, Suspense, type ComponentProps } from 'react'

// O Leaflet só é baixado quando um mapa aparece na tela (deixa o restante do app mais leve).
const MapaLeaflet = lazy(() => import('./Mapa').then((modulo) => ({ default: modulo.Mapa })))

type MapaProps = ComponentProps<typeof MapaLeaflet>

export function Mapa(props: MapaProps) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className={`flex items-center justify-center rounded-card bg-fundo-topo text-sm text-texto-suave ${props.className ?? ''}`}
        >
          Carregando mapa…
        </div>
      }
    >
      <MapaLeaflet {...props} />
    </Suspense>
  )
}
