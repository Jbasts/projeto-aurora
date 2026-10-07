import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { requisitar } from '../../api/cliente'
import type { PontoCalor } from '../../components/mapa/CamadaCalor'
import type { Coordenadas } from '../pessoas/tipos'
import type { Perfil } from '../usuarios/perfis'

/** Quem registrou um avistamento, com o perfil de acesso. */
export interface RegistradorRef {
  id: string
  nome: string
  perfil: Perfil
}

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
  /** Quem registrou o avistamento mais recente. */
  registrado_por: RegistradorRef | null
}

export interface NovoAvistamento extends Coordenadas {
  pessoa_id: string
  visto_em: string
  observacao: string | null
}

export interface Avistamento extends NovoAvistamento {
  id: string
  endereco: string | null
  registrado_por: RegistradorRef | null
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
      void queryClient.invalidateQueries({ queryKey: ['pessoas', 'avistamentos', pessoa_id] })
    },
  })
}

/** Linha do histórico de avistamentos no perfil da pessoa. */
export interface AvistamentoHistorico extends Coordenadas {
  id: string
  endereco: string | null
  visto_em: string
  observacao: string | null
  registrado_por: RegistradorRef | null
  criado_em: string
}

export interface PaginaAvistamentos {
  itens: AvistamentoHistorico[]
  total: number
  pagina: number
  tamanho: number
}

export function useHistoricoAvistamentos(pessoaId: string, pagina: number, tamanho: number) {
  return useQuery({
    queryKey: ['pessoas', 'avistamentos', pessoaId, pagina, tamanho],
    queryFn: () =>
      requisitar<PaginaAvistamentos>(
        `/pessoas/${pessoaId}/avistamentos?pagina=${pagina}&tamanho=${tamanho}`,
      ),
    placeholderData: (anterior) => anterior,
  })
}

/** Filtros do mapa de calor (seção 3.10). Datas em ISO; sem elas, todo o período. */
export interface FiltrosCalor {
  pessoaId?: string | null
  de?: string | null
  ate?: string | null
}

/** `ativo` = false não consulta (ex.: intervalo inválido). */
export function useCalor({ pessoaId, de, ate }: FiltrosCalor, ativo = true) {
  const parametros = new URLSearchParams()
  if (pessoaId) parametros.set('pessoa_id', pessoaId)
  if (de) parametros.set('de', de)
  if (ate) parametros.set('ate', ate)
  const consulta = parametros.toString()
  return useQuery({
    queryKey: ['mapa', 'calor', pessoaId ?? null, de ?? null, ate ?? null],
    queryFn: () => requisitar<PontoCalor[]>(`/mapa/calor${consulta ? `?${consulta}` : ''}`),
    enabled: ativo,
    placeholderData: (anterior) => anterior,
  })
}
