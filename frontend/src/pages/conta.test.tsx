import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { Usuario } from '../features/auth/tipos'
import { calcularIdade } from '../features/comum/datas'
import type { Solicitacao, SolicitacaoPropria } from '../features/solicitacoes/tipos'
import type { UsuarioDetalhe } from '../features/usuarios/tipos'
import {
  mockarApi,
  renderizarApp,
  SEM_SESSAO,
  sessaoTeste,
  usuarioTeste,
} from '../test/utilitarios'

// Foto da conta, login e recuperação por CPF, trocas de email e de CPF, contas antigas.

function sessaoCom(dados: Partial<Usuario>) {
  return { corpo: { ...sessaoTeste(), usuario: { ...usuarioTeste(), ...dados } } }
}

function detalhe(dados: Partial<UsuarioDetalhe> = {}): UsuarioDetalhe {
  return {
    id: '00000000-0000-0000-0000-000000000099',
    nome: 'Bruno',
    sobrenome: 'Lima',
    cpf: '529.982.247-25',
    email: 'bruno@exemplo.com',
    telefone: '(24) 98888-7777',
    data_nascimento: '1985-03-10',
    idade: 41,
    perfil: 'PADRAO',
    status: 'ATIVO',
    criado_em: '2026-10-01T15:00:00Z',
    foto_url: null,
    foto_miniatura_url: null,
    cep: '25651-000',
    logradouro: 'Rua Afrânio de Melo Franco',
    numero: '333',
    complemento: null,
    bairro: 'Quitandinha',
    cidade: 'Petrópolis',
    uf: 'RJ',
    email_verificado_em: '2026-10-02T12:00:00Z',
    atualizado_em: '2026-10-03T12:00:00Z',
    solicitacoes_abertas: [],
    ...dados,
  }
}

describe('Login e recuperação por CPF', () => {
  it('entra com o CPF', async () => {
    const usuario = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'POST /auth/login': { corpo: sessaoTeste() },
    })
    renderizarApp('/login')
    await usuario.type(await screen.findByLabelText('Email ou CPF'), '529.982.247-25')
    await usuario.type(screen.getByLabelText('Senha'), 'SenhaBoa123')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() =>
      expect(chamadas.find((c) => c.chave === 'POST /auth/login')?.corpo).toEqual({
        login: '529.982.247-25',
        senha: 'SenhaBoa123',
      }),
    )
  })

  it('recuperar senha recusa o que não é email nem CPF', async () => {
    const usuario = userEvent.setup()
    const { chamadas } = mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    renderizarApp('/recuperar-senha')
    await usuario.type(await screen.findByLabelText('Email ou CPF'), '123.456.789-00')
    await usuario.click(screen.getByRole('button', { name: 'Receber email' }))

    expect(await screen.findByText('Informe um email ou CPF válido.')).toBeInTheDocument()
    expect(chamadas.some((c) => c.chave === 'POST /auth/recuperar-senha')).toBe(false)
  })
})

describe('Foto no cadastro', () => {
  it('é obrigatória', async () => {
    const usuario = userEvent.setup()
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    renderizarApp('/cadastro')
    await usuario.click(await screen.findByRole('button', { name: 'Cadastrar' }))

    expect(await screen.findByText('Envie uma foto sua.')).toBeInTheDocument()
    expect(screen.getByLabelText('Sua foto')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('Meu perfil: foto', () => {
  it('conta antiga sem foto vê o aviso e envia uma', async () => {
    const usuario = userEvent.setup()
    const comFoto = { ...usuarioTeste(), foto_url: '/foto.webp', foto_miniatura_url: '/mini.webp' }
    const { chamadas } = mockarApi({
      'POST /auth/refresh': sessaoCom({}),
      'PUT /me/foto': { corpo: comFoto },
    })
    renderizarApp('/meu-perfil')

    expect(await screen.findByText(/Sua conta ainda não tem foto/)).toBeInTheDocument()
    const arquivo = new File(['imagem'], 'eu.png', { type: 'image/png' })
    await usuario.upload(screen.getByLabelText('Enviar foto'), arquivo)

    expect(await screen.findByText('Foto atualizada.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Foto de Ana Teste Souza' })).toHaveAttribute(
      'src',
      '/foto.webp',
    )
    expect(chamadas.find((c) => c.chave === 'PUT /me/foto')?.corpo).toEqual({ arquivo })
    // O menu da conta também passa a mostrar a foto.
    const menu = screen.getByRole('button', { name: /Ana Teste/ })
    expect(menu.querySelector('img')).toHaveAttribute('src', '/mini.webp')
  })

  it('recusa arquivo que não é foto sem chamar a API', async () => {
    const usuario = userEvent.setup({ applyAccept: false })
    const { chamadas } = mockarApi({ 'POST /auth/refresh': sessaoCom({}) })
    renderizarApp('/meu-perfil')
    const pdf = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })
    await usuario.upload(await screen.findByLabelText('Enviar foto'), pdf)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Envie uma foto em JPG, PNG ou WEBP.',
    )
    expect(chamadas.some((c) => c.chave === 'PUT /me/foto')).toBe(false)
  })
})

const EMAIL_AGUARDANDO: SolicitacaoPropria = {
  tipo: 'EMAIL',
  status: 'AGUARDANDO_EMAIL',
  valor_novo_exibicao: 'ana.nova@exemplo.com',
  criado_em: '2026-10-09T12:00:00Z',
  email_confirmado_em: null,
  decidido_em: null,
}

const CPF_PENDENTE: SolicitacaoPropria = {
  tipo: 'CPF',
  status: 'PENDENTE',
  valor_novo_exibicao: '***.444.777-**',
  criado_em: '2026-10-09T12:00:00Z',
  email_confirmado_em: null,
  decidido_em: null,
}

describe('Meu perfil: alterar email ou CPF', () => {
  it('pede as duas trocas no popup e mostra que esperam a aprovação', async () => {
    const usuario = userEvent.setup()
    const depois = {
      ...usuarioTeste(),
      solicitacao_email: EMAIL_AGUARDANDO,
      solicitacao_cpf: CPF_PENDENTE,
    }
    const { chamadas } = mockarApi({
      'POST /auth/refresh': sessaoCom({}),
      'POST /me/pedido-alteracao': { corpo: depois },
    })
    renderizarApp('/meu-perfil')

    await usuario.click(await screen.findByRole('button', { name: 'Alterar email ou CPF' }))
    const popup = screen.getByRole('dialog', { name: 'Alterar email ou CPF' })
    expect(popup).toHaveTextContent(/aprovação de uma pessoa\s+administradora/)
    await usuario.type(
      within(popup).getByLabelText('Novo email (opcional)'),
      'ana.nova@exemplo.com',
    )
    await usuario.type(within(popup).getByLabelText('Novo CPF (opcional)'), '11144477735')
    await usuario.type(within(popup).getByLabelText('Sua senha'), 'SenhaBoa123')
    await usuario.click(within(popup).getByRole('button', { name: 'Enviar pedido' }))

    expect(
      await screen.findByText(/Enviamos um link para ana.nova@exemplo.com/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(chamadas.find((c) => c.chave === 'POST /me/pedido-alteracao')?.corpo).toEqual({
      email: 'ana.nova@exemplo.com',
      cpf: '111.444.777-35',
      senha: 'SenhaBoa123',
    })
    expect(screen.getByText('Troca de email: falta abrir o link.')).toBeInTheDocument()
    expect(screen.getByText('Troca de CPF em análise.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar troca de email' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar troca de CPF' })).toBeInTheDocument()
  })

  it('email confirmado pelo link aparece em análise, com o email atual valendo', async () => {
    mockarApi({
      'POST /auth/refresh': sessaoCom({
        solicitacao_email: {
          ...EMAIL_AGUARDANDO,
          status: 'PENDENTE',
          email_confirmado_em: '2026-10-09T13:00:00Z',
        },
      }),
    })
    renderizarApp('/meu-perfil')
    const situacao = await screen.findByText('Troca de email em análise.')
    expect(situacao.closest('p')).toHaveTextContent(/continue usando ana@exemplo.com/)
  })

  it('valida o popup: precisa de algo para trocar e da senha', async () => {
    const usuario = userEvent.setup()
    const { chamadas } = mockarApi({ 'POST /auth/refresh': sessaoCom({}) })
    renderizarApp('/meu-perfil')
    await usuario.click(await screen.findByRole('button', { name: 'Alterar email ou CPF' }))
    const popup = screen.getByRole('dialog')
    await usuario.click(within(popup).getByRole('button', { name: 'Enviar pedido' }))

    expect(
      await within(popup).findByText('Informe o novo email, o novo CPF ou os dois.'),
    ).toBeInTheDocument()
    expect(within(popup).getByText('Informe sua senha.')).toBeInTheDocument()
    expect(chamadas.some((c) => c.chave === 'POST /me/pedido-alteracao')).toBe(false)
  })

  it('mostra no campo a senha incorreta devolvida pela API', async () => {
    const usuario = userEvent.setup()
    mockarApi({
      'POST /auth/refresh': sessaoCom({}),
      'POST /me/pedido-alteracao': {
        status: 422,
        corpo: {
          detail: 'Dados inválidos.',
          codigo: 'VALIDACAO',
          campos: [{ campo: 'senha', mensagem: 'Senha incorreta.' }],
        },
      },
    })
    renderizarApp('/meu-perfil')
    await usuario.click(await screen.findByRole('button', { name: 'Alterar email ou CPF' }))
    const popup = screen.getByRole('dialog')
    await usuario.type(within(popup).getByLabelText('Novo email (opcional)'), 'x@exemplo.com')
    await usuario.type(within(popup).getByLabelText('Sua senha'), 'errada123')
    await usuario.click(within(popup).getByRole('button', { name: 'Enviar pedido' }))

    expect(await within(popup).findByText('Senha incorreta.')).toBeInTheDocument()
  })

  it('cancela a troca de email', async () => {
    const usuario = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': sessaoCom({ solicitacao_email: EMAIL_AGUARDANDO }),
      'DELETE /me/troca-email': { corpo: usuarioTeste() },
    })
    renderizarApp('/meu-perfil')
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar troca de email' }))

    expect(await screen.findByText('Troca de email cancelada.')).toBeInTheDocument()
    expect(screen.queryByText('Troca de email: falta abrir o link.')).not.toBeInTheDocument()
    expect(chamadas.some((c) => c.chave === 'DELETE /me/troca-email')).toBe(true)
  })

  it('mostra a troca de CPF recusada', async () => {
    mockarApi({
      'POST /auth/refresh': sessaoCom({
        solicitacao_cpf: {
          ...CPF_PENDENTE,
          status: 'RECUSADA',
          decidido_em: '2026-10-09T12:00:00Z',
        },
      }),
    })
    renderizarApp('/meu-perfil')
    expect(
      await screen.findByText(/Sua solicitação de troca de CPF foi recusada em 09\/10\/2026/),
    ).toBeInTheDocument()
  })
})

describe('Confirmar novo email', () => {
  it('confirma pelo link, avisa que falta a aprovação e leva ao login', async () => {
    const mensagem = 'Email confirmado. Agora uma pessoa administradora vai analisar a troca.'
    const { chamadas } = mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'POST /auth/confirmar-novo-email': { corpo: { mensagem } },
    })
    renderizarApp('/confirmar-novo-email?token=abc')

    expect(await screen.findByRole('heading', { name: 'Email confirmado' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(mensagem)
    expect(screen.getByRole('link', { name: 'Ir para o login' })).toHaveAttribute('href', '/login')
    expect(chamadas.filter((c) => c.chave === 'POST /auth/confirmar-novo-email')).toHaveLength(1)
  })

  it('com a sessão aberta, atualiza Meu perfil', async () => {
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste() },
      'POST /auth/confirmar-novo-email': { corpo: { mensagem: 'Email confirmado.' } },
      'GET /auth/me': {
        corpo: {
          ...usuarioTeste(),
          solicitacao_email: { ...EMAIL_AGUARDANDO, status: 'PENDENTE' },
        },
      },
    })
    const { router } = renderizarApp('/confirmar-novo-email?token=abc')
    const link = await screen.findByRole('link', { name: 'Ir para Meu perfil' })
    await userEvent.setup().click(link)

    expect(router.state.location.pathname).toBe('/meu-perfil')
    expect(await screen.findByText('Troca de email em análise.')).toBeInTheDocument()
  })

  it('link inválido', async () => {
    mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'POST /auth/confirmar-novo-email': {
        status: 400,
        corpo: { detail: 'Link inválido.', codigo: 'TOKEN_INVALIDO' },
      },
    })
    renderizarApp('/confirmar-novo-email?token=velho')
    expect(await screen.findByRole('alert')).toHaveTextContent(/expirou, já foi usado/)
  })
})

function solicitacao(dados: Partial<Solicitacao> = {}): Solicitacao {
  return {
    id: 's1',
    tipo: 'CPF',
    status: 'PENDENTE',
    usuario: {
      id: '00000000-0000-0000-0000-000000000099',
      nome_completo: 'Bruno Lima',
      foto_miniatura_url: '/mini-bruno.webp',
    },
    valor_atual: '529.982.247-25',
    valor_novo: '111.444.777-35',
    criado_em: '2026-10-09T12:00:00Z',
    email_confirmado_em: null,
    decidido_em: null,
    decidido_por: null,
    ...dados,
  }
}

function paginaDe<T>(itens: T[]) {
  return { corpo: { itens, total: itens.length, pagina: 1, tamanho: 5 } }
}

describe('Solicitações', () => {
  it('lista as pendentes e aprova depois de confirmar no popup', async () => {
    const usuario = userEvent.setup()
    const email = solicitacao({
      id: 's2',
      tipo: 'EMAIL',
      valor_atual: 'bruno@exemplo.com',
      valor_novo: 'bruno.novo@exemplo.com',
      email_confirmado_em: '2026-10-09T13:00:00Z',
    })
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': paginaDe([]),
      'GET /solicitacoes': paginaDe([solicitacao(), email]),
      'POST /solicitacoes/s2/aprovar': { corpo: { ...email, status: 'APROVADA' } },
    })
    renderizarApp('/solicitacoes')

    const lista = await screen.findByRole('list', { name: 'Solicitações' })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2)
    expect(within(lista).getByText('bruno.novo@exemplo.com')).toBeInTheDocument()
    expect(within(lista).getByText('Email novo confirmado em:')).toBeInTheDocument()
    const consulta = chamadas.find(
      (c) => c.chave === 'GET /solicitacoes' && c.url.searchParams.get('tamanho') !== '1',
    )
    expect(consulta?.url.searchParams.get('status')).toBe('PENDENTE')

    await usuario.click(
      within(lista).getByRole('button', { name: 'Aprovar troca de Email de Bruno Lima' }),
    )
    const popup = screen.getByRole('dialog', { name: 'Aprovar troca de Email de Bruno Lima' })
    expect(popup).toHaveTextContent('De bruno@exemplo.com para bruno.novo@exemplo.com.')
    await usuario.click(within(popup).getByRole('button', { name: 'Aprovar troca' }))

    expect(
      await screen.findByText('A troca de Email de Bruno Lima foi aprovada.'),
    ).toBeInTheDocument()
    expect(chamadas.some((c) => c.chave === 'POST /solicitacoes/s2/aprovar')).toBe(true)
  })

  it('mostra quem decidiu nas encerradas, sem botões', async () => {
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': paginaDe([]),
      'GET /solicitacoes': paginaDe([
        solicitacao({
          status: 'RECUSADA',
          decidido_em: '2026-10-09T14:00:00Z',
          decidido_por: 'Admin Principal',
        }),
      ]),
    })
    renderizarApp('/solicitacoes')
    const lista = await screen.findByRole('list', { name: 'Solicitações' })
    expect(within(lista).getByText(/por Admin Principal/)).toBeInTheDocument()
    expect(within(lista).queryByRole('button')).not.toBeInTheDocument()
  })

  it.each(['COLABORADOR', 'PADRAO'] as const)(
    'perfil %s vai para Acesso negado',
    async (perfil) => {
      mockarApi({ 'POST /auth/refresh': { corpo: sessaoTeste(perfil) } })
      renderizarApp('/solicitacoes')
      expect(await screen.findByRole('heading', { name: 'Acesso negado' })).toBeInTheDocument()
    },
  )
})

describe('Permissões', () => {
  it('altera o perfil de acesso de uma conta', async () => {
    const usuario = userEvent.setup()
    const bruno = detalhe()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': paginaDe([bruno, detalhe({ id: 'p2', nome: 'Carla', status: 'PENDENTE' })]),
      [`PATCH /usuarios/${bruno.id}`]: { corpo: { ...bruno, perfil: 'COLABORADOR' } },
    })
    renderizarApp('/permissoes')

    const lista = await screen.findByRole('list', { name: 'Permissões das contas' })
    expect(within(lista).getByText('Aguardando aprovação')).toBeInTheDocument()
    await usuario.click(within(lista).getByRole('button', { name: 'Alterar perfil: Bruno Lima' }))
    const popup = screen.getByRole('dialog', { name: 'Alterar perfil de Bruno Lima' })
    await usuario.click(within(popup).getByLabelText('Pessoa colaboradora'))
    await usuario.click(within(popup).getByRole('button', { name: 'Salvar perfil' }))

    expect(
      await screen.findByText('Perfil de acesso de Bruno Lima alterado para Pessoa colaboradora.'),
    ).toBeInTheDocument()
    expect(chamadas.find((c) => c.chave === `PATCH /usuarios/${bruno.id}`)?.corpo).toEqual({
      perfil: 'COLABORADOR',
    })
  })

  it('Gerenciar usuários não tem mais "Alterar perfil"', async () => {
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': paginaDe([detalhe()]),
    })
    renderizarApp('/usuarios')
    const tabela = await screen.findByRole('table')
    expect(within(tabela).getByRole('button', { name: 'Inativar: Bruno Lima' })).toBeInTheDocument()
    expect(within(tabela).queryByRole('button', { name: /Alterar perfil/ })).not.toBeInTheDocument()
  })
})

describe('Dados do usuário: solicitações e contas antigas', () => {
  it('mostra as solicitações em aberto com o caminho para decidir', async () => {
    const comAberta = detalhe({
      solicitacoes_abertas: [
        {
          id: 's1',
          tipo: 'CPF',
          status: 'PENDENTE',
          valor_novo: '111.444.777-35',
          criado_em: '2026-10-09T12:00:00Z',
        },
      ],
    })
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': paginaDe([]),
      [`GET /usuarios/${comAberta.id}`]: { corpo: comAberta },
    })
    renderizarApp(`/usuarios/${comAberta.id}`)

    const secao = await screen.findByRole('region', { name: 'Solicitações em aberto' })
    expect(within(secao).getByText('111.444.777-35')).toBeInTheDocument()
    expect(within(secao).getByRole('link', { name: 'Ir para Solicitações' })).toHaveAttribute(
      'href',
      '/solicitacoes',
    )
  })

  it('completa o CPF de uma conta antiga', async () => {
    const usuario = userEvent.setup()
    const antiga = detalhe({ cpf: null })
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': { corpo: { itens: [], total: 0, pagina: 1, tamanho: 1 } },
      [`GET /usuarios/${antiga.id}`]: { corpo: antiga },
      [`PATCH /usuarios/${antiga.id}/dados`]: { corpo: { ...antiga, cpf: '111.444.777-35' } },
    })
    renderizarApp(`/usuarios/${antiga.id}`)

    await usuario.click(await screen.findByRole('button', { name: 'Completar dados' }))
    const popup = screen.getByRole('dialog', { name: 'Completar dados de Bruno Lima' })
    expect(within(popup).queryByLabelText('Sobrenome')).not.toBeInTheDocument()
    await usuario.type(within(popup).getByLabelText('CPF'), '11144477735')
    await usuario.click(within(popup).getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Dados completados.')).toBeInTheDocument()
    expect(chamadas.find((c) => c.chave === `PATCH /usuarios/${antiga.id}/dados`)?.corpo).toEqual({
      sobrenome: '',
      cpf: '111.444.777-35',
    })
    expect(screen.queryByRole('button', { name: 'Completar dados' })).not.toBeInTheDocument()
  })
})

describe('Data de nascimento', () => {
  it('Meu perfil calcula a idade enquanto a pessoa digita', async () => {
    const usuario = userEvent.setup()
    mockarApi({ 'POST /auth/refresh': sessaoCom({ data_nascimento: null, idade: null }) })
    renderizarApp('/meu-perfil')
    const campo = await screen.findByLabelText('Data de nascimento')
    expect(campo).toHaveValue('')
    await usuario.type(campo, '2000-01-15')
    const idade = calcularIdade('2000-01-15') ?? 0
    expect(campo).toHaveAccessibleDescription(`Idade: ${idade} anos`)
  })

  it('recusa data no futuro sem chamar a API', async () => {
    const usuario = userEvent.setup()
    const { chamadas } = mockarApi({ 'POST /auth/refresh': sessaoCom({}) })
    renderizarApp('/meu-perfil')
    const campo = await screen.findByLabelText('Data de nascimento')
    await usuario.clear(campo)
    await usuario.type(campo, '2999-01-01')
    await usuario.click(screen.getByRole('button', { name: 'Salvar dados' }))

    expect(
      await screen.findByText('A data de nascimento não pode ser no futuro.'),
    ).toBeInTheDocument()
    expect(chamadas.some((c) => c.chave === 'PATCH /me')).toBe(false)
  })

  it('Dados do usuário mostra a data e a idade', async () => {
    const bruno = detalhe()
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': paginaDe([]),
      [`GET /usuarios/${bruno.id}`]: { corpo: bruno },
    })
    renderizarApp(`/usuarios/${bruno.id}`)
    const pessoais = await screen.findByRole('region', { name: 'Dados pessoais' })
    expect(within(pessoais).getByText('10/03/1985')).toBeInTheDocument()
    expect(within(pessoais).getByText('41 anos')).toBeInTheDocument()
  })

  it('a idade só muda no dia do aniversário', () => {
    expect(calcularIdade('1990-05-20', new Date(2026, 4, 19))).toBe(35)
    expect(calcularIdade('1990-05-20', new Date(2026, 4, 20))).toBe(36)
    expect(calcularIdade('', new Date(2026, 4, 20))).toBeNull()
  })
})
