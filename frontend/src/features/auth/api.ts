import { useMutation, useQuery } from '@tanstack/react-query'

import { ErroApi, requisitar } from '../../api/cliente'
import type { DadosCadastro, DadosRecuperarSenha, DadosRedefinirSenha } from './esquemas'
import type { MensagemResposta } from './tipos'

/** O cadastro vai como formulário multipart: os campos e a foto da conta. */
export function useCadastrar() {
  return useMutation({
    mutationFn: (dados: DadosCadastro) => {
      const formulario = new FormData()
      for (const [campo, valor] of Object.entries(dados)) {
        formulario.append(campo, valor instanceof File ? valor : String(valor ?? ''))
      }
      return requisitar<MensagemResposta>('/auth/cadastro', { metodo: 'POST', corpo: formulario })
    },
  })
}

/** Reenvia o link de confirmação. A resposta é sempre a mesma (não revela se o email existe). */
export function useReenviarVerificacao() {
  return useMutation({
    mutationFn: (email: string) =>
      requisitar<MensagemResposta>('/auth/reenviar-verificacao', {
        metodo: 'POST',
        corpo: { email },
      }),
  })
}

/**
 * Confirma o email ao abrir o link. É um POST, mas fica numa query: assim a confirmação roda
 * uma única vez por token, mesmo com a montagem dupla do StrictMode (o token é de uso único).
 */
export function useVerificarEmail(token: string) {
  return useQuery({
    queryKey: ['auth', 'verificar-email', token],
    queryFn: () =>
      requisitar<MensagemResposta>('/auth/verificar-email', { metodo: 'POST', corpo: { token } }),
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

/** Confirma a troca de email ao abrir o link enviado ao email novo (uma vez por token). */
export function useConfirmarNovoEmail(token: string) {
  return useQuery({
    queryKey: ['auth', 'confirmar-novo-email', token],
    queryFn: () =>
      requisitar<MensagemResposta>('/auth/confirmar-novo-email', {
        metodo: 'POST',
        corpo: { token },
      }),
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
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
