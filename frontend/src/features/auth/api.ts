import { useMutation, useQuery } from '@tanstack/react-query'

import { ErroApi, requisitar } from '../../api/cliente'
import type { DadosCadastro, DadosRecuperarSenha, DadosRedefinirSenha } from './esquemas'
import type { MensagemResposta } from './tipos'

export function useCadastrar() {
  return useMutation({
    mutationFn: (dados: DadosCadastro) =>
      requisitar<MensagemResposta>('/auth/cadastro', {
        metodo: 'POST',
        corpo: { ...dados, telefone: dados.telefone || null },
      }),
  })
}

export function useSolicitarRecuperacao() {
  return useMutation({
    mutationFn: (dados: DadosRecuperarSenha) =>
      requisitar<MensagemResposta>('/auth/recuperar-senha', { metodo: 'POST', corpo: dados }),
  })
}

export function useValidarTokenRedefinicao(token: string) {
  return useQuery({
    queryKey: ['auth', 'token-redefinicao', token],
    queryFn: () =>
      requisitar<{ valido: boolean }>(
        `/auth/redefinir-senha/validar?token=${encodeURIComponent(token)}`,
      ),
    enabled: token.length > 0,
    retry: (falhas, erro) => !(erro instanceof ErroApi && erro.status < 500) && falhas < 2,
    staleTime: Infinity,
  })
}

export function useRedefinirSenha() {
  return useMutation({
    mutationFn: (dados: DadosRedefinirSenha & { token: string }) =>
      requisitar<MensagemResposta>('/auth/redefinir-senha', { metodo: 'POST', corpo: dados }),
  })
}
