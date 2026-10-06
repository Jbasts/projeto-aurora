import { useState } from 'react'

import { Botao } from '../../components/Botao'
import { ZOOM_INICIAL } from '../../components/mapa/constantes'
import { Mapa } from '../../components/mapa/MapaSobDemanda'
import type { Coordenadas } from './tipos'

interface SeletorLocalProps {
  valor: Coordenadas | null
  aoMudar: (coordenadas: Coordenadas | null) => void
}

const formatoCoordenada = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
})

/** Clique no mapa ou "Usar minha localização" (GPS do aparelho). */
export function SeletorLocal({ valor, aoMudar }: SeletorLocalProps) {
  const [erroGps, setErroGps] = useState<string | null>(null)
  const [buscandoGps, setBuscandoGps] = useState(false)

  const usarMinhaLocalizacao = () => {
    setErroGps(null)
    if (!('geolocation' in navigator)) {
      setErroGps('Este aparelho não informa a localização. Clique no mapa para marcar o local.')
      return
    }
    setBuscandoGps(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setBuscandoGps(false)
        aoMudar({ latitude: coords.latitude, longitude: coords.longitude })
      },
      () => {
        setBuscandoGps(false)
        setErroGps(
          'Não foi possível obter sua localização. Verifique a permissão ou clique no mapa.',
        )
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-texto-suave">
        Clique no mapa no ponto onde a pessoa foi vista, ou use a localização do aparelho.
      </p>
      <Mapa
        rotulo="Mapa para marcar onde a pessoa foi vista"
        className="h-72 md:h-96"
        marcador={valor}
        centro={valor ? [valor.latitude, valor.longitude] : undefined}
        zoom={valor ? 16 : ZOOM_INICIAL}
        aoClicar={(coordenadas) => {
          setErroGps(null)
          aoMudar(coordenadas)
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Botao variante="secundario" carregando={buscandoGps} onClick={usarMinhaLocalizacao}>
          Usar minha localização
        </Botao>
        {valor && (
          <Botao variante="secundario" onClick={() => aoMudar(null)}>
            Limpar local
          </Botao>
        )}
      </div>
      <p aria-live="polite" className="text-sm text-texto">
        {valor
          ? `Local marcado: ${formatoCoordenada.format(valor.latitude)}, ${formatoCoordenada.format(valor.longitude)}`
          : 'Nenhum local marcado.'}
      </p>
      {erroGps && (
        <p role="alert" className="text-sm font-medium text-erro">
          {erroGps}
        </p>
      )}
    </div>
  )
}
