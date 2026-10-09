import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LogAuditoria } from '../features/auditoria/api'
import { dividirEmTrechos } from '../hooks/useOuvirPagina'
import { mockarApi, renderizarApp, SEM_SESSAO, sessaoTeste } from '../test/utilitarios'

const usuariosLista = {
  corpo: {
    itens: [
      {
        id: 'u1',
        nome: 'Colab Teste',
        email: 'colab@exemplo.com',
        telefone: null,
        perfil: 'COLABORADOR',
        status: 'ATIVO',
        criado_em: '2026-10-01T12:00:00Z',
      },
    ],
    total: 1,
    pagina: 1,
    tamanho: 100,
  },
}

function log(dados: Partial<LogAuditoria>): LogAuditoria {
  return {
    id: 1,
    criado_em: '2026-10-06T13:00:00Z',
    usuario: { id: 'u1', nome: 'Colab Teste', email: 'colab@exemplo.com', perfil: 'COLABORADOR' },
    acao: 'PESSOA_VISUALIZADA',
    entidade: 'pessoa',
    entidade_id: 'p1',
    usuario_afetado: null,
    detalhes: null,
    ip: '10.0.0.1',
    ...dados,
  }
}

describe('Logs de auditoria', () => {
  it('lista os registros em texto legível e filtra por usuário, ação e período', async () => {
    const pessoa = userEvent.setup()
    const { chamadas } = mockarApi({
      'POST /auth/refresh': { corpo: sessaoTeste('ADMIN') },
      'GET /usuarios': usuariosLista,
      'GET /auditoria': {
        corpo: {
          itens: [
            log({ id: 3 }),
            log({
              id: 2,
              acao: 'USUARIO_PERFIL_ALTERADO',
              entidade: 'usuario',
              entidade_id: 'u9',
              usuario_afetado: {
                id: 'u9',
                nome: 'Bia Nova',
                email: 'bia@exemplo.com',
                perfil: 'COLABORADOR',
              },
              detalhes: { de: 'PADRAO', para: 'COLABORADOR' },
            }),
            log({
              id: 1,
              acao: 'LOGIN_FALHA',
              usuario: null,
              entidade: null,
              entidade_id: null,
              detalhes: { motivo: 'EMAIL_DESCONHECIDO' },
            }),
          ],
          total: 3,
          pagina: 1,
          tamanho: 5,
        },
      },
    })
    renderizarApp('/auditoria')

    const tabela = within(await screen.findByRole('table'))
    expect(tabela.getByText('Perfil de pessoa visualizado')).toBeInTheDocument()
    expect(tabela.getAllByRole('link', { name: 'Ver pessoa' })[0]).toHaveAttribute(
      'href',
      '/pessoas/p1',
    )
    expect(tabela.getByText('Perfil de acesso alterado')).toBeInTheDocument()
    expect(tabela.getByText(/Usuário: Bia Nova/)).toBeInTheDocument()
    expect(tabela.getByText('De Pessoa usuária para Pessoa colaboradora')).toBeInTheDocument()
    expect(tabela.getByText('Motivo: email ou CPF não cadastrado')).toBeInTheDocument()
    expect(tabela.getByText('Não identificado')).toBeInTheDocument()
    expect(screen.getByText(/Total de registros:/)).toHaveTextContent('3')

    const ultimaConsulta = () =>
      chamadas.filter((c) => c.chave === 'GET /auditoria').at(-1)!.url.searchParams
    expect(ultimaConsulta().get('tamanho')).toBe('5')

    await pessoa.selectOptions(await screen.findByLabelText('Usuário'), 'u1')
    await pessoa.selectOptions(screen.getByLabelText('Ação'), 'LOGIN_FALHA')
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-10-01' } })
    await waitFor(() => {
      const params = ultimaConsulta()
      expect(params.get('usuario_id')).toBe('u1')
      expect(params.get('acao')).toBe('LOGIN_FALHA')
      expect(new Date(params.get('de')!).getTime()).toBe(new Date(2026, 9, 1).getTime())
    })

    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-09-01' } })
    expect(
      await screen.findByText('A data final não pode ser antes da inicial.'),
    ).toBeInTheDocument()

    await pessoa.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() => {
      const params = ultimaConsulta()
      expect(params.get('usuario_id')).toBeNull()
      expect(params.get('acao')).toBeNull()
      expect(params.get('de')).toBeNull()
    })
  })

  it('aparece no menu só para administradora e bloqueia as demais', async () => {
    mockarApi({ 'POST /auth/refresh': { corpo: sessaoTeste('COLABORADOR') } })
    const { router } = renderizarApp('/auditoria')
    expect(await screen.findByRole('heading', { name: 'Acesso negado' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/acesso-negado')
  })
})

describe('Privacidade', () => {
  it('abre sem login, com o link no rodapé igual ao protótipo', async () => {
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    renderizarApp('/privacidade')
    expect(
      await screen.findByRole('heading', { level: 1, name: /Privacidade e proteção de dados/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dados das pessoas em situação de rua' }))
    const rodape = within(screen.getByRole('contentinfo'))
    expect(rodape.getByText(/R\. Afrânio de Melo Franco, 333/)).toBeInTheDocument()
    expect(rodape.getByRole('link', { name: 'Instagram do Projeto Aurora' })).toBeInTheDocument()
    expect(rodape.getByRole('link', { name: 'Privacidade' })).toHaveAttribute(
      'href',
      '/privacidade',
    )
    expect(rodape.queryByText(/Baixe o app/i)).not.toBeInTheDocument()
    expect(document.title).toBe('Privacidade | Projeto Aurora')
  })
})

describe('Barra de acessibilidade', () => {
  afterEach(() => {
    document.querySelectorAll('script[src*="vlibras"]').forEach((s) => s.remove())
    Reflect.deleteProperty(window, 'VLibras')
    Reflect.deleteProperty(window, 'VLibrasWidget')
  })

  it('divide o texto em trechos curtos, quebrando em fim de frase', () => {
    const frase = 'Uma frase de teste com algumas palavras. '
    const trechos = dividirEmTrechos(frase.repeat(12))
    expect(trechos.length).toBeGreaterThan(1)
    for (const trecho of trechos) {
      expect(trecho.length).toBeLessThanOrEqual(200)
      expect(trecho.endsWith('.')).toBe(true)
    }
  })

  it('"Ouvir página" lê o conteúdo principal em pt-BR e o mesmo botão para a leitura', async () => {
    const pessoa = userEvent.setup()
    const faladas: { text: string; lang: string }[] = []
    const sintese = {
      speak: vi.fn((fala: { text: string; lang: string }) => faladas.push(fala)),
      cancel: vi.fn(),
      getVoices: () => [],
    }
    vi.stubGlobal('speechSynthesis', sintese)
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        lang = ''
        voice = null
        onend: (() => void) | null = null
        onerror: (() => void) | null = null
        text: string
        constructor(text: string) {
          this.text = text
        }
      },
    )
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    renderizarApp('/privacidade')
    await screen.findByRole('heading', { level: 1, name: /Privacidade/ })
    // jsdom não calcula innerText: usa o texto do <main>.
    const main = document.getElementById('conteudo')!
    Object.defineProperty(main, 'innerText', { get: () => main.textContent, configurable: true })

    await pessoa.click(screen.getByRole('button', { name: 'Ouvir página' }))
    expect(sintese.speak).toHaveBeenCalled()
    expect(faladas[0].lang).toBe('pt-BR')
    expect(faladas.map((f) => f.text).join(' ')).toContain('Projeto Aurora')
    const parar = screen.getByRole('button', { name: 'Parar leitura da página' })
    expect(parar).toHaveAttribute('aria-pressed', 'true')

    await pessoa.click(parar)
    expect(sintese.cancel).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Ouvir página' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('Libras carrega o VLibras só ao clicar e abre o tradutor', async () => {
    const pessoa = userEvent.setup()
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    renderizarApp('/privacidade')
    await screen.findByRole('heading', { level: 1, name: /Privacidade/ })
    expect(document.querySelector('script[src*="vlibras"]')).toBeNull()

    const abrir = vi.fn()
    await pessoa.click(screen.getByRole('button', { name: 'Traduzir para Libras (VLibras)' }))
    const script = document.querySelector<HTMLScriptElement>('script[src*="vlibras"]')!
    expect(script.src).toBe('https://vlibras.gov.br/app/vlibras-plugin.js')

    // Simula o script oficial: o construtor do Widget cria VLibrasWidget.open.
    Object.assign(window, {
      VLibras: {
        Widget: class {
          constructor() {
            Object.assign(window, { VLibrasWidget: { open: abrir } })
          }
        },
      },
    })
    act(() => script.onload?.(new Event('load')))
    await waitFor(() => expect(abrir).toHaveBeenCalled())
  })

  it('Libras avisa quando o VLibras não carrega', async () => {
    const pessoa = userEvent.setup()
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    renderizarApp('/privacidade')
    await pessoa.click(
      await screen.findByRole('button', { name: 'Traduzir para Libras (VLibras)' }),
    )
    const script = document.querySelector<HTMLScriptElement>('script[src*="vlibras"]')!
    act(() => script.onerror?.(new Event('error')))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível abrir o VLibras')
  })

  it('"Instalar app" só aparece quando o navegador oferece a instalação', async () => {
    const pessoa = userEvent.setup()
    mockarApi({ 'POST /auth/refresh': SEM_SESSAO })
    renderizarApp('/privacidade')
    await screen.findByRole('heading', { level: 1, name: /Privacidade/ })
    expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument()

    const prompt = vi.fn(async () => {})
    const evento = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    act(() => {
      window.dispatchEvent(evento)
    })
    expect(evento.defaultPrevented).toBe(true)

    // Aparece na barra superior e no rodapé; instalar por um esconde os dois.
    const botoes = await screen.findAllByRole('button', { name: 'Instalar app' })
    expect(botoes).toHaveLength(2)
    expect(screen.getByRole('contentinfo')).toContainElement(botoes[1])

    await pessoa.click(botoes[1])
    expect(prompt).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument(),
    )
  })
})
