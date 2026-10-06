import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { PessoaResumo } from '../features/pessoas/tipos'
import { mockarApi, renderizarApp, sessaoTeste, type ChamadaApi } from '../test/utilitarios'

function resumo(dados: Partial<PessoaResumo> = {}): PessoaResumo {
  return {
    id: 'p1',
    nome: 'João',
    sobrenome: 'da Conceição',
    apelido: 'Joca',
    status: 'ATIVA',
    url_miniatura: null,
    ultima_vez_visto: '2026-10-05T17:30:00Z',
    ultimo_endereco: null,
    ultima_latitude: -22.505,
    ultima_longitude: -43.179,
    cadastrada_por: { id: 'u1', nome: 'Colab Teste' },
    ...dados,
  }
}

const pagina = (itens: PessoaResumo[], total = itens.length) => ({
  corpo: { itens, total, pagina: 1, tamanho: 5 },
})

/** Parâmetros da última busca de pessoas feita pela tela. */
const ultimaBusca = (chamadas: ChamadaApi[]) =>
  chamadas.filter((c) => c.chave === 'GET /pessoas').at(-1)!.url.searchParams

const tabela = async () => within(await screen.findByRole('table'))

describe('Buscar pessoas', () => {
  it('pessoa usuária vê a lista sem filtro de status nem ações de gestão', async () => {
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') },
      'GET /pessoas': pagina([resumo()]),
    })
    renderizarApp('/pessoas')

    const linhas = await tabela()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Busca de dados de pessoas em situação de rua/,
      }),
    ).toBeInTheDocument()
    expect(linhas.getByText('João da Conceição')).toBeInTheDocument()
    expect(linhas.getByText('"Joca"')).toBeInTheDocument()
    expect(linhas.getByText('05/10/2026 às 14:30')).toBeInTheDocument()
    expect(linhas.getByText('-22.50500, -43.17900')).toBeInTheDocument()
    expect(linhas.getByText('Colab Teste')).toBeInTheDocument()
    expect(linhas.getByRole('link', { name: 'Ver João da Conceição' })).toHaveAttribute(
      'href',
      '/pessoas/p1',
    )
    expect(linhas.queryByRole('link', { name: /Editar/ })).not.toBeInTheDocument()
    expect(linhas.queryByRole('button', { name: /Inativar/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
    expect(screen.getByText('Total de registros:')).toBeInTheDocument()

    const parametros = ultimaBusca(chamadas)
    expect(parametros.has('status')).toBe(false)
    expect(parametros.get('tamanho')).toBe('5')
    expect(parametros.get('ordem')).toBe('nome')
  })

  it('gestor começa com as ativas e pode filtrar, ordenar e buscar', async () => {
    const pessoa = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('COLABORADOR') },
      'GET /pessoas': pagina([resumo()]),
    })
    renderizarApp('/pessoas')

    await tabela()
    expect(ultimaBusca(chamadas).get('status')).toBe('ATIVA')

    await pessoa.selectOptions(screen.getByLabelText('Status'), 'Inativas')
    await waitFor(() => expect(ultimaBusca(chamadas).get('status')).toBe('INATIVA'))

    await pessoa.selectOptions(screen.getByLabelText('Status'), 'Todas')
    await waitFor(() => expect(ultimaBusca(chamadas).has('status')).toBe(false))

    await pessoa.selectOptions(screen.getByLabelText('Visto nos últimos'), 'Últimos 7 dias')
    await waitFor(() => expect(ultimaBusca(chamadas).has('visto_desde')).toBe(true))
    const desde = new Date(ultimaBusca(chamadas).get('visto_desde')!).getTime()
    const seteDias = 7 * 24 * 60 * 60 * 1000
    expect(Math.abs(Date.now() - seteDias - desde)).toBeLessThan(60_000)

    await pessoa.selectOptions(screen.getByLabelText('Ordenar por'), 'visto')
    await waitFor(() => expect(ultimaBusca(chamadas).get('ordem')).toBe('visto'))
    expect(screen.getByRole('columnheader', { name: /Visto por último/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    )

    await pessoa.type(
      screen.getByLabelText('Pesquisar por nome, sobrenome ou apelido'),
      'conceicao',
    )
    await waitFor(() => expect(ultimaBusca(chamadas).get('busca')).toBe('conceicao'))
    expect(ultimaBusca(chamadas).get('pagina')).toBe('1')
  })

  it('mostra o estado vazio', async () => {
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') },
      'GET /pessoas': pagina([]),
    })
    renderizarApp('/pessoas')
    expect(await screen.findByText('Nenhuma pessoa encontrada.')).toBeInTheDocument()
  })

  it('mostra o erro com opção de tentar de novo', async () => {
    mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('PADRAO') },
      'GET /pessoas': { status: 500, corpo: { detail: 'Falha no servidor.', codigo: 'ERRO' } },
    })
    renderizarApp('/pessoas')
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('inativa e reativa pela própria lista', async () => {
    const pessoa = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': { corpo: { itens: [], total: 0, pagina: 1, tamanho: 1 } },
      'GET /pessoas': pagina([
        resumo(),
        resumo({ id: 'p2', nome: 'Carla', sobrenome: 'Mendes', apelido: null, status: 'INATIVA' }),
      ]),
      'POST /pessoas/p1/inativar': { corpo: {} },
      'POST /pessoas/p2/reativar': { corpo: {} },
    })
    renderizarApp('/pessoas')

    const linhas = await tabela()
    await pessoa.click(linhas.getByRole('button', { name: 'Inativar João da Conceição' }))
    const modal = screen.getByRole('dialog', { name: 'Inativar João da Conceição' })
    await pessoa.click(within(modal).getByRole('button', { name: 'Inativar' }))
    expect(await screen.findByText('João da Conceição foi inativada.')).toBeInTheDocument()

    await pessoa.click(linhas.getByRole('button', { name: 'Reativar Carla Mendes' }))
    expect(await screen.findByText('Carla Mendes foi reativada.')).toBeInTheDocument()

    const chaves = chamadas.map((c) => c.chave)
    expect(chaves).toContain('POST /pessoas/p1/inativar')
    expect(chaves).toContain('POST /pessoas/p2/reativar')
    // A lista é recarregada depois de cada ação.
    expect(chaves.filter((c) => c === 'GET /pessoas').length).toBeGreaterThanOrEqual(3)
  })
})
