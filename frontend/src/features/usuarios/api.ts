import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { requisitar } from '../../api/cliente'
import type { MensagemResposta, Usuario } from '../auth/tipos'
import type {
  DadosCompletarDados,
  DadosMeusDados,
  DadosPedidoAlteracao,
  DadosTrocarSenha,
} from './esquemas'
import type {
  AlteracaoUsuario,
  FiltrosUsuarios,
  PaginaUsuarios,
  UsuarioDetalhe,
  UsuarioGestao,
} from './tipos'

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

/** Todos os dados de uma conta (somente ADMIN). Cada consulta gera auditoria no backend. */
export function useUsuario(id: string) {
  return useQuery({
    queryKey: ['usuarios', 'detalhe', id],
    queryFn: () => requisitar<UsuarioDetalhe>(`/usuarios/${id}`),
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

/** Depois de uma ação na tela Dados do usuário: atualiza a tela sem consultar de novo
 * (cada consulta gera auditoria) e recarrega a lista e o contador de pendentes. */
function useGuardarDetalhe() {
  const queryClient = useQueryClient()
  return (usuario: UsuarioDetalhe) => {
    queryClient.setQueryData(['usuarios', 'detalhe', usuario.id], usuario)
    void queryClient.invalidateQueries({ queryKey: ['usuarios', 'lista'] })
    void queryClient.invalidateQueries({ queryKey: ['usuarios', 'pendentes'] })
  }
}

/** ADMIN preenche sobrenome e CPF de contas antigas (só os que estão vazios). */
export function useCompletarDados(id: string) {
  const guardar = useGuardarDetalhe()
  return useMutation({
    mutationFn: (dados: DadosCompletarDados) =>
      requisitar<UsuarioDetalhe>(`/usuarios/${id}/dados`, { metodo: 'PATCH', corpo: dados }),
    onSuccess: guardar,
  })
}

export function useAtualizarMeusDados() {
  return useMutation({
    mutationFn: (dados: DadosMeusDados) =>
      requisitar<Usuario>('/me', { metodo: 'PATCH', corpo: dados }),
  })
}

export function useTrocarSenha() {
  return useMutation({
    mutationFn: (dados: DadosTrocarSenha) =>
      requisitar<MensagemResposta>('/me/senha', { metodo: 'PATCH', corpo: dados }),
  })
}

/** Envia a primeira foto da conta ou troca a atual. */
export function useTrocarFoto() {
  return useMutation({
    mutationFn: (arquivo: File) => {
      const formulario = new FormData()
      formulario.append('arquivo', arquivo)
      return requisitar<Usuario>('/me/foto', { metodo: 'PUT', corpo: formulario })
    },
  })
}

/** Solicita a troca do email (link no email novo, depois ADMIN) e/ou do CPF (ADMIN). */
export function usePedirAlteracao() {
  return useMutation({
    mutationFn: (dados: DadosPedidoAlteracao) =>
      requisitar<Usuario>('/me/pedido-alteracao', { metodo: 'POST', corpo: dados }),
  })
}

export function useCancelarTroca() {
  return useMutation({
    mutationFn: (troca: 'email' | 'cpf') =>
      requisitar<Usuario>(`/me/troca-${troca}`, { metodo: 'DELETE' }),
  })
}
