import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { PreferenciasProvider } from '../contexts/PreferenciasProvider'
import { rotas } from './rotas'

function abrir(rota: string) {
  const router = createMemoryRouter(rotas, { initialEntries: [rota] })
  render(
    <PreferenciasProvider>
      <RouterProvider router={router} />
    </PreferenciasProvider>,
  )
}

describe('rotas', () => {
  it('mostra a página 404 em rota desconhecida', () => {
    abrir('/rota-que-nao-existe')
    expect(screen.getByText('Erro 404')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
  })

  it('mostra a página 403', () => {
    abrir('/acesso-negado')
    expect(screen.getByRole('heading', { level: 1, name: 'Acesso negado' })).toBeInTheDocument()
    expect(screen.getByText('Você não tem permissão para acessar esta página.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
  })

  it('usa o layout logado na Home, com rodapé e link de privacidade', () => {
    abrir('/')
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo')
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute(
      'href',
      '#conteudo',
    )
    expect(screen.getByText(/R\. Afrânio de Melo Franco, 333/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacidade' })).toHaveAttribute(
      'href',
      '/privacidade',
    )
  })

  it('usa o layout de autenticação no login, sem a navegação principal', () => {
    abrir('/login')
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Navegação principal' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Acessibilidade' })).toBeInTheDocument()
  })
})
