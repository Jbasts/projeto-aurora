import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { requisitar } from '../../api/cliente'
import type { FiltrosSolicitacoes, PaginaSolicitacoes, Solicitacao } from './tipos'

function parametros(valores: Record<string, string | number>): string {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(valores)) {
    if (valor !== '') busca.set(chave, String(valor))
  }
  return busca.toString()
}

export function useSolicitacoes(filtros: FiltrosSolicitacoes) {
  return useQuery({
    queryKey: ['solicitacoes', 'lista', filtros],
    queryFn: () => requisitar<PaginaSolicitacoes>(`/solicitacoes?${parametros({ ...filtros })}`),
    placeholderData: keepPreviousData,
  })
}

/** Quantidade de solicitações esperando a pessoa administradora (menu da conta). */
export function useContagemSolicitacoes(habilitado: boolean) {
  return useQuery({
    queryKey: ['solicitacoes', 'pendentes'],
    queryFn: async () => {
      const pagina = await requisitar<PaginaSolicitacoes>(
        `/solicitacoes?${parametros({ status: 'PENDENTE', tamanho: 1 })}`,
      )
      return pagina.total
    },
    enabled: habilitado,
  })
}

/** Aprovada, o email ou o CPF da conta muda na hora. */
export function useDecidirSolicitacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decisao }: { id: string; decisao: 'aprovar' | 'recusar' }) =>
      requisitar<Solicitacao>(`/solicitacoes/${id}/${decisao}`, { metodo: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['solicitacoes'] })
      void queryClient.invalidateQueries({ queryKey: ['usuarios', 'lista'] })
    },
  })
}
