import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Marcador } from '../features/mapa/api'
import { mockarApi, renderizarApp, sessaoTeste } from '../test/utilitarios'

function marcador(dados: Partial<Marcador> = {}): Marcador {
  return {
    id: 'p1',
    nome: 'José',
    sobrenome: 'Luís',
    apelido: 'Zé',
    idade_aproximada: 62,
    url_miniatura: null,
    latitude: -22.505,
    longitude: -43.179,
    ultimo_endereco: 'Rua do Imperador, 288 – Centro, Petrópolis',
    ultima_vez_visto: '2026-10-05T19:30:00Z',
    ...dados,
  }
}

const usuariosVazio = { corpo: { itens: [], total: 0, pagina: 1, tamanho: 1 } }

/** O ícone do Leaflet recebe o nome no atributo title (e é focável por teclado). */
const iconeDoMarcador = async (titulo: string) =>
  waitFor(() => {
    const icone = [...document.querySelectorAll<HTMLElement>('.leaflet-marker-icon')].find(
      (el) => el.getAttribute('title') === titulo,
    )
    if (!icone) throw new Error(`Marcador "${titulo}" ainda não apareceu`)
    return icone
  })

describe('Mapa', () => {
  // jsdom não tem layout: sem tamanho, o Leaflet acha que nada está visível e o
  // agrupamento não desenha os marcadores.
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 800,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 600,
    })
  })
  afterAll(() => {
    // Remove a sobrescrita: volta a valer a definição original, de Element.prototype.
    Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
    Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight')
  })

  it('mostra o painel da pessoa ao clicar no marcador, com dados em texto', async () => {
    const pessoa = userEvent.setup()
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') },
      'GET /mapa/marcadores': { corpo: [marcador()] },
    })
    renderizarApp('/mapa')

    expect(
      await screen.findByRole('heading', { level: 1, name: /Visualizar mapeamento/ }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/1 pessoa com última localização registrada/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Registrar avistamento/ })).not.toBeInTheDocument()

    await pessoa.click(await iconeDoMarcador('José Luís ("Zé")'))

    const painel = screen.getByRole('complementary', { name: 'José Luís' })
    expect(within(painel).getByText('62 anos')).toBeInTheDocument()
    expect(within(painel).getByText('Zé')).toBeInTheDocument()
    expect(within(painel).getByText(/Rua do Imperador, 288/)).toBeInTheDocument()
    expect(within(painel).getByText('05/10/2026 às 16:30')).toBeInTheDocument()
    expect(within(painel).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(painel).getByRole('link', { name: 'Ver perfil completo' })).toHaveAttribute(
      'href',
      '/pessoas/p1',
    )

    await pessoa.click(within(painel).getByRole('button', { name: 'Voltar' }))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('"Ver como lista" mostra a mesma informação em tabela', async () => {
    const pessoa = userEvent.setup()
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') },
      'GET /mapa/marcadores': { corpo: [marcador()] },
    })
    renderizarApp('/mapa')

    await pessoa.click(await screen.findByRole('button', { name: 'Ver como lista' }))
    const tabela = within(screen.getByRole('table'))
    expect(tabela.getByText('José Luís')).toBeInTheDocument()
    expect(tabela.getByText(/Rua do Imperador/)).toBeInTheDocument()
    expect(tabela.getByRole('link', { name: 'Ver perfil de José Luís' })).toBeInTheDocument()

    await pessoa.click(tabela.getByRole('button', { name: 'Mostrar José Luís no mapa' }))
    expect(await screen.findByRole('complementary', { name: 'José Luís' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver como lista' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('gestor registra avistamento escolhendo a pessoa pelo autocomplete', async () => {
    const pessoa = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('COLABORADOR') },
      'GET /mapa/marcadores': { corpo: [] },
      'GET /pessoas/sugestoes': {
        corpo: [
          {
            id: 'p9',
            nome: 'Maria',
            sobrenome: 'Inativa',
            apelido: null,
            status: 'INATIVA',
            url_miniatura: null,
          },
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
      'GET /geocodificacao/reversa': {
        corpo: { endereco: 'Praça da Liberdade – Centro, Petrópolis' },
      },
      'POST /avistamentos': (corpo) => ({
        status: 201,
        corpo: {
          ...(corpo as object),
          id: 'a1',
          endereco: null,
          registrado_por: null,
          criado_em: '',
          mais_recente: true,
        },
      }),
    })
    renderizarApp('/mapa')

    await pessoa.click(
      await screen.findByRole('button', { name: 'Registrar avistamento no centro do mapa' }),
    )
    const modal = within(screen.getByRole('dialog', { name: 'Registrar avistamento' }))
    expect(await modal.findByText(/Praça da Liberdade – Centro, Petrópolis/)).toBeInTheDocument()

    const busca = modal.getByRole('combobox', { name: /Quem foi vista/ })
    await pessoa.type(busca, 'marc')
    const opcoes = await modal.findAllByRole('option')
    expect(opcoes.map((o) => o.textContent)).toEqual(['MSMárcia Souza"Marcinha"'])
    await pessoa.keyboard('{ArrowDown}{Enter}')
    expect(modal.getByText('Márcia Souza')).toBeInTheDocument()

    await pessoa.type(modal.getByLabelText('Observação (opcional)'), 'Perto da praça')
    await pessoa.click(modal.getByRole('button', { name: 'Salvar avistamento' }))

    expect(await screen.findByText('Avistamento de Márcia Souza registrado.')).toBeInTheDocument()
    const corpo = chamadas.find((c) => c.chave === 'POST /avistamentos')?.corpo as Record<
      string,
      unknown
    >
    expect(corpo).toMatchObject({
      pessoa_id: 'p2',
      latitude: -22.505,
      longitude: -43.179,
      observacao: 'Perto da praça',
    })
    expect(Date.now() - new Date(corpo.visto_em as string).getTime()).toBeLessThan(120_000)
  })

  it('sem resultado, oferece "Cadastrar nova pessoa" levando o local', async () => {
    const pessoa = userEvent.setup()
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': usuariosVazio,
      'GET /mapa/marcadores': { corpo: [] },
      'GET /pessoas/sugestoes': { corpo: [] },
      'GET /geocodificacao/reversa': { corpo: { endereco: null } },
    })
    const { router } = renderizarApp('/mapa')

    await pessoa.click(
      await screen.findByRole('button', { name: 'Registrar avistamento no centro do mapa' }),
    )
    const modal = within(screen.getByRole('dialog'))
    expect(await modal.findByText(/endereço indisponível/)).toBeInTheDocument()
    await pessoa.type(modal.getByRole('combobox'), 'Fulano')
    await pessoa.click(await modal.findByRole('button', { name: 'Cadastrar nova pessoa' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/pessoas/nova'))
    expect(router.state.location.state).toEqual({
      local: { latitude: -22.505, longitude: -43.179 },
    })
  })

  it('perfil de pessoa ativa oferece "Registrar avistamento" para gestores', async () => {
    const pessoa = userEvent.setup()
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('COLABORADOR') },
      'GET /pessoas/p1': {
        corpo: {
          ...marcador(),
          email: null,
          telefone: null,
          nome_contato: null,
          telefone_contato: null,
          observacoes: null,
          consentimento: false,
          consentimento_em: null,
          status: 'ATIVA',
          motivo_inativacao: null,
          inativada_em: null,
          inativada_por: null,
          cadastrada_por: null,
          foto_perfil: null,
          album: [],
          ultima_vez_visto: null,
          ultima_latitude: null,
          ultima_longitude: null,
          criado_em: '2026-10-01T12:00:00Z',
          atualizado_em: '2026-10-01T12:00:00Z',
        },
      },
    })
    renderizarApp('/pessoas/p1')
    await pessoa.click(await screen.findByRole('button', { name: 'Registrar avistamento' }))
    const modal = within(screen.getByRole('dialog', { name: 'Registrar avistamento de José Luís' }))
    expect(modal.queryByRole('combobox')).not.toBeInTheDocument()
    expect(await modal.findByRole('button', { name: 'Usar minha localização' })).toBeInTheDocument()
  })
})
