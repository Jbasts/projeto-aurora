// O plugin de calor usa o "L" global, que o Leaflet define ao ser importado.
import L from 'leaflet'
import 'leaflet.heat'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/** [latitude, longitude, peso (número de avistamentos no ponto)], como a API devolve. */
export type PontoCalor = [number, number, number]

/** Gradiente a partir dos tokens --cor-calor-* (o canvas não lê variáveis CSS). */
function gradiente(): Record<number, string> {
  const estilo = getComputedStyle(document.documentElement)
  const cor = (n: number) => estilo.getPropertyValue(`--cor-calor-${n}`).trim()
  return { 0.25: cor(1), 0.5: cor(2), 0.75: cor(3), 1: cor(4) }
}

/**
 * Normaliza os pesos para 0–1 com raiz quadrada: um ponto com muitos avistamentos não apaga
 * os que têm poucos.
 */
function normalizar(pontos: PontoCalor[]): PontoCalor[] {
  const maior = pontos.reduce((acc, [, , peso]) => Math.max(acc, peso), 1)
  return pontos.map(([lat, lng, peso]) => [lat, lng, Math.sqrt(peso / maior)])
}

/** O plugin desenha num canvas 2D; sem ele (navegador antigo, testes), a camada não aparece. */
function temCanvas(): boolean {
  try {
    return document.createElement('canvas').getContext('2d') !== null
  } catch {
    return false
  }
}

/** Mapa de calor (leaflet.heat) sobre os avistamentos (seção 3.10). */
export function CamadaCalor({ pontos }: { pontos: PontoCalor[] }) {
  const mapa = useMap()

  // Recriar a camada é barato e evita sincronizar estado com o plugin.
  useEffect(() => {
    if (!temCanvas()) return
    const camada = L.heatLayer(normalizar(pontos), {
      radius: 25,
      blur: 18,
      maxZoom: 17,
      max: 1,
      minOpacity: 0.35,
      gradient: gradiente(),
    }).addTo(mapa)
    return () => {
      camada.remove()
    }
  }, [mapa, pontos])

  return null
}
