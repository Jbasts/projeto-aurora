import { createContext, useContext } from 'react'

import type { Usuario } from '../features/auth/tipos'

export type EstadoAutenticacao =
  | { situacao: 'carregando'; usuario: null }
  | { situacao: 'anonima'; usuario: null }
  | { situacao: 'autenticada'; usuario: Usuario }

export interface Autenticacao {
  estado: EstadoAutenticacao
  /** Lança ErroApi em caso de falha (credenciais, bloqueio, conta pendente etc.). */
  entrar: (email: string, senha: string) => Promise<Usuario>
  sair: () => Promise<void>
  /** Atualiza os dados da pessoa logada (ex.: depois de editar Meu perfil). */
  atualizarUsuario: (usuario: Usuario) => void
}

export const AutenticacaoContext = createContext<Autenticacao | null>(null)

export function useAutenticacao(): Autenticacao {
  const contexto = useContext(AutenticacaoContext)
  if (!contexto) throw new Error('useAutenticacao precisa estar dentro de <AutenticacaoProvider>.')
  return contexto
}

/** Pessoa logada. Use só dentro de rotas protegidas. */
export function useUsuarioLogado(): Usuario {
  const { estado } = useAutenticacao()
  if (estado.situacao !== 'autenticada') {
    throw new Error('useUsuarioLogado só pode ser usado em rotas protegidas.')
  }
  return estado.usuario
}
