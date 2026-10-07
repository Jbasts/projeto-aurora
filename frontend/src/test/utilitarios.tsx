import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'

import { AutenticacaoProvider } from '../contexts/AutenticacaoProvider'
import { PreferenciasProvider } from '../contexts/PreferenciasProvider'
import type { SessaoResposta, Usuario } from '../features/auth/tipos'
import type { Perfil } from '../features/usuarios/perfis'
import { rotas } from '../routes/rotas'

export interface RespostaFalsa {
  status?: number
  corpo?: unknown
}

type Manipulador = RespostaFalsa | ((corpo: unknown, url: URL) => RespostaFalsa)

export interface ChamadaApi {
  chave: string
  corpo: unknown
  cabecalhos: Record<string, string>
  url: URL
}

/**
 * Substitui o fetch por respostas falsas. Chaves no formato "POST /auth/login"
 * (sem o prefixo /api/v1). Rotas não mapeadas respondem 404.
 */
export function mockarApi(rotasApi: Record<string, Manipulador>) {
  const chamadas: ChamadaApi[] = []

  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: string, init: RequestInit = {}) => {
      const url = new URL(entrada, 'http://localhost')
      const chave = `${init.method ?? 'GET'} ${url.pathname.replace('/api/v1', '')}`
      const corpo = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
      chamadas.push({
        chave,
        corpo,
        cabecalhos: (init.headers ?? {}) as Record<string, string>,
        url,
      })

      const manipulador = rotasApi[chave]
      const { status = 200, corpo: resposta = {} } = !manipulador
        ? { status: 404, corpo: { detail: `Sem mock para ${chave}`, codigo: 'NAO_ENCONTRADO' } }
        : typeof manipulador === 'function'
          ? manipulador(corpo, url)
          : manipulador

      return new Response(status === 204 ? null : JSON.stringify(resposta), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )

  return { chamadas }
}

export function usuarioTeste(perfil: Perfil = 'COLABORADOR'): Usuario {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    nome: 'Ana Teste',
    email: 'ana@exemplo.com',
    telefone: null,
    perfil,
    status: 'ATIVO',
  }
}

export function sessaoTeste(perfil: Perfil = 'COLABORADOR'): SessaoResposta {
  return { access_token: 'token-teste', token_type: 'bearer', usuario: usuarioTeste(perfil) }
}

export const SEM_SESSAO: RespostaFalsa = {
  status: 401,
  corpo: { detail: 'Sua sessão expirou. Entre novamente.', codigo: 'TOKEN_INVALIDO' },
}

/** Renderiza o app inteiro (providers + rotas reais) a partir de uma rota. */
export function renderizarApp(rotaInicial: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(rotas, { initialEntries: [rotaInicial] })
  render(
    <QueryClientProvider client={queryClient}>
      <PreferenciasProvider>
        <AutenticacaoProvider>
          <RouterProvider router={router} />
        </AutenticacaoProvider>
      </PreferenciasProvider>
    </QueryClientProvider>,
  )
  return { router }
}
