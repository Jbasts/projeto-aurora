import type { Perfil } from '../usuarios/perfis'

export type StatusUsuario = 'PENDENTE' | 'ATIVO' | 'INATIVO'

export interface Usuario {
  id: string
  nome: string
  email: string
  telefone: string | null
  perfil: Perfil
  status: StatusUsuario
}

export interface SessaoResposta {
  access_token: string
  token_type: 'bearer'
  usuario: Usuario
}

export interface MensagemResposta {
  mensagem: string
}
