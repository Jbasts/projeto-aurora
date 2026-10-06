import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Pessoa } from '../features/pessoas/tipos'
import { mockarApi, renderizarApp, sessaoTeste } from '../test/utilitarios'

const ID = '11111111-1111-1111-1111-111111111111'

function pessoaTeste(dados: Partial<Pessoa> = {}): Pessoa {
  return {
    id: ID,
    nome: 'João',
    sobrenome: 'da Conceição',
    apelido: 'Joca',
    idade_aproximada: 45,
    email: null,
    telefone: '(24) 99999-8888',
    nome_contato: null,
    telefone_contato: null,
    observacoes: null,
    consentimento: true,
    consentimento_em: '2026-10-01T12:00:00Z',
    status: 'ATIVA',
    motivo_inativacao: null,
    inativada_em: null,
    inativada_por: null,
    cadastrada_por: { id: 'u1', nome: 'Colab Teste' },
    foto_perfil: null,
    album: [],
    ultima_vez_visto: null,
    ultima_latitude: null,
    ultima_longitude: null,
    ultimo_endereco: null,
    criado_em: '2026-10-01T12:00:00Z',
    atualizado_em: '2026-10-01T12:00:00Z',
    ...dados,
  }
}

beforeEach(() => {
  // jsdom não cria URLs de prévia de arquivos.
  URL.createObjectURL = vi.fn(() => `blob:previa-${Math.random()}`)
  URL.revokeObjectURL = vi.fn()
})

describe('Cadastro de pessoa', () => {
  it('pessoa usuária não acessa o cadastro', async () => {
    mockarApi({ 'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') } })
    renderizarApp('/pessoas/nova')
    expect(await screen.findByRole('heading', { name: 'Acesso negado' })).toBeInTheDocument()
  })

  it('percorre as 3 etapas, avisa duplicidade e cadastra sem local', async () => {
    const pessoa = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('COLABORADOR') },
      'GET /pessoas/sugestoes': {
        corpo: [
          {
            id: 'outra',
            nome: 'João',
            sobrenome: 'Conceição',
            apelido: 'Jão',
            status: 'INATIVA',
            url_miniatura: null,
          },
        ],
      },
      'POST /pessoas': (corpo) => ({
        status: 201,
        corpo: pessoaTeste({ ...(corpo as Partial<Pessoa>) }),
      }),
      [`GET /pessoas/${ID}`]: { corpo: pessoaTeste({ consentimento: false }) },
    })
    const { router } = renderizarApp('/pessoas/nova')

    // Etapa 1: obrigatórios
    await screen.findByRole('heading', { name: /situação de rua/ })
    const etapas = screen.getByRole('list', { name: 'Etapas do cadastro' })
    expect(within(etapas).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step')
    await pessoa.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByLabelText('Nome')).toHaveAccessibleDescription('Informe o nome.')

    await pessoa.type(screen.getByLabelText('Nome'), 'João')
    await pessoa.type(screen.getByLabelText('Sobrenome'), 'da Conceição')
    expect(
      await screen.findByRole('heading', { name: 'Pessoas com nome parecido' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /João Conceição/ })).toHaveAttribute(
      'href',
      '/pessoas/outra',
    )
    await pessoa.click(screen.getByRole('button', { name: 'Próximo' }))

    // Etapa 2: consentimento obrigatório, sem resposta pré-marcada
    expect(within(etapas).getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step')
    await pessoa.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(
      await screen.findByText('Informe se a pessoa autorizou o cadastro e o uso de fotos.'),
    ).toBeInTheDocument()
    await pessoa.click(screen.getByRole('radio', { name: 'Não autorizou' }))
    expect(screen.queryByText(/Escolher foto de perfil/)).not.toBeInTheDocument()
    await pessoa.click(screen.getByRole('button', { name: 'Próximo' }))

    // Etapa 3: opcional
    expect(await screen.findByRole('region', { name: /Mapa para marcar/ })).toBeInTheDocument()
    await pessoa.click(screen.getByRole('button', { name: 'Pular por enquanto' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(`/pessoas/${ID}`))
    expect(await screen.findByText('Pessoa cadastrada.')).toBeInTheDocument()
    expect(chamadas.find((c) => c.chave === 'POST /pessoas')?.corpo).toEqual({
      nome: 'João',
      sobrenome: 'da Conceição',
      apelido: null,
      idade_aproximada: null,
      email: null,
      telefone: null,
      nome_contato: null,
      telefone_contato: null,
      observacoes: null,
      consentimento: false,
      avistamento: null,
    })
  })

  it('com consentimento, envia a foto de perfil depois de cadastrar', async () => {
    // applyAccept: false deixa escolher um GIF, para testar a validação do próprio app.
    const pessoa = userEvent.setup({ applyAccept: false })
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': { corpo: { itens: [], total: 0, pagina: 1, tamanho: 1 } },
      'GET /pessoas/sugestoes': { corpo: [] },
      'POST /pessoas': { status: 201, corpo: pessoaTeste() },
      [`POST /pessoas/${ID}/foto-perfil`]: { status: 201, corpo: {} },
      [`GET /pessoas/${ID}`]: { corpo: pessoaTeste() },
    })
    renderizarApp('/pessoas/nova')

    await pessoa.type(await screen.findByLabelText('Nome'), 'João')
    await pessoa.type(screen.getByLabelText('Sobrenome'), 'Silva')
    await pessoa.click(screen.getByRole('button', { name: 'Próximo' }))
    await pessoa.click(screen.getByRole('radio', { name: 'Sim, autorizou' }))

    const foto = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    await pessoa.upload(screen.getByLabelText('Escolher foto de perfil'), foto)
    expect(screen.getByAltText('Prévia da foto de perfil')).toBeInTheDocument()

    const gif = new File(['x'], 'anim.gif', { type: 'image/gif' })
    await pessoa.upload(screen.getByLabelText(/Adicionar fotos ao álbum/), gif)
    expect(screen.getByText('Envie uma foto em JPG, PNG ou WEBP.')).toBeInTheDocument()

    await pessoa.click(screen.getByRole('button', { name: 'Próximo' }))
    await pessoa.click(screen.getByRole('button', { name: 'Pular por enquanto' }))

    expect(await screen.findByText('Pessoa cadastrada.')).toBeInTheDocument()
    expect(chamadas.map((c) => c.chave)).toContain(`POST /pessoas/${ID}/foto-perfil`)
  })
})

describe('Perfil da pessoa', () => {
  it('pessoa usuária vê os dados como texto, sem ações de edição', async () => {
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') },
      [`GET /pessoas/${ID}`]: { corpo: pessoaTeste() },
    })
    renderizarApp(`/pessoas/${ID}`)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'João da Conceição' }),
    ).toBeInTheDocument()
    expect(screen.getByText('"Joca"')).toBeInTheDocument()
    expect(screen.getByText(/Cadastrada por Colab Teste em 01\/10\/2026/)).toBeInTheDocument()
    expect(screen.getByText('45 anos')).toBeInTheDocument()
    expect(screen.getByText(/Ainda não há registro de onde a pessoa foi vista/)).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Inativar' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Adicionar foto de perfil/)).not.toBeInTheDocument()
  })

  it('mostra última localização com data e minimapa', async () => {
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') },
      [`GET /pessoas/${ID}`]: {
        corpo: pessoaTeste({
          ultima_vez_visto: '2026-10-05T17:30:00Z',
          ultima_latitude: -22.505,
          ultima_longitude: -43.179,
        }),
      },
    })
    renderizarApp(`/pessoas/${ID}`)
    expect(await screen.findByText('05/10/2026 às 14:30')).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: /Minimapa/ })).toBeInTheDocument()
    expect(screen.getByText('Coordenadas: -22.50500, -43.17900')).toBeInTheDocument()
  })

  it('inativa com motivo', async () => {
    const pessoa = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('COLABORADOR') },
      [`GET /pessoas/${ID}`]: { corpo: pessoaTeste() },
      [`POST /pessoas/${ID}/inativar`]: (corpo) => ({
        corpo: pessoaTeste({
          status: 'INATIVA',
          motivo_inativacao: (corpo as { motivo: string }).motivo,
          inativada_em: '2026-10-06T12:00:00Z',
        }),
      }),
    })
    renderizarApp(`/pessoas/${ID}`)

    await pessoa.click(await screen.findByRole('button', { name: 'Inativar' }))
    const modal = screen.getByRole('dialog', { name: 'Inativar João da Conceição' })
    await pessoa.type(within(modal).getByLabelText('Motivo (opcional)'), 'Mudou de cidade')
    await pessoa.click(within(modal).getByRole('button', { name: 'Inativar' }))

    expect(await screen.findByText('Pessoa inativada.')).toBeInTheDocument()
    expect(screen.getByText(/Motivo: Mudou de cidade/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reativar' })).toBeInTheDocument()
    expect(chamadas.find((c) => c.chave.endsWith('/inativar'))?.corpo).toEqual({
      motivo: 'Mudou de cidade',
    })
  })

  it('sem consentimento não oferece envio de fotos', async () => {
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': { corpo: { itens: [], total: 0, pagina: 1, tamanho: 1 } },
      [`GET /pessoas/${ID}`]: { corpo: pessoaTeste({ consentimento: false }) },
    })
    renderizarApp(`/pessoas/${ID}`)
    expect(await screen.findByText(/A pessoa não autorizou o uso de fotos/)).toBeInTheDocument()
    expect(screen.queryByText(/Adicionar foto de perfil/)).not.toBeInTheDocument()
  })

  it('pessoa inexistente mostra a página 404', async () => {
    mockarApi({ 'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') } })
    renderizarApp(`/pessoas/${ID}`)
    expect(await screen.findByText('Erro 404')).toBeInTheDocument()
  })
})

describe('Editar pessoa', () => {
  it('carrega os dados, salva e volta ao perfil', async () => {
    const pessoa = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('COLABORADOR') },
      [`GET /pessoas/${ID}`]: { corpo: pessoaTeste() },
      [`PUT /pessoas/${ID}`]: (corpo) => ({
        corpo: pessoaTeste({ ...(corpo as Partial<Pessoa>) }),
      }),
    })
    const { router } = renderizarApp(`/pessoas/${ID}/editar`)

    const apelido = await screen.findByLabelText('Apelido (opcional)')
    expect(apelido).toHaveValue('Joca')
    expect(screen.getByRole('radio', { name: 'Sim, autorizou' })).toBeChecked()
    await pessoa.clear(apelido)
    await pessoa.type(apelido, 'Joquinha')
    await pessoa.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Dados atualizados.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/pessoas/${ID}`)
    expect(chamadas.find((c) => c.chave.startsWith('PUT'))?.corpo).toMatchObject({
      apelido: 'Joquinha',
      idade_aproximada: 45,
      telefone: '(24) 99999-8888',
      consentimento: true,
    })
  })

  it('pessoa usuária não acessa a edição', async () => {
    mockarApi({ 'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') } })
    renderizarApp(`/pessoas/${ID}/editar`)
    expect(await screen.findByRole('heading', { name: 'Acesso negado' })).toBeInTheDocument()
  })
})
