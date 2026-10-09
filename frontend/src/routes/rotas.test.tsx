import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { mockarApi, renderizarApp, SEM_SESSAO, sessaoTeste } from '../test/utilitarios'

describe('rotas públicas', () => {
  it('mostra a página 404 em rota desconhecida', async () => {
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    renderizarApp('/rota-que-nao-existe')
    expect(await screen.findByText('Erro 404')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
  })

  it('usa o layout de autenticação no login, sem a navegação principal', async () => {
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    renderizarApp('/login')
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Navegação principal' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Acessibilidade' })).toBeInTheDocument()
  })
})

describe('rotas protegidas', () => {
  it('sem login, leva para /login e, depois de entrar, volta para a rota pedida', async () => {
    const usuario = userEvent.setup()
    mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'POST /auth/login': { corpo: sessaoTeste() },
    })
    const { router } = renderizarApp('/acesso-negado')

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')

    await usuario.type(screen.getByLabelText('Email ou CPF'), 'ana@exemplo.com')
    await usuario.type(screen.getByLabelText('Senha'), 'SenhaBoa123')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Acesso negado' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/acesso-negado')
  })

  it('recupera a sessão pelo refresh ao recarregar e mostra o layout logado', async () => {
    mockarApi({ 'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') } })
    renderizarApp('/')

    expect(await screen.findByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo')
    expect(screen.getByRole('button', { name: /Ana Teste/ })).toHaveTextContent(
      'Pessoa administradora',
    )
    expect(screen.getByText(/R\. Afrânio de Melo Franco, 333/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacidade' })).toHaveAttribute(
      'href',
      '/privacidade',
    )
  })

  it('pessoa logada que abre /login vai para o início', async () => {
    mockarApi({ 'POST /auth/refresh': { corpo: sessaoTeste() } })
    const { router } = renderizarApp('/login')
    expect(
      await screen.findByRole('navigation', { name: 'Navegação principal' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('envia o access token nas requisições depois do refresh', async () => {
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste() },
      'POST /auth/logout': { status: 204 },
    })
    const usuario = userEvent.setup()
    renderizarApp('/')

    await usuario.click(await screen.findByRole('button', { name: /Ana Teste/ }))
    await usuario.click(screen.getByRole('button', { name: 'Sair' }))

    const logout = chamadas.find((c) => c.chave === 'POST /auth/logout')
    expect(logout?.cabecalhos.Authorization).toBe('Bearer token-teste')
  })

  it('Sair encerra a sessão e leva para o login', async () => {
    const usuario = userEvent.setup()
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste() },
      'POST /auth/logout': { status: 204 },
    })
    const { router } = renderizarApp('/')

    await usuario.click(await screen.findByRole('button', { name: /Ana Teste/ }))
    await usuario.click(screen.getByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('a pessoa logada vê a página 403', async () => {
    mockarApi({ 'POST /auth/refresh': { corpo: sessaoTeste() } })
    renderizarApp('/acesso-negado')
    expect(
      await screen.findByText('Você não tem permissão para acessar esta página.'),
    ).toBeInTheDocument()
  })
})
