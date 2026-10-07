import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { AvistamentoHistorico } from '../features/mapa/api'
import type { Pessoa } from '../features/pessoas/tipos'
import { mockarApi, renderizarApp, sessaoTeste } from '../test/utilitarios'

const DIA = 86_400_000
const ID = '11111111-1111-1111-1111-111111111111'

function pessoaTeste(dados: Partial<Pessoa> = {}): Pessoa {
  return {
    id: ID,
    nome: 'João',
    sobrenome: 'da Conceição',
    apelido: 'Joca',
    idade_aproximada: 45,
    email: null,
    telefone: null,
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
    ultima_vez_visto: '2026-10-05T19:30:00Z',
    ultima_latitude: -22.505,
    ultima_longitude: -43.179,
    ultimo_endereco: 'Rua do Imperador, 288 – Centro, Petrópolis',
    criado_em: '2026-10-01T12:00:00Z',
    atualizado_em: '2026-10-01T12:00:00Z',
    ...dados,
  }
}

function avistamento(n: number): AvistamentoHistorico {
  return {
    id: `a${n}`,
    latitude: -22.505,
    longitude: -43.179,
    endereco: n === 1 ? 'Praça da Liberdade – Centro, Petrópolis' : null,
    visto_em: `2026-10-${String(10 - n).padStart(2, '0')}T19:30:00Z`,
    observacao: n === 1 ? 'Perto do ponto de ônibus' : null,
    registrado_por:
      n === 1
        ? { id: 'u1', nome: 'Ana Souza', perfil: 'COLABORADOR' }
        : { id: 'u2', nome: 'Adm', perfil: 'ADMIN' },
    criado_em: '2026-10-05T19:31:00Z',
  }
}

describe('Mapa de calor', () => {
  it('mostra os últimos 30 dias por padrão e troca o período', async () => {
    const pessoa = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') },
      'GET /mapa/calor': {
        corpo: [
          [-22.505, -43.179, 2],
          [-22.51, -43.18, 1],
        ],
      },
    })
    renderizarApp('/mapa-de-calor')

    expect(
      await screen.findByRole('heading', { level: 1, name: /Mapa de calor das pessoas em/ }),
    ).toBeInTheDocument()
    expect(await screen.findByText('3 avistamentos em 2 locais.')).toBeInTheDocument()
    expect(screen.getByText('Mais avistamentos')).toBeInTheDocument()

    const consultas = () =>
      chamadas.filter((c) => c.chave === 'GET /mapa/calor').map((c) => c.url.searchParams)
    const primeira = consultas()[0]
    const diasAtras = (Date.now() - new Date(primeira.get('de')!).getTime()) / DIA
    expect(diasAtras).toBeGreaterThan(29)
    expect(diasAtras).toBeLessThanOrEqual(30)
    expect(primeira.get('ate')).toBeNull()
    expect(primeira.get('pessoa_id')).toBeNull()

    await pessoa.selectOptions(screen.getByLabelText('Período'), '7')
    await waitFor(() => {
      const dias = (Date.now() - new Date(consultas().at(-1)!.get('de')!).getTime()) / DIA
      expect(dias).toBeLessThanOrEqual(7)
    })

    await pessoa.selectOptions(screen.getByLabelText('Período'), 'personalizado')
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-09-20' } })
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-09-10' } })
    expect(
      await screen.findByText('A data final não pode ser antes da inicial.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Corrija o período para ver o mapa de calor.')).toBeInTheDocument()
    const antes = consultas().length

    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-09-30' } })
    await waitFor(() => expect(consultas().length).toBe(antes + 1))
    const ultima = consultas().at(-1)!
    expect(new Date(ultima.get('de')!).getTime()).toBe(new Date(2026, 8, 20).getTime())
    expect(new Date(ultima.get('ate')!).getTime()).toBe(
      new Date(2026, 8, 30, 23, 59, 59, 999).getTime(),
    )
  })

  it('filtra por pessoa pelo autocomplete e volta a mostrar todas', async () => {
    const pessoa = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('COLABORADOR') },
      'GET /mapa/calor': (_, url) => ({
        corpo: url.searchParams.get('pessoa_id') ? [[-22.51, -43.18, 4]] : [],
      }),
      'GET /pessoas/sugestoes': {
        corpo: [
          {
            id: 'p2',
            nome: 'Márcia',
            sobrenome: 'Souza',
            apelido: 'Marcinha',
            status: 'ATIVA',
            url_miniatura: null,
          },
        ],
      },
    })
    renderizarApp('/mapa-de-calor')

    expect(await screen.findByText('Nenhum avistamento no período.')).toBeInTheDocument()
    await pessoa.type(screen.getByRole('combobox', { name: /Pessoa \(opcional/ }), 'marc')
    await pessoa.click(await screen.findByRole('option', { name: /Márcia Souza/ }))

    expect(
      await screen.findByText('4 avistamentos em 1 local de Márcia Souza.'),
    ).toBeInTheDocument()
    expect(
      chamadas
        .filter((c) => c.chave === 'GET /mapa/calor')
        .at(-1)!
        .url.searchParams.get('pessoa_id'),
    ).toBe('p2')

    await pessoa.click(screen.getByRole('button', { name: /Mostrar todas as pessoas/ }))
    expect(await screen.findByText('Nenhum avistamento no período.')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Pessoa \(opcional/ })).toBeInTheDocument()
  })

  it('aparece no menu para todos os perfis', async () => {
    mockarApi({ 'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') } })
    renderizarApp('/')
    const navegacao = await screen.findByRole('navigation', { name: /principal/i })
    expect(within(navegacao).getByRole('link', { name: 'Mapa de calor' })).toHaveAttribute(
      'href',
      '/mapa-de-calor',
    )
  })
})

describe('Perfil da pessoa: histórico e mapa de calor individual', () => {
  it('lista os avistamentos com quem registrou, paginados de 5 em 5', async () => {
    const pessoa = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') },
      [`GET /pessoas/${ID}`]: { corpo: pessoaTeste() },
      [`GET /pessoas/${ID}/avistamentos`]: (_, url) => {
        const pagina = Number(url.searchParams.get('pagina'))
        const itens = pagina === 1 ? [1, 2, 3, 4, 5].map(avistamento) : [avistamento(6)]
        return { corpo: { itens, total: 6, pagina, tamanho: 5 } }
      },
      'GET /mapa/calor': { corpo: [[-22.505, -43.179, 6]] },
    })
    renderizarApp(`/pessoas/${ID}`)

    const historico = within(
      await screen.findByRole('region', { name: 'Histórico de avistamentos' }),
    )
    const itens = await historico.findAllByRole('listitem')
    expect(itens).toHaveLength(5)
    expect(within(itens[0]).getByText('09/10/2026 às 16:30')).toBeInTheDocument()
    expect(within(itens[0]).getByText(/Praça da Liberdade/)).toBeInTheDocument()
    expect(
      within(itens[0]).getByText('Registrado por Ana Souza (Pessoa colaboradora)'),
    ).toBeInTheDocument()
    expect(within(itens[0]).getByText('Perto do ponto de ônibus')).toBeInTheDocument()
    expect(within(itens[1]).getByText('Coordenadas: -22.50500, -43.17900')).toBeInTheDocument()
    expect(
      within(itens[1]).getByText('Registrado por Adm (Pessoa administradora)'),
    ).toBeInTheDocument()

    await pessoa.click(historico.getByRole('button', { name: 'Próxima página' }))
    await waitFor(() => expect(historico.getAllByRole('listitem')).toHaveLength(1))
    expect(historico.getByText('Página 2 de 2')).toBeInTheDocument()

    const calor = within(screen.getByRole('region', { name: 'Mapa de calor' }))
    expect(
      await calor.findByRole('region', {
        name: 'Mapa de calor dos avistamentos de João da Conceição',
      }),
    ).toBeInTheDocument()
    expect(
      chamadas.find((c) => c.chave === 'GET /mapa/calor')!.url.searchParams.get('pessoa_id'),
    ).toBe(ID)
  })

  it('sem avistamentos, mostra estados vazios', async () => {
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') },
      [`GET /pessoas/${ID}`]: {
        corpo: pessoaTeste({
          ultima_vez_visto: null,
          ultima_latitude: null,
          ultima_longitude: null,
          ultimo_endereco: null,
        }),
      },
      [`GET /pessoas/${ID}/avistamentos`]: {
        corpo: { itens: [], total: 0, pagina: 1, tamanho: 5 },
      },
      'GET /mapa/calor': { corpo: [] },
    })
    renderizarApp(`/pessoas/${ID}`)

    expect(await screen.findByText('Nenhum avistamento registrado ainda.')).toBeInTheDocument()
    expect(
      await screen.findByText('Sem avistamentos para mostrar no mapa de calor.'),
    ).toBeInTheDocument()
  })
})
