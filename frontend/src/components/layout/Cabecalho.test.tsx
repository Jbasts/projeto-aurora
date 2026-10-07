import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { Perfil } from '../../features/usuarios/perfis'
import { Cabecalho } from './Cabecalho'

function renderizar(perfil: Perfil, rota = '/') {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: <Cabecalho usuario={{ nome: 'Ana Teste', perfil }} aoSair={() => {}} />,
      },
    ],
    { initialEntries: [rota] },
  )
  render(<RouterProvider router={router} />)
  return within(screen.getByRole('navigation', { name: 'Navegação principal' }))
}

const rotulos = (nav: ReturnType<typeof renderizar>) =>
  nav.getAllByRole('link').map((link) => link.textContent)

describe('Cabecalho', () => {
  it('mostra todos os itens para pessoa administradora', () => {
    expect(rotulos(renderizar('ADMIN'))).toEqual([
      'Início',
      'Pessoas',
      'Cadastrar',
      'Mapa',
      'Mapa de calor',
      'Usuários',
      'Auditoria',
    ])
  })

  it('esconde Usuários e Auditoria para pessoa colaboradora', () => {
    const itens = rotulos(renderizar('COLABORADOR'))
    expect(itens).not.toContain('Usuários')
    expect(itens).not.toContain('Auditoria')
    expect(itens).toContain('Cadastrar')
  })

  it('esconde Cadastrar e Usuários para pessoa usuária', () => {
    expect(rotulos(renderizar('PADRAO'))).toEqual(['Início', 'Pessoas', 'Mapa', 'Mapa de calor'])
  })

  it('destaca somente o item da rota atual', () => {
    const nav = renderizar('ADMIN', '/pessoas/nova')
    expect(nav.getByRole('link', { name: 'Cadastrar' })).toHaveAttribute('aria-current', 'page')
    expect(nav.getByRole('link', { name: 'Pessoas' })).not.toHaveAttribute('aria-current')
    expect(nav.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current')
  })

  it('mostra nome e perfil de acesso no menu da pessoa, com Meu perfil e Sair', async () => {
    const usuario = userEvent.setup()
    renderizar('COLABORADOR')
    const botao = screen.getByRole('button', { name: /Ana Teste/ })
    expect(botao).toHaveTextContent('Pessoa colaboradora')
    expect(botao).toHaveAttribute('aria-expanded', 'false')

    await usuario.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Meu perfil' })).toHaveAttribute('href', '/meu-perfil')
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()

    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
  })
})
