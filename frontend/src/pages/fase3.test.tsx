import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { UsuarioGestao } from '../features/usuarios/tipos'
import { mockarApi, renderizarApp, sessaoTeste, usuarioTeste } from '../test/utilitarios'

function usuarioGestao(dados: Partial<UsuarioGestao> = {}): UsuarioGestao {
  return {
    id: '00000000-0000-0000-0000-000000000099',
    nome: 'Bruno Pendente',
    email: 'bruno@exemplo.com',
    telefone: null,
    perfil: 'PADRAO',
    status: 'PENDENTE',
    criado_em: '2026-10-01T15:00:00Z',
    ...dados,
  }
}

function paginaUsuarios(itens: UsuarioGestao[], total = itens.length) {
  return { corpo: { itens, total, pagina: 1, tamanho: 20 } }
}

/** GET /usuarios: a contagem de pendentes (tamanho=1) e a lista usam a mesma rota. */
function rotaUsuarios(itens: UsuarioGestao[], pendentes = 1) {
  return (_: unknown, url: URL) =>
    url.searchParams.get('tamanho') === '1' ? paginaUsuarios([], pendentes) : paginaUsuarios(itens)
}

const atalhos = async () =>
  within(await screen.findByRole('navigation', { name: 'Atalhos' }))
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'))

describe('Home', () => {
  it('pessoa usuária vê só os cards de consulta', async () => {
    mockarApi({ 'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') } })
    renderizarApp('/')
    expect(await atalhos()).toEqual(['/meu-perfil', '/pessoas', '/mapa', '/mapa-de-calor'])
    expect(
      screen.getByRole('heading', { level: 1, name: 'Plataforma Projeto Aurora' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/cadastro e mapeamento de pessoas em situação de rua/)).toBeVisible()
  })

  it('pessoa colaboradora também pode cadastrar pessoas', async () => {
    mockarApi({ 'POST /auth/refresh': { corpo: sessaoTeste('COLABORADOR') } })
    renderizarApp('/')
    expect(await atalhos()).toEqual([
      '/meu-perfil',
      '/pessoas',
      '/mapa',
      '/mapa-de-calor',
      '/pessoas/nova',
    ])
  })

  it('pessoa administradora vê Gerenciar usuários com o contador de pendentes', async () => {
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': rotaUsuarios([], 3),
    })
    renderizarApp('/')
    expect(await atalhos()).toContain('/usuarios')
    expect(
      await screen.findByRole('link', { name: /^Gerenciar usuários, 3 cadastros pendentes$/ }),
    ).toBeInTheDocument()
    const menu = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(within(menu).getByRole('link', { name: /^Usuários, 3 pendentes$/ })).toBeInTheDocument()
  })
})

describe('Gerenciar usuários', () => {
  it.each(['COLABORADOR', 'PADRAO'] as const)(
    'perfil %s vai para Acesso negado sem chamar a API',
    async (perfil) => {
      const { chamadas } = mockarApi({ 'POST /auth/refresh': { corpo: sessaoTeste(perfil) } })
      const { router } = renderizarApp('/usuarios')
      expect(await screen.findByRole('heading', { name: 'Acesso negado' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/acesso-negado')
      expect(chamadas.some((c) => c.chave === 'GET /usuarios')).toBe(false)
    },
  )

  it('aprova um cadastro escolhendo o perfil de acesso', async () => {
    const pessoa = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': rotaUsuarios([usuarioGestao()]),
      'PATCH /usuarios/00000000-0000-0000-0000-000000000099': (corpo) => ({
        corpo: usuarioGestao({ ...(corpo as object) }),
      }),
    })
    renderizarApp('/usuarios')

    const tabela = await screen.findByRole('table')
    expect(within(tabela).getByText('01/10/2026')).toBeInTheDocument()
    await pessoa.click(within(tabela).getByRole('button', { name: 'Aprovar: Bruno Pendente' }))

    const modal = screen.getByRole('dialog', { name: 'Aprovar cadastro de Bruno Pendente' })
    await pessoa.click(within(modal).getByRole('radio', { name: 'Pessoa colaboradora' }))
    await pessoa.click(within(modal).getByRole('button', { name: 'Aprovar' }))

    expect(await screen.findByText('Cadastro de Bruno Pendente aprovado.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(chamadas.find((c) => c.chave.startsWith('PATCH'))?.corpo).toEqual({
      status: 'ATIVO',
      perfil: 'COLABORADOR',
    })
  })

  it('mostra o erro de último admin sem fechar o modal', async () => {
    const pessoa = userEvent.setup()
    const eu = usuarioTeste('ADMIN')
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': rotaUsuarios([
        usuarioGestao({ id: eu.id, nome: eu.nome, perfil: 'ADMIN', status: 'ATIVO' }),
      ]),
      [`PATCH /usuarios/${eu.id}`]: {
        status: 409,
        corpo: {
          detail: 'O sistema precisa de pelo menos uma pessoa administradora ativa.',
          codigo: 'ULTIMO_ADMIN',
        },
      },
    })
    renderizarApp('/usuarios')

    const tabela = await screen.findByRole('table')
    expect(within(tabela).getByText('(você)')).toBeInTheDocument()
    await pessoa.click(within(tabela).getByRole('button', { name: `Inativar: ${eu.nome}` }))
    const modal = screen.getByRole('dialog')
    await pessoa.click(within(modal).getByRole('button', { name: 'Inativar' }))

    expect(await within(modal).findByRole('alert')).toHaveTextContent(
      'pelo menos uma pessoa administradora ativa',
    )
  })

  it('filtro rápido Pendentes busca só os pendentes', async () => {
    const pessoa = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': rotaUsuarios([usuarioGestao()], 1),
    })
    renderizarApp('/usuarios')

    await pessoa.click(await screen.findByRole('button', { name: 'Pendentes (1)' }))
    expect(screen.getByRole('button', { name: 'Pendentes (1)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Status')).toHaveValue('PENDENTE')
    await waitFor(() => expect(chamadas.length).toBeGreaterThan(3))
  })

  it('pagina com 5 itens por padrão e deixa mudar o tamanho', async () => {
    const pessoa = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': rotaUsuarios([usuarioGestao()]),
    })
    renderizarApp('/usuarios')

    const campo = await screen.findByLabelText('Itens por página')
    expect(campo).toHaveValue(5)
    const listas = () =>
      chamadas
        .filter((c) => c.chave === 'GET /usuarios')
        .map((c) => c.url)
        .filter((url) => url.searchParams.get('tamanho') !== '1')
    expect(listas()[0].searchParams.get('tamanho')).toBe('5')

    await pessoa.clear(campo)
    await pessoa.type(campo, '12')
    await waitFor(() => expect(listas().at(-1)?.searchParams.get('tamanho')).toBe('12'))
    expect(listas().at(-1)?.searchParams.get('pagina')).toBe('1')
  })

  it('Esc fecha o modal', async () => {
    const pessoa = userEvent.setup()
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': rotaUsuarios([usuarioGestao()]),
    })
    renderizarApp('/usuarios')
    const tabela = await screen.findByRole('table')
    await pessoa.click(within(tabela).getByRole('button', { name: 'Recusar: Bruno Pendente' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await pessoa.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Meu perfil', () => {
  it('salva nome e telefone e atualiza o nome no menu', async () => {
    const pessoa = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') },
      'PATCH /me': (corpo) => ({ corpo: { ...usuarioTeste('PADRAO'), ...(corpo as object) } }),
    })
    renderizarApp('/meu-perfil')

    expect(await screen.findByText('ana@exemplo.com')).toBeInTheDocument()
    expect(screen.getByText('Pessoa usuária', { selector: 'dd' })).toBeInTheDocument()

    const nome = screen.getByLabelText('Nome')
    await pessoa.clear(nome)
    await pessoa.type(nome, 'Ana Nova')
    await pessoa.type(screen.getByLabelText('Telefone (opcional)'), '24999998888')
    await pessoa.click(screen.getByRole('button', { name: 'Salvar dados' }))

    expect(await screen.findByText('Dados atualizados.')).toBeInTheDocument()
    expect(chamadas.find((c) => c.chave === 'PATCH /me')?.corpo).toEqual({
      nome: 'Ana Nova',
      telefone: '(24) 99999-8888',
      cep: '25651-000',
      logradouro: 'Rua Afrânio de Melo Franco',
      numero: '333',
      complemento: '',
      bairro: 'Quitandinha',
      cidade: 'Petrópolis',
      uf: 'RJ',
    })
    expect(screen.getByRole('button', { name: /Ana Nova/ })).toBeInTheDocument()
  })

  it('mostra o endereço e pede para completar quando a conta ainda não tem', async () => {
    const pessoa = userEvent.setup()
    const semEndereco = {
      ...sessaoTeste('PADRAO'),
      usuario: { ...usuarioTeste('PADRAO'), cep: null, logradouro: null, numero: null, uf: null },
    }
    const { chamadas } = mockarApi({ 'POST /auth/refresh': { corpo: semEndereco } })
    renderizarApp('/meu-perfil')

    expect(await screen.findByLabelText('Cidade')).toHaveValue('Petrópolis')
    await pessoa.click(screen.getByRole('button', { name: 'Salvar dados' }))

    expect(await screen.findByText(/Informe o CEP com 8 dígitos/)).toBeInTheDocument()
    expect(screen.getByText('Informe a rua.')).toBeInTheDocument()
    expect(screen.getByLabelText('UF')).toHaveAccessibleDescription('Escolha o estado (UF).')
    expect(chamadas.map((c) => c.chave)).not.toContain('PATCH /me')
  })

  it('mostra no campo o erro de senha atual incorreta', async () => {
    const pessoa = userEvent.setup()
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') },
      'PATCH /me/senha': {
        status: 422,
        corpo: {
          detail: 'Dados inválidos.',
          codigo: 'VALIDACAO',
          campos: [{ campo: 'senha_atual', mensagem: 'Senha atual incorreta.' }],
        },
      },
    })
    renderizarApp('/meu-perfil')

    await pessoa.type(await screen.findByLabelText('Senha atual'), 'errada123')
    await pessoa.type(screen.getByLabelText('Nova senha'), 'NovaSenha9')
    await pessoa.type(screen.getByLabelText('Confirmar nova senha'), 'NovaSenha9')
    await pessoa.click(screen.getByRole('button', { name: 'Alterar senha' }))

    const campo = screen.getByLabelText('Senha atual')
    await waitFor(() => expect(campo).toHaveAttribute('aria-invalid', 'true'))
    expect(campo).toHaveAccessibleDescription('Senha atual incorreta.')
  })
})
