import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { requisitar } from '../../api/cliente'
import type { Coordenadas, UsuarioRef } from '../pessoas/tipos'

/** PSDR ativa na última localização (seção 3.9). */
export interface Marcador {
  id: string
  nome: string
  sobrenome: string
  apelido: string | null
  idade_aproximada: number | null
  url_miniatura: string | null
  latitude: number
  longitude: number
  ultimo_endereco: string | null
  ultima_vez_visto: string
}

export interface NovoAvistamento extends Coordenadas {
  pessoa_id: string
  visto_em: string
  observacao: string | null
}

export interface Avistamento extends NovoAvistamento {
  id: string
  endereco: string | null
  registrado_por: UsuarioRef | null
  criado_em: string
  mais_recente: boolean
}

export function useMarcadores() {
  return useQuery({
    queryKey: ['mapa', 'marcadores'],
    queryFn: () => requisitar<Marcador[]>('/mapa/marcadores'),
    // As URLs das fotos valem por 1 h.
    refetchInterval: 45 * 60 * 1000,
  })
}

/** Endereço aproximado de um ponto, antes de salvar (null = sem ponto escolhido). */
export function useEnderecoAproximado(coordenadas: Coordenadas | null) {
  // Arredonda como o cache do backend (~11 m): pequenos ajustes não geram nova consulta.
  const lat = coordenadas ? Number(coordenadas.latitude.toFixed(4)) : null
  const lng = coordenadas ? Number(coordenadas.longitude.toFixed(4)) : null
  return useQuery({
    queryKey: ['geocodificacao', lat, lng],
    queryFn: () =>
      requisitar<{ endereco: string | null }>(`/geocodificacao/reversa?lat=${lat}&lng=${lng}`),
    enabled: lat !== null && lng !== null,
    staleTime: Infinity,
    retry: false,
  })
}

export function useRegistrarAvistamento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dados: NovoAvistamento) =>
      requisitar<Avistamento>('/avistamentos', { metodo: 'POST', corpo: dados }),
    onSuccess: (_, { pessoa_id }) => {
      void queryClient.invalidateQueries({ queryKey: ['mapa'] })
      void queryClient.invalidateQueries({ queryKey: ['pessoas', 'lista'] })
      void queryClient.invalidateQueries({ queryKey: ['pessoas', 'detalhe', pessoa_id] })
    },
  })
}
