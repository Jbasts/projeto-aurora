import { screen } from '@testing-library/react'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'

import type { Perfil } from '../features/usuarios/perfis'
import {
  mockarApi,
  renderizarApp,
  SEM_SESSAO,
  sessaoTeste,
  type RespostaFalsa,
} from '../test/utilitarios'

/**
 * Revisão automática de acessibilidade (seção 6, meta WCAG 2.1 AA) com o axe-core.
 * Contraste de cor não é verificável no jsdom (sem layout): ele é garantido pelos tokens.
 */
async function violacoes(): Promise<string[]> {
  const resultado = await axe.run(document.body, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  return resultado.violations.map(
    (v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  )
}

const ID = '11111111-1111-1111-1111-111111111111'

const pessoa = {
  id: ID,
  nome: 'João',
  sobrenome: 'da Conceição',
  apelido: 'Joca',
  idade_aproximada: 45,
  email: null,
  telefone: '(24) 99999-8888',
  nome_contato: null,
  telefone_contato: null,
  observacoes: 'Prefere ser chamado pelo apelido.',
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
}

const registrador = { id: 'u1', nome: 'Colab Teste', perfil: 'COLABORADOR' }

const API: Record<string, RespostaFalsa> = {
  'GET /usuarios': {
    corpo: {
      itens: [
        {
          id: 'u1',
          nome: 'Colab Teste',
          email: 'colab@exemplo.com',
          telefone: null,
          perfil: 'COLABORADOR',
          status: 'PENDENTE',
          criado_em: '2026-10-01T12:00:00Z',
        },
      ],
      total: 1,
      pagina: 1,
      tamanho: 5,
    },
  },
  'GET /pessoas': {
    corpo: {
      itens: [
        {
          id: ID,
          nome: 'João',
          sobrenome: 'da Conceição',
          apelido: 'Joca',
          status: 'ATIVA',
          url_miniatura: null,
          ultima_vez_visto: '2026-10-05T19:30:00Z',
          ultimo_endereco: 'Rua do Imperador, 288 – Centro, Petrópolis',
          ultima_latitude: -22.505,
          ultima_longitude: -43.179,
          cadastrada_por: { id: 'u1', nome: 'Colab Teste' },
        },
      ],
      total: 1,
      pagina: 1,
      tamanho: 5,
    },
  },
  [`GET /pessoas/${ID}`]: { corpo: pessoa },
  [`GET /pessoas/${ID}/avistamentos`]: {
    corpo: {
      itens: [
        {
          id: 'a1',
          latitude: -22.505,
          longitude: -43.179,
          endereco: 'Rua do Imperador, 288 – Centro, Petrópolis',
          visto_em: '2026-10-05T19:30:00Z',
          observacao: null,
          registrado_por: registrador,
          criado_em: '2026-10-05T19:31:00Z',
        },
      ],
      total: 1,
      pagina: 1,
      tamanho: 5,
    },
  },
  'GET /mapa/marcadores': {
    corpo: [
      {
        id: ID,
        nome: 'João',
        sobrenome: 'da Conceição',
        apelido: 'Joca',
        idade_aproximada: 45,
        url_miniatura: null,
        latitude: -22.505,
        longitude: -43.179,
        ultimo_endereco: 'Rua do Imperador, 288 – Centro, Petrópolis',
        ultima_vez_visto: '2026-10-05T19:30:00Z',
        registrado_por: registrador,
      },
    ],
  },
  'GET /mapa/calor': { corpo: [[-22.505, -43.179, 3]] },
  'GET /auditoria': {
    corpo: {
      itens: [
        {
          id: 1,
          criado_em: '2026-10-06T13:00:00Z',
          usuario: { ...registrador, email: 'colab@exemplo.com' },
          acao: 'PESSOA_VISUALIZADA',
          entidade: 'pessoa',
          entidade_id: ID,
          usuario_afetado: null,
          detalhes: null,
          ip: '10.0.0.1',
        },
      ],
      total: 1,
      pagina: 1,
      tamanho: 5,
    },
  },
  'GET /pessoas/sugestoes': { corpo: [] },
}

const TELAS: { rota: string; perfil: Perfil | null; espera: RegExp }[] = [
  { rota: '/login', perfil: null, espera: /Entrar/ },
  { rota: '/cadastro', perfil: null, espera: /Cadastrar/ },
  { rota: '/recuperar-senha', perfil: null, espera: /Recuperar senha/ },
  { rota: '/privacidade', perfil: null, espera: /Privacidade/ },
  { rota: '/rota-que-nao-existe', perfil: null, espera: /Página não encontrada/ },
  { rota: '/', perfil: 'ADMIN', espera: /Plataforma Projeto Aurora|projeto/i },
  { rota: '/meu-perfil', perfil: 'COLABORADOR', espera: /perfil/i },
  { rota: '/pessoas', perfil: 'ADMIN', espera: /Busca de dados/ },
  { rota: '/pessoas/nova', perfil: 'COLABORADOR', espera: /Cadastro de pessoas/ },
  { rota: `/pessoas/${ID}`, perfil: 'ADMIN', espera: /João da Conceição/ },
  { rota: `/pessoas/${ID}/editar`, perfil: 'ADMIN', espera: /Editar|João/ },
  { rota: '/mapa', perfil: 'COLABORADOR', espera: /Visualizar mapeamento/ },
  { rota: '/mapa-de-calor', perfil: 'PADRAO', espera: /Mapa de calor das pessoas/ },
  { rota: '/usuarios', perfil: 'ADMIN', espera: /usuários/i },
  { rota: '/auditoria', perfil: 'ADMIN', espera: /Logs de/ },
]

describe('Acessibilidade (axe-core)', () => {
  it.each(TELAS)('$rota sem violações', async ({ rota, perfil, espera }) => {
    mockarApi({
      'POST /auth/refresh': perfil ? { corpo: sessaoTeste(perfil) } : SEM_SESSAO,
      ...API,
    })
    renderizarApp(rota)
    await screen.findByRole('heading', { level: 1, name: espera })
    // Espera os dados das consultas aparecerem (listas, tabelas, mapas).
    await new Promise((resolver) => setTimeout(resolver, 300))
    expect(await violacoes()).toEqual([])
  })
})
