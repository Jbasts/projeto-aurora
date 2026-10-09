import type { StatusUsuario } from '../auth/tipos'
import type { SolicitacaoResumo } from '../solicitacoes/tipos'
import type { Perfil } from './perfis'

/** Linha da tela Gerenciar usuários. */
export interface UsuarioGestao {
  id: string
  nome: string
  sobrenome: string | null
  /** Completo (000.000.000-00): esta tela é só para ADMIN. */
  cpf: string | null
  email: string
  telefone: string | null
  perfil: Perfil
  status: StatusUsuario
  criado_em: string
  foto_url: string | null
  foto_miniatura_url: string | null
}

/** Tela Dados do usuário (somente ADMIN). */
export interface UsuarioDetalhe extends UsuarioGestao {
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  email_verificado_em: string | null
  atualizado_em: string
  solicitacoes_abertas: SolicitacaoResumo[]
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
