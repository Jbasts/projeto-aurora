export type StatusPessoa = 'ATIVA' | 'INATIVA'

export interface UsuarioRef {
  id: string
  nome: string
}

export interface Foto {
  id: string
  tipo: 'PERFIL' | 'ALBUM'
  legenda: string | null
  /** URL assinada (válida por cerca de 1 h), pronta para <img>. */
  url: string
  url_miniatura: string
  enviada_por: UsuarioRef | null
  criado_em: string
}

/** Campos editáveis (seção 3.7), no formato da API. */
export interface DadosPessoaApi {
  nome: string
  sobrenome: string
  apelido: string | null
  idade_aproximada: number | null
  email: string | null
  telefone: string | null
  nome_contato: string | null
  telefone_contato: string | null
  observacoes: string | null
  consentimento: boolean
}

export interface AvistamentoInicial {
  latitude: number
  longitude: number
  visto_em: string
}

export interface Pessoa extends DadosPessoaApi {
  id: string
  consentimento_em: string | null
  status: StatusPessoa
  motivo_inativacao: string | null
  inativada_em: string | null
  inativada_por: UsuarioRef | null
  cadastrada_por: UsuarioRef | null
  foto_perfil: Foto | null
  album: Foto[]
  ultima_vez_visto: string | null
  ultima_latitude: number | null
  ultima_longitude: number | null
  ultimo_endereco: string | null
  criado_em: string
  atualizado_em: string
}

export interface SugestaoPessoa {
  id: string
  nome: string
  sobrenome: string
  apelido: string | null
  status: StatusPessoa
  url_miniatura: string | null
}

export interface Coordenadas {
  latitude: number
  longitude: number
}
