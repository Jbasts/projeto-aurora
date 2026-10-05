import type { SessaoResposta } from '../features/auth/tipos'

const BASE_API = '/api/v1'

export interface CampoComErro {
  campo: string
  mensagem: string
}

/** Erro devolvido pela API no formato {"detail", "codigo", ...extras} (seção 8). */
export class ErroApi extends Error {
  readonly status: number
  readonly codigo: string
  readonly campos: CampoComErro[]
  readonly extras: Record<string, unknown>

  constructor(status: number, corpo: Record<string, unknown>) {
    super(typeof corpo.detail === 'string' ? corpo.detail : 'Algo deu errado.')
    this.name = 'ErroApi'
    this.status = status
    this.codigo = typeof corpo.codigo === 'string' ? corpo.codigo : 'ERRO'
    this.campos = Array.isArray(corpo.campos) ? (corpo.campos as CampoComErro[]) : []
    this.extras = corpo
  }
}

export const MENSAGEM_SEM_CONEXAO =
  'Não foi possível conectar. Verifique sua internet e tente novamente.'

// O access token fica só em memória (seção 3.2). Ao recarregar a página, a sessão é
// recuperada pelo cookie httpOnly de refresh.
let accessToken: string | null = null
let renovacaoEmAndamento: Promise<SessaoResposta | null> | null = null
let aoExpirarSessao: (() => void) | null = null

export function definirAccessToken(token: string | null): void {
  accessToken = token
}

/** O provider de autenticação é avisado quando a sessão expira de vez. */
export function definirAoExpirarSessao(callback: (() => void) | null): void {
  aoExpirarSessao = callback
}

interface OpcoesRequisicao {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  corpo?: unknown
  /** Tenta renovar o access token uma vez se a API responder 401. */
  renovarSeExpirado?: boolean
}

async function executar(caminho: string, metodo: string, corpo: unknown): Promise<Response> {
  const cabecalhos: Record<string, string> = { Accept: 'application/json' }
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json'
  if (accessToken) cabecalhos.Authorization = `Bearer ${accessToken}`

  try {
    return await fetch(`${BASE_API}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      credentials: 'same-origin',
    })
  } catch {
    throw new ErroApi(0, { detail: MENSAGEM_SEM_CONEXAO, codigo: 'SEM_CONEXAO' })
  }
}

async function lerCorpo(resposta: Response): Promise<Record<string, unknown>> {
  if (resposta.status === 204) return {}
  try {
    return (await resposta.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const { metodo = 'GET', corpo, renovarSeExpirado = true } = opcoes

  let resposta = await executar(caminho, metodo, corpo)

  if (resposta.status === 401 && renovarSeExpirado && accessToken) {
    const sessao = await renovarSessao()
    if (sessao) {
      resposta = await executar(caminho, metodo, corpo)
    } else {
      aoExpirarSessao?.()
    }
  }

  const conteudo = await lerCorpo(resposta)
  if (!resposta.ok) throw new ErroApi(resposta.status, conteudo)
  return conteudo as T
}

/**
 * Renova o access token com o cookie de refresh. Devolve a sessão ou null se não houver.
 * Chamadas simultâneas compartilham a mesma requisição.
 */
export function renovarSessao(): Promise<SessaoResposta | null> {
  renovacaoEmAndamento ??= (async () => {
    try {
      const sessao = await requisitar<SessaoResposta>('/auth/refresh', {
        metodo: 'POST',
        renovarSeExpirado: false,
      })
      definirAccessToken(sessao.access_token)
      return sessao
    } catch {
      definirAccessToken(null)
      return null
    } finally {
      renovacaoEmAndamento = null
    }
  })()
  return renovacaoEmAndamento
}
