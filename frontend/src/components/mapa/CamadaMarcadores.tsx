import 'leaflet.markercluster/dist/MarkerCluster.css'
// O plugin de agrupamento usa o "L" global, que o Leaflet define ao ser importado.
import L from 'leaflet'
import 'leaflet.markercluster'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

export interface PontoNoMapa {
  id: string
  latitude: number
  longitude: number
  /** Nome para o leitor de tela e a dica ao passar o mouse. */
  rotulo: string
  url_miniatura: string | null
  iniciais: string
}

interface CamadaMarcadoresProps {
  pontos: PontoNoMapa[]
  selecionadoId: string | null
  aoSelecionar: (id: string) => void
}

function escaparHtml(texto: string): string {
  return texto.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

// Alfinete redondo com a miniatura da foto ou as iniciais (seção 3.9). O estilo fica em
// global.css (.marcador-pessoa-foto) e usa os tokens de cor.
function icone(ponto: PontoNoMapa, selecionado: boolean): L.DivIcon {
  const conteudo = ponto.url_miniatura
    ? `<img src="${escaparHtml(ponto.url_miniatura)}" alt="" loading="lazy" />`
    : `<span>${escaparHtml(ponto.iniciais)}</span>`
  return L.divIcon({
    className: `marcador-pessoa-foto${selecionado ? ' selecionado' : ''}`,
    html: `<div class="alfinete">${conteudo}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 48],
  })
}

function iconeGrupo(grupo: L.MarkerCluster): L.DivIcon {
  const quantidade = grupo.getChildCount()
  return L.divIcon({
    className: 'marcador-grupo',
    html: `<span title="${quantidade} pessoas aqui. Aproxime para ver">${quantidade}</span>`,
    iconSize: [44, 44],
  })
}

/** Um marcador por pessoa, agrupando os próximos (cluster). Acessível por teclado (Enter). */
export function CamadaMarcadores({ pontos, selecionadoId, aoSelecionar }: CamadaMarcadoresProps) {
  const mapa = useMap()
  const grupo = useRef<L.MarkerClusterGroup | null>(null)
  const aoSelecionarAtual = useRef(aoSelecionar)

  useEffect(() => {
    aoSelecionarAtual.current = aoSelecionar
  }, [aoSelecionar])

  useEffect(() => {
    const camada = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: iconeGrupo,
    })
    mapa.addLayer(camada)
    grupo.current = camada
    return () => {
      mapa.removeLayer(camada)
      grupo.current = null
    }
  }, [mapa])

  useEffect(() => {
    const camada = grupo.current
    if (!camada) return
    camada.clearLayers()
    camada.addLayers(
      pontos.map((ponto) =>
        L.marker([ponto.latitude, ponto.longitude], {
          icon: icone(ponto, ponto.id === selecionadoId),
          title: ponto.rotulo,
          keyboard: true,
          riseOnHover: true,
          zIndexOffset: ponto.id === selecionadoId ? 1000 : 0,
        }).on('click', () => aoSelecionarAtual.current(ponto.id)),
      ),
    )
  }, [pontos, selecionadoId])

  return null
}
