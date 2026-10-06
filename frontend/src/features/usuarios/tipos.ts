import type { StatusUsuario } from '../auth/tipos'
import type { Perfil } from './perfis'

/** Linha da tela Gerenciar usuários. */
export interface UsuarioGestao {
  id: string
  nome: string
  email: string
  telefone: string | null
  perfil: Perfil
  status: StatusUsuario
  criado_em: string
}

export interface PaginaUsuarios {
  itens: UsuarioGestao[]
  total: number
  pagina: number
  tamanho: number
}

export interface FiltrosUsuarios {
  busca: string
  perfil: Perfil | ''
  status: StatusUsuario | ''
  pagina: number
  tamanho: number
}

export interface AlteracaoUsuario {
  perfil?: Perfil
  status?: Exclude<StatusUsuario, 'PENDENTE'>
}
