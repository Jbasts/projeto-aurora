import type { SolicitacaoPropria } from '../solicitacoes/tipos'
import type { Perfil } from '../usuarios/perfis'

export type StatusUsuario = 'PENDENTE' | 'ATIVO' | 'INATIVO'

export interface Usuario {
  id: string
  nome: string
  sobrenome: string | null
  email: string
  /** URLs assinadas da foto da conta; nulas em contas antigas que ainda não enviaram. */
  foto_url: string | null
  foto_miniatura_url: string | null
  telefone: string | null
  /** "AAAA-MM-DD"; nula em contas antigas. A idade vem calculada pela API. */
  data_nascimento: string | null
  idade: number | null
  /** ***.456.789-** — o CPF completo só aparece para ADMIN, em Gerenciar usuários. */
  cpf_mascarado: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  perfil: Perfil
  status: StatusUsuario
  /** Última solicitação de cada tipo; o email e o CPF acima valem até a aprovação. */
  solicitacao_email: SolicitacaoPropria | null
  solicitacao_cpf: SolicitacaoPropria | null
}

export interface SessaoResposta {
  access_token: string
  token_type: 'bearer'
  usuario: Usuario
}

export interface MensagemResposta {
  mensagem: string
}
