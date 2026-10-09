import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mascaraTelefone } from '../components/formulario/mascaras'
import { formatarMinutosSegundos } from '../hooks/useContagemRegressiva'
import { mockarApi, renderizarApp, SEM_SESSAO, type RespostaFalsa } from '../test/utilitarios'

beforeEach(() => {
  // jsdom não cria URLs de prévia de arquivos.
  URL.createObjectURL = vi.fn(() => 'blob:previa')
  URL.revokeObjectURL = vi.fn()
})

/** Foto fictícia para o cadastro (só o tipo importa no frontend). */
function fotoTeste(tipo = 'image/png', nome = 'foto.png') {
  return new File(['imagem'], nome, { type: tipo })
}

describe('Login', () => {
  async function preencherEEntrar(email = 'ana@exemplo.com', senha = 'SenhaBoa123') {
    const usuario = userEvent.setup()
    await usuario.type(await screen.findByLabelText('Email ou CPF'), email)
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

    expect(await screen.findByText('Informe seu email ou CPF.')).toBeInTheDocument()
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email ou CPF')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Email ou CPF')).toHaveAccessibleDescription(
      'Informe seu email ou CPF.',
    )
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

const VIACEP = 'GET /ws/25651000/json/'
const RESPOSTA_VIACEP: RespostaFalsa = {
  corpo: {
    cep: '25651-000',
    logradouro: 'Rua Afrânio de Melo Franco',
    complemento: '',
    bairro: 'Quitandinha',
    localidade: 'Petrópolis',
    uf: 'RJ',
  },
}

describe('Cadastro', () => {
  async function preencher(senha = 'SenhaBoa123', confirmar = senha) {
    const usuario = userEvent.setup()
    await usuario.type(await screen.findByLabelText('Nome'), 'Ana')
    await usuario.type(screen.getByLabelText('Sobrenome'), 'Souza')
    await usuario.type(screen.getByLabelText('CPF'), '52998224725')
    await usuario.type(screen.getByLabelText('Email'), 'ana@exemplo.com')
    await usuario.type(screen.getByLabelText('Celular'), '24988887777')
    await usuario.upload(screen.getByLabelText('Sua foto'), fotoTeste())
    await usuario.type(screen.getByLabelText('CEP'), '25651000')
    await waitFor(() =>
      expect(screen.getByLabelText('Rua')).toHaveValue('Rua Afrânio de Melo Franco'),
    )
    await usuario.type(screen.getByLabelText('Número'), '333')
    await usuario.type(screen.getByLabelText('Senha'), senha)
    await usuario.type(screen.getByLabelText('Confirmar senha'), confirmar)
    return usuario
  }

  it('preenche o endereço pelo CEP (ViaCEP) e leva o foco para o número', async () => {
    const { chamadas } = mockarApi({ 'POST /auth/refresh': SEM_SESSAO, [VIACEP]: RESPOSTA_VIACEP })
    const usuario = userEvent.setup()
    renderizarApp('/cadastro')

    await usuario.type(await screen.findByLabelText('CEP'), '25651000')
    expect(screen.getByLabelText('CEP')).toHaveValue('25651-000')
    await waitFor(() => expect(screen.getByLabelText('Número')).toHaveFocus())
    expect(screen.getByLabelText('Rua')).toHaveValue('Rua Afrânio de Melo Franco')
    expect(screen.getByLabelText('Bairro (opcional)')).toHaveValue('Quitandinha')
    expect(screen.getByLabelText('Cidade')).toHaveValue('Petrópolis')
    expect(screen.getByLabelText('UF')).toHaveValue('RJ')
    expect(screen.getByText(/Endereço preenchido pelo CEP/)).toBeInTheDocument()
    const consulta = chamadas.find((c) => c.chave === VIACEP)
    expect(consulta?.url.hostname).toBe('viacep.com.br')
  })

  it('avisa quando o CEP não existe', async () => {
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO, [VIACEP]: { corpo: { erro: 'true' } } })
    const usuario = userEvent.setup()
    renderizarApp('/cadastro')

    await usuario.type(await screen.findByLabelText('CEP'), '25651000')
    expect(await screen.findByText(/CEP não encontrado/)).toBeInTheDocument()
    expect(screen.getByLabelText('Rua')).toHaveValue('')
  })

  it('deixa preencher à mão quando o ViaCEP está fora do ar', async () => {
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO, [VIACEP]: { status: 503 } })
    const usuario = userEvent.setup()
    renderizarApp('/cadastro')

    await usuario.type(await screen.findByLabelText('CEP'), '25651000')
    expect(await screen.findByText(/Preencha o endereço manualmente/)).toBeInTheDocument()
    expect(screen.getByLabelText('Rua')).toBeEnabled()
  })

  it('o endereço é obrigatório', async () => {
    const { chamadas } = mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    const usuario = userEvent.setup()
    renderizarApp('/cadastro')
    await usuario.click(await screen.findByRole('button', { name: 'Cadastrar' }))

    expect(await screen.findByText(/Informe o CEP com 8 dígitos/)).toBeInTheDocument()
    expect(screen.getByText('Informe a rua.')).toBeInTheDocument()
    expect(screen.getByText('Informe o número (ou S/N).')).toBeInTheDocument()
    expect(screen.getByText('Informe a cidade.')).toBeInTheDocument()
    expect(screen.getByText('Escolha o estado (UF).')).toBeInTheDocument()
    expect(chamadas.map((c) => c.chave)).not.toContain('POST /auth/cadastro')
  })

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

  it('valida o CPF e o celular', async () => {
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    const usuario = userEvent.setup()
    renderizarApp('/cadastro')
    await usuario.type(await screen.findByLabelText('CPF'), '52998224724')
    await usuario.type(screen.getByLabelText('Celular'), '2422334455')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar' }))

    expect(await screen.findByText('Informe um CPF válido.')).toBeInTheDocument()
    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-24')
    expect(screen.getByLabelText('Celular')).toHaveAccessibleDescription(
      'Informe o celular com DDD, no formato (00) 00000-0000.',
    )
    expect(screen.getByText('Informe seu sobrenome.')).toBeInTheDocument()
  })

  it('aplica a máscara no telefone e no CPF', async () => {
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO, [VIACEP]: RESPOSTA_VIACEP })
    renderizarApp('/cadastro')
    await preencher()
    expect(screen.getByLabelText('Celular')).toHaveValue('(24) 98888-7777')
    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-25')
  })

  it('avisa quando as senhas não são iguais', async () => {
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO, [VIACEP]: RESPOSTA_VIACEP })
    renderizarApp('/cadastro')
    const usuario = await preencher('SenhaBoa123', 'Outra123')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar' }))
    expect(await screen.findByText('As senhas não são iguais.')).toBeInTheDocument()
  })

  it('envia os dados e pede para confirmar o email', async () => {
    const neutra = 'Se este email estiver cadastrado e ainda não tiver sido confirmado, ...'
    const { chamadas } = mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      [VIACEP]: RESPOSTA_VIACEP,
      'POST /auth/cadastro': { status: 201, corpo: { mensagem: 'Cadastro enviado.' } },
      'POST /auth/reenviar-verificacao': { corpo: { mensagem: neutra } },
    })
    const { router } = renderizarApp('/cadastro')
    const usuario = await preencher()
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar' }))

    expect(await screen.findByRole('heading', { name: 'Cadastro enviado' })).toBeInTheDocument()
    expect(screen.getByText('Confirme seu email')).toBeInTheDocument()
    expect(screen.getByText('ana@exemplo.com', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText(/pessoa\s+administradora vai analisar/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/cadastro-enviado')
    expect(chamadas.find((c) => c.chave === 'POST /auth/cadastro')?.corpo).toEqual({
      nome: 'Ana',
      sobrenome: 'Souza',
      cpf: '529.982.247-25',
      email: 'ana@exemplo.com',
      telefone: '(24) 98888-7777',
      foto: expect.any(File),
      senha: 'SenhaBoa123',
      confirmar_senha: 'SenhaBoa123',
      cep: '25651-000',
      logradouro: 'Rua Afrânio de Melo Franco',
      numero: '333',
      complemento: '',
      bairro: 'Quitandinha',
      cidade: 'Petrópolis',
      uf: 'RJ',
    })

    expect(screen.getByLabelText('Email cadastrado')).toHaveValue('ana@exemplo.com')
    await usuario.click(screen.getByRole('button', { name: 'Reenviar email de confirmação' }))
    expect(await screen.findByRole('status')).toHaveTextContent(neutra)
    expect(chamadas.find((c) => c.chave === 'POST /auth/reenviar-verificacao')?.corpo).toEqual({
      email: 'ana@exemplo.com',
    })
  })

  it('mostra no campo o erro de email já cadastrado', async () => {
    const mensagem = 'Este email já está cadastrado. Faça login ou recupere sua senha.'
    mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      [VIACEP]: RESPOSTA_VIACEP,
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
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      expect.stringContaining(mensagem),
    )
  })
})

describe('Confirmação de email', () => {
  it('o link confirma o email', async () => {
    const { chamadas } = mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'POST /auth/verificar-email': { corpo: { mensagem: 'Email confirmado. Aguarde.' } },
    })
    renderizarApp('/verificar-email?token=abc123')

    expect(await screen.findByRole('heading', { name: 'Email confirmado' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Email confirmado. Aguarde.')
    expect(screen.getByRole('link', { name: 'Ir para o login' })).toHaveAttribute('href', '/login')
    const confirmacoes = chamadas.filter((c) => c.chave === 'POST /auth/verificar-email')
    expect(confirmacoes).toHaveLength(1)
    expect(confirmacoes[0]?.corpo).toEqual({ token: 'abc123' })
  })

  it('link inválido oferece um novo link', async () => {
    mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'POST /auth/verificar-email': {
        status: 400,
        corpo: { detail: 'Link inválido.', codigo: 'TOKEN_INVALIDO' },
      },
    })
    renderizarApp('/verificar-email?token=velho')

    expect(await screen.findByRole('alert')).toHaveTextContent(/expirou ou já foi usado/)
    expect(screen.getByLabelText('Email cadastrado')).toHaveValue('')
    expect(
      screen.getByRole('button', { name: 'Reenviar email de confirmação' }),
    ).toBeInTheDocument()
  })

  it('login de conta sem email confirmado oferece reenviar o link', async () => {
    const usuario = userEvent.setup()
    mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'POST /auth/login': {
        status: 403,
        corpo: { detail: 'Confirme seu email para continuar.', codigo: 'EMAIL_NAO_VERIFICADO' },
      },
    })
    renderizarApp('/login')
    await usuario.type(await screen.findByLabelText('Email ou CPF'), 'ana@exemplo.com')
    await usuario.type(screen.getByLabelText('Senha'), 'SenhaBoa123')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Confirme seu email para continuar.')
    expect(screen.getByLabelText('Email cadastrado')).toHaveValue('ana@exemplo.com')
  })
})

describe('Recuperar senha', () => {
  it('mostra a mensagem neutra depois de pedir o email', async () => {
    const neutra = 'Se este email ou CPF estiver cadastrado, você vai receber um link.'
    const { chamadas } = mockarApi({
      'POST /auth/refresh': SEM_SESSAO,
      'POST /auth/recuperar-senha': { corpo: { mensagem: neutra } },
    })
    const usuario = userEvent.setup()
    renderizarApp('/recuperar-senha')
    await usuario.type(await screen.findByLabelText('Email ou CPF'), 'qualquer@exemplo.com')
    await usuario.click(screen.getByRole('button', { name: 'Receber email' }))

    expect(await screen.findByRole('status')).toHaveTextContent(neutra)
    expect(chamadas.find((c) => c.chave === 'POST /auth/recuperar-senha')?.corpo).toEqual({
      login: 'qualquer@exemplo.com',
    })
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
