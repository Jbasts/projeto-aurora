import 'leaflet/dist/leaflet.css'

import { divIcon, type LeafletMouseEvent } from 'leaflet'
import { useEffect, type ReactNode } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

import type { Coordenadas } from '../../features/pessoas/tipos'
import { CENTRO_PETROPOLIS, ZOOM_INICIAL } from './constantes'

// Alfinete com uma pessoa dentro. É HTML do próprio app, então usa os tokens de cor direto
// (acompanha o modo escuro). A ponta do alfinete fica exatamente sobre o local marcado.
const ICONE_PESSOA = divIcon({
  className: 'marcador-pessoa',
  iconSize: [40, 52],
  iconAnchor: [20, 50],
  html: `<svg viewBox="0 0 40 52" width="40" height="52" aria-hidden="true" focusable="false">
    <ellipse cx="20" cy="50" rx="7" ry="2" fill="rgb(0 0 0 / 0.25)" />
    <path d="M20 49C20 49 4 31.5 4 19A16 16 0 0 1 36 19C36 31.5 20 49 20 49Z"
      fill="var(--cor-primaria)" stroke="var(--cor-fundo)" stroke-width="2.5" />
    <circle cx="20" cy="19" r="11.5" fill="var(--cor-fundo)" />
    <circle cx="20" cy="14.6" r="3.6" fill="var(--cor-primaria)" />
    <path d="M13.2 26.2C13.2 21.9 16.2 19.6 20 19.6S26.8 21.9 26.8 26.2A11.5 11.5 0 0 1 13.2 26.2Z"
      fill="var(--cor-primaria)" />
  </svg>`,
})

interface MapaProps {
  centro?: [number, number]
  zoom?: number
  marcador?: Coordenadas | null
  aoClicar?: (coordenadas: Coordenadas) => void
  /** Minimapa: sem arrastar nem zoom pela roda do mouse. */
  estatico?: boolean
  className?: string
  /** Descrição do mapa para leitores de tela. */
  rotulo: string
  children?: ReactNode
}

function CliqueNoMapa({ aoClicar }: { aoClicar: (c: Coordenadas) => void }) {
  useMapEvents({
    click: (evento: LeafletMouseEvent) =>
      aoClicar({ latitude: evento.latlng.lat, longitude: evento.latlng.lng }),
  })
  return null
}

/** O MapContainer só lê o centro ao montar; isto acompanha mudanças (ex.: GPS). */
function AcompanharCentro({ centro, zoom }: { centro: [number, number]; zoom: number }) {
  const mapa = useMap()
  const [latitude, longitude] = centro
  useEffect(() => {
    mapa.setView([latitude, longitude], zoom)
  }, [mapa, latitude, longitude, zoom])
  return null
}

/** Leaflet + OpenStreetMap, com a atribuição sempre visível (seção 3.9). */
export function Mapa({
  centro = CENTRO_PETROPOLIS,
  zoom = ZOOM_INICIAL,
  marcador,
  aoClicar,
  estatico = false,
  className = '',
  rotulo,
  children,
}: MapaProps) {
  return (
    <div
      role="region"
      aria-label={rotulo}
      // isolate: os z-index internos do Leaflet (até 1000) não passam por cima da barra fixa e dos modais.
      className={`isolate overflow-hidden rounded-card ${className}`}
    >
      <MapContainer
        center={centro}
        zoom={zoom}
        className="h-full w-full"
        scrollWheelZoom={!estatico}
        dragging={!estatico}
        doubleClickZoom={!estatico}
        keyboard={!estatico}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {marcador && (
          <Marker
            position={[marcador.latitude, marcador.longitude]}
            icon={ICONE_PESSOA}
            interactive={false}
            keyboard={false}
          />
        )}
        <AcompanharCentro centro={centro} zoom={zoom} />
        {aoClicar && <CliqueNoMapa aoClicar={aoClicar} />}
        {children}
      </MapContainer>
    </div>
  )
}
