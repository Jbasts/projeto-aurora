import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { mascaraTelefone } from '../components/formulario/mascaras'
import { formatarMinutosSegundos } from '../hooks/useContagemRegressiva'
import { mockarApi, renderizarApp, SEM_SESSAO } from '../test/utilitarios'

describe('Login', () => {
  async function preencherEEntrar(email = 'ana@exemplo.com', senha = 'SenhaBoa123') {
    const usuario = userEvent.setup()
    await usuario.type(await screen.findByLabelText('Email'), email)
    await usuario.type(screen.getByLabelText('Senha'), senha)
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))
    return usuario
  }

  it('mostra a mensagem de credenciais inválidas', async () => {
    mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'POST /auth/login': {
        status: 401,
        corpo: { detail: 'Email ou senha incorretos.', codigo: 'CREDENCIAIS_INVALIDAS' },
      },
    })
    renderizarApp('/login')
    await preencherEEntrar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou senha incorretos.')
  })

  it('conta bloqueada: contagem regressiva e botão desabilitado', async () => {
    mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'POST /auth/login': {
        status: 423,
        corpo: { detail: 'Muitas tentativas.', codigo: 'CONTA_BLOQUEADA', segundos_restantes: 272 },
      },
    })
    renderizarApp('/login')
    await preencherEEntrar()

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Muitas tentativas. Tente novamente em 4:32')
    expect(alerta).toHaveTextContent('Tente novamente em 5 minutos.')
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  })

  it('conta pendente mostra a mensagem do servidor', async () => {
    mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'POST /auth/login': {
        status: 403,
        corpo: { detail: 'Seu cadastro ainda está em análise.', codigo: 'CONTA_PENDENTE' },
      },
    })
    renderizarApp('/login')
    await preencherEEntrar()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Seu cadastro ainda está em análise.',
    )
  })

  it('valida campos vazios sem chamar a API', async () => {
    const { chamadas } = mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    const usuario = userEvent.setup()
    renderizarApp('/login')
    await usuario.click(await screen.findByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Informe seu email.')).toBeInTheDocument()
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Informe seu email.')
    expect(chamadas.map((c) => c.chave)).not.toContain('POST /auth/login')
  })

  it('tem links para recuperar senha e cadastro', async () => {
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    renderizarApp('/login')
    expect(await screen.findByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute(
      'href',
      '/recuperar-senha',
    )
    expect(screen.getByRole('link', { name: 'Cadastre-se' })).toHaveAttribute('href', '/cadastro')
  })
})

describe('Cadastro', () => {
  async function preencher(senha = 'SenhaBoa123', confirmar = senha) {
    const usuario = userEvent.setup()
    await usuario.type(await screen.findByLabelText('Nome'), 'Ana Souza')
    await usuario.type(screen.getByLabelText('Email'), 'ana@exemplo.com')
    await usuario.type(screen.getByLabelText('Telefone (opcional)'), '24988887777')
    await usuario.type(screen.getByLabelText('Senha'), senha)
    await usuario.type(screen.getByLabelText('Confirmar senha'), confirmar)
    return usuario
  }

  it('não tem campo de perfil de acesso nem cargo', async () => {
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    renderizarApp('/cadastro')
    await screen.findByLabelText('Nome')
    expect(screen.queryByLabelText(/cargo|perfil/i)).not.toBeInTheDocument()
  })

  it('marca os requisitos da senha conforme a pessoa digita', async () => {
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    const usuario = userEvent.setup()
    renderizarApp('/cadastro')

    const requisitos = within(await screen.findByRole('list', { name: 'Requisitos da senha' }))
    expect(requisitos.getByText(/Pelo menos 8 caracteres/)).toHaveTextContent('(pendente)')

    await usuario.type(screen.getByLabelText('Senha'), 'abc')
    expect(requisitos.getByText(/Pelo menos uma letra/)).toHaveTextContent('(atendido)')
    expect(requisitos.getByText(/Pelo menos um número/)).toHaveTextContent('(pendente)')

    await usuario.type(screen.getByLabelText('Senha'), '12345')
    expect(requisitos.getByText(/Pelo menos 8 caracteres/)).toHaveTextContent('(atendido)')
    expect(requisitos.getByText(/Pelo menos um número/)).toHaveTextContent('(atendido)')
  })

  it('aplica a máscara no telefone', async () => {
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    renderizarApp('/cadastro')
    await preencher()
    expect(screen.getByLabelText('Telefone (opcional)')).toHaveValue('(24) 98888-7777')
  })

  it('avisa quando as senhas não são iguais', async () => {
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    renderizarApp('/cadastro')
    const usuario = await preencher('SenhaBoa123', 'Outra123')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar' }))
    expect(await screen.findByText('As senhas não são iguais.')).toBeInTheDocument()
  })

  it('envia os dados e mostra a tela de cadastro enviado', async () => {
    const { chamadas } = mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'POST /auth/cadastro': { status: 201, corpo: { mensagem: 'Cadastro enviado.' } },
    })
    const { router } = renderizarApp('/cadastro')
    const usuario = await preencher()
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar' }))

    expect(await screen.findByRole('heading', { name: 'Cadastro enviado' })).toBeInTheDocument()
    expect(screen.getByText(/pessoa administradora vai analisar/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/cadastro-enviado')
    expect(chamadas.find((c) => c.chave === 'POST /auth/cadastro')?.corpo).toEqual({
      nome: 'Ana Souza',
      email: 'ana@exemplo.com',
      telefone: '(24) 98888-7777',
      senha: 'SenhaBoa123',
      confirmar_senha: 'SenhaBoa123',
    })
  })

  it('mostra no campo o erro de email já cadastrado', async () => {
    const mensagem = 'Este email já está cadastrado. Faça login ou recupere sua senha.'
    mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'POST /auth/cadastro': {
        status: 422,
        corpo: {
          detail: 'Dados inválidos.',
          codigo: 'VALIDACAO',
          campos: [{ campo: 'email', mensagem }],
        },
      },
    })
    renderizarApp('/cadastro')
    const usuario = await preencher()
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar' }))

    expect(await screen.findByText(mensagem)).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(mensagem)
  })
})

describe('Recuperar senha', () => {
  it('mostra a mensagem neutra depois de pedir o email', async () => {
    const neutra =
      'Se este email estiver cadastrado, você vai receber um link para criar uma nova senha.'
    mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'POST /auth/recuperar-senha': { corpo: { mensagem: neutra } },
    })
    const usuario = userEvent.setup()
    renderizarApp('/recuperar-senha')
    await usuario.type(await screen.findByLabelText('Email'), 'qualquer@exemplo.com')
    await usuario.click(screen.getByRole('button', { name: 'Receber email' }))

    expect(await screen.findByRole('status')).toHaveTextContent(neutra)
    expect(screen.getByRole('link', { name: 'Voltar ao login' })).toHaveAttribute('href', '/login')
  })
})

describe('Redefinir senha', () => {
  it('link inválido leva para a tela de link expirado', async () => {
    mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'GET /auth/redefinir-senha/validar': {
        status: 400,
        corpo: { detail: 'Este link não é mais válido.', codigo: 'TOKEN_INVALIDO' },
      },
    })
    const { router } = renderizarApp('/redefinir-senha?token=velho')

    expect(
      await screen.findByRole('heading', { name: 'Este link não é mais válido' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/link-expirado')
    expect(screen.getByRole('link', { name: 'Solicitar novo link' })).toHaveAttribute(
      'href',
      '/recuperar-senha',
    )
    expect(screen.getByRole('link', { name: 'Voltar ao login' })).toHaveAttribute('href', '/login')
  })

  it('sem token também vai para link expirado', async () => {
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    const { router } = renderizarApp('/redefinir-senha')
    await screen.findByRole('heading', { name: 'Este link não é mais válido' })
    expect(router.state.location.pathname).toBe('/link-expirado')
  })

  it('atualiza a senha e volta ao login com o aviso', async () => {
    const { chamadas } = mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'GET /auth/redefinir-senha/validar': { corpo: { valido: true } },
      'POST /auth/redefinir-senha': {
        corpo: { mensagem: 'Senha atualizada. Faça login com a nova senha.' },
      },
    })
    const usuario = userEvent.setup()
    const { router } = renderizarApp('/redefinir-senha?token=abc123')

    await usuario.type(await screen.findByLabelText('Nova senha'), 'NovaSenha456')
    await usuario.type(screen.getByLabelText('Confirmar senha'), 'NovaSenha456')
    await usuario.click(screen.getByRole('button', { name: 'Atualizar senha' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Senha atualizada. Faça login com a nova senha.',
    )
    expect(router.state.location.pathname).toBe('/login')
    expect(chamadas.find((c) => c.chave === 'POST /auth/redefinir-senha')?.corpo).toEqual({
      token: 'abc123',
      senha: 'NovaSenha456',
      confirmar_senha: 'NovaSenha456',
    })
  })
})

describe('utilitários', () => {
  it.each([
    ['', ''],
    ['2', '(2'],
    ['249', '(24) 9'],
    ['2498888', '(24) 9888-8'],
    ['2422223333', '(24) 2222-3333'],
    ['24988887777', '(24) 98888-7777'],
    ['(24) 98888-77779999', '(24) 98888-7777'],
  ])('mascaraTelefone(%s) = %s', (entrada, esperado) => {
    expect(mascaraTelefone(entrada)).toBe(esperado)
  })

  it.each([
    [300, '5:00'],
    [272, '4:32'],
    [59, '0:59'],
    [0, '0:00'],
  ])('formatarMinutosSegundos(%i) = %s', (segundos, esperado) => {
    expect(formatarMinutosSegundos(segundos)).toBe(esperado)
  })
})
