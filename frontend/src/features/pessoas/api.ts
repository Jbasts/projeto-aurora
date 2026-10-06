import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { requisitar } from '../../api/cliente'
import type { AvistamentoInicial, DadosPessoaApi, Foto, Pessoa, SugestaoPessoa } from './tipos'

const chavePessoa = (id: string) => ['pessoas', 'detalhe', id]

export function usePessoa(id: string) {
  return useQuery({
    queryKey: chavePessoa(id),
    queryFn: () => requisitar<Pessoa>(`/pessoas/${id}`),
    // As URLs das fotos valem por 1 h: recarrega antes de vencerem.
    staleTime: 10 * 60 * 1000,
    refetchInterval: 45 * 60 * 1000,
  })
}

/** Nomes parecidos (aviso de duplicidade e autocomplete). A partir de 2 letras. */
export function useSugestoes(termo: string) {
  const limpo = termo.trim()
  return useQuery({
    queryKey: ['pessoas', 'sugestoes', limpo.toLowerCase()],
    queryFn: () =>
      requisitar<SugestaoPessoa[]>(`/pessoas/sugestoes?q=${encodeURIComponent(limpo)}`),
    enabled: limpo.length >= 2,
    staleTime: 30 * 1000,
  })
}

export function useCadastrarPessoa() {
  return useMutation({
    mutationFn: (dados: DadosPessoaApi & { avistamento: AvistamentoInicial | null }) =>
      requisitar<Pessoa>('/pessoas', { metodo: 'POST', corpo: dados }),
  })
}

/** Atualiza o cache do perfil com a resposta da API (evita uma nova visualização auditada). */
function useGuardarPessoa() {
  const queryClient = useQueryClient()
  return (pessoa: Pessoa) => {
    queryClient.setQueryData(chavePessoa(pessoa.id), pessoa)
    void queryClient.invalidateQueries({ queryKey: ['pessoas', 'sugestoes'] })
  }
}

export function useAtualizarPessoa(id: string) {
  const guardar = useGuardarPessoa()
  return useMutation({
    mutationFn: (dados: DadosPessoaApi) =>
      requisitar<Pessoa>(`/pessoas/${id}`, { metodo: 'PUT', corpo: dados }),
    onSuccess: guardar,
  })
}

export function useInativarPessoa(id: string) {
  const guardar = useGuardarPessoa()
  return useMutation({
    mutationFn: (motivo: string) =>
      requisitar<Pessoa>(`/pessoas/${id}/inativar`, {
        metodo: 'POST',
        corpo: { motivo: motivo.trim() || null },
      }),
    onSuccess: guardar,
  })
}

export function useReativarPessoa(id: string) {
  const guardar = useGuardarPessoa()
  return useMutation({
    mutationFn: () => requisitar<Pessoa>(`/pessoas/${id}/reativar`, { metodo: 'POST' }),
    onSuccess: guardar,
  })
}

export interface EnvioFoto {
  pessoaId: string
  tipo: 'PERFIL' | 'ALBUM'
  arquivo: File
  legenda?: string
}

export function enviarFoto({ pessoaId, tipo, arquivo, legenda }: EnvioFoto): Promise<Foto> {
  const formulario = new FormData()
  formulario.append('arquivo', arquivo)
  if (legenda?.trim()) formulario.append('legenda', legenda.trim())
  const rota = tipo === 'PERFIL' ? 'foto-perfil' : 'fotos'
  return requisitar<Foto>(`/pessoas/${pessoaId}/${rota}`, { metodo: 'POST', corpo: formulario })
}

export function useEnviarFoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: enviarFoto,
    onSuccess: (_, { pessoaId }) =>
      queryClient.invalidateQueries({ queryKey: chavePessoa(pessoaId) }),
  })
}

export function useRemoverFoto(pessoaId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fotoId: string) =>
      requisitar<void>(`/pessoas/${pessoaId}/fotos/${fotoId}`, { metodo: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chavePessoa(pessoaId) }),
  })
}
