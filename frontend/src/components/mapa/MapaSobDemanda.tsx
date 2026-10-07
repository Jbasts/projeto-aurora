import { lazy, Suspense, type ComponentProps, type ReactNode } from 'react'

// O Leaflet só é baixado quando um mapa aparece na tela (deixa o restante do app mais leve).
const MapaLeaflet = lazy(() => import('./Mapa').then((modulo) => ({ default: modulo.Mapa })))
const MapaCalorLeaflet = lazy(() =>
  import('./MapaCalor').then((modulo) => ({ default: modulo.MapaCalor })),
)

function Carregando({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className={`flex items-center justify-center rounded-card bg-fundo-topo text-sm text-texto-suave ${className ?? ''}`}
        >
          Carregando mapa…
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export function Mapa(props: ComponentProps<typeof MapaLeaflet>) {
  return (
    <Carregando className={props.className}>
      <MapaLeaflet {...props} />
    </Carregando>
  )
}

export function MapaCalor(props: ComponentProps<typeof MapaCalorLeaflet>) {
  return (
    <Carregando className={props.className}>
      <MapaCalorLeaflet {...props} />
    </Carregando>
  )
}
