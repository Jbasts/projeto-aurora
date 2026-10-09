export type TipoSolicitacao = 'EMAIL' | 'CPF'

export type StatusSolicitacao =
  'AGUARDANDO_EMAIL' | 'PENDENTE' | 'APROVADA' | 'RECUSADA' | 'CANCELADA'

export const ROTULOS_TIPO_SOLICITACAO: Record<TipoSolicitacao, string> = {
  EMAIL: 'Email',
  CPF: 'CPF',
}

export const ROTULOS_STATUS_SOLICITACAO: Record<StatusSolicitacao, string> = {
  AGUARDANDO_EMAIL: 'Aguardando confirmação do email',
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
  CANCELADA: 'Cancelada',
}

/** Última solicitação de um tipo, vista pela própria pessoa (CPF mascarado). */
export interface SolicitacaoPropria {
  tipo: TipoSolicitacao
  status: StatusSolicitacao
  valor_novo_exibicao: string
  criado_em: string
  email_confirmado_em: string | null
  decidido_em: string | null
}

/** Solicitação em aberto de uma conta (tela Dados do usuário). */
export interface SolicitacaoResumo {
  id: string
  tipo: TipoSolicitacao
  status: StatusSolicitacao
  valor_novo: string
  criado_em: string
}

/** Linha da tela Solicitações (somente ADMIN). */
export interface Solicitacao {
  id: string
  tipo: TipoSolicitacao
  status: StatusSolicitacao
  usuario: { id: string; nome_completo: string; foto_miniatura_url: string | null }
  valor_atual: string | null
  valor_novo: string
  criado_em: string
  email_confirmado_em: string | null
  decidido_em: string | null
  decidido_por: string | null
}

export interface PaginaSolicitacoes {
  itens: Solicitacao[]
  total: number
  pagina: number
  tamanho: number
}

export interface FiltrosSolicitacoes {
  status: StatusSolicitacao | ''
  tipo: TipoSolicitacao | ''
  pagina: number
  tamanho: number
}
