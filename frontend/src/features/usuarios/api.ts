import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { requisitar } from '../../api/cliente'
import type { MensagemResposta, Usuario } from '../auth/tipos'
import type { DadosMeusDados, DadosTrocarSenha } from './esquemas'
import type { AlteracaoUsuario, FiltrosUsuarios, PaginaUsuarios, UsuarioGestao } from './tipos'

function parametros(valores: Record<string, string | number>): string {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(valores)) {
    if (valor !== '') busca.set(chave, String(valor))
  }
  return busca.toString()
}

export function useUsuarios(filtros: FiltrosUsuarios) {
  return useQuery({
    queryKey: ['usuarios', 'lista', filtros],
    queryFn: () =>
      requisitar<PaginaUsuarios>(
        `/usuarios?${parametros({ ...filtros, busca: filtros.busca.trim() })}`,
      ),
    placeholderData: keepPreviousData,
  })
}

/** Quantidade de cadastros pendentes (menu e Home da pessoa administradora). */
export function useContagemPendentes(habilitado: boolean) {
  return useQuery({
    queryKey: ['usuarios', 'pendentes'],
    queryFn: async () => {
      const pagina = await requisitar<PaginaUsuarios>(
        `/usuarios?${parametros({ status: 'PENDENTE', tamanho: 1 })}`,
      )
      return pagina.total
    },
    enabled: habilitado,
  })
}

export function useAlterarUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...dados }: AlteracaoUsuario & { id: string }) =>
      requisitar<UsuarioGestao>(`/usuarios/${id}`, { metodo: 'PATCH', corpo: dados }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

export function useAtualizarMeusDados() {
  return useMutation({
    mutationFn: (dados: DadosMeusDados) =>
      requisitar<Usuario>('/me', {
        metodo: 'PATCH',
        corpo: { ...dados, telefone: dados.telefone || null },
      }),
  })
}

export function useTrocarSenha() {
  return useMutation({
    mutationFn: (dados: DadosTrocarSenha) =>
      requisitar<MensagemResposta>('/me/senha', { metodo: 'PATCH', corpo: dados }),
  })
}
