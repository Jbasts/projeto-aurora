import { useState } from 'react'
import { Link } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { Avatar } from '../components/Avatar'
import { Botao } from '../components/Botao'
import { CampoSelecao } from '../components/formulario/CampoSelecao'
import { estiloCampo } from '../components/formulario/CampoTexto'
import { Ondas } from '../components/Ondas'
import { Paginacao, TAMANHO_PAGINA_PADRAO } from '../components/Paginacao'
import { TituloPagina } from '../components/TituloPagina'
import { useUsuarioLogado } from '../contexts/autenticacao'
import { formatarDataHora } from '../features/comum/datas'
import { usePessoas, useReativarPessoa } from '../features/pessoas/api'
import { ModalInativar } from '../features/pessoas/ModalInativar'
import { altFoto, iniciais, nomeCompleto } from '../features/pessoas/nomes'
import type { FiltrosPessoas, PessoaResumo, StatusPessoa } from '../features/pessoas/tipos'
import { useTituloDocumento } from '../hooks/useTituloDocumento'
import { useValorAtrasado } from '../hooks/useValorAtrasado'

const OPCOES_VISTO = [
  { valor: '', rotulo: 'Qualquer data' },
  { valor: '7', rotulo: 'Últimos 7 dias' },
  { valor: '30', rotulo: 'Últimos 30 dias' },
  { valor: '90', rotulo: 'Últimos 90 dias' },
]
const OPCOES_STATUS = [
  { valor: 'ATIVA', rotulo: 'Ativas' },
  { valor: 'INATIVA', rotulo: 'Inativas' },
  { valor: '', rotulo: 'Todas' },
]
const OPCOES_ORDEM = [
  { valor: 'nome', rotulo: 'Nome (A–Z)' },
  { valor: 'visto', rotulo: 'Visto por último (mais recente)' },
]

type Aviso = { tipo: 'sucesso' | 'erro'; texto: string } | null

function localizacao(pessoa: PessoaResumo): string | null {
  if (pessoa.ultimo_endereco) return pessoa.ultimo_endereco
  if (pessoa.ultima_latitude == null || pessoa.ultima_longitude == null) return null
  return `${pessoa.ultima_latitude.toFixed(5)}, ${pessoa.ultima_longitude.toFixed(5)}`
}

export function PaginaBuscarPessoas() {
  useTituloDocumento('Buscar pessoas')
  const usuario = useUsuarioLogado()
  const gestor = usuario.perfil === 'ADMIN' || usuario.perfil === 'COLABORADOR'

  const [busca, setBusca] = useState('')
  const [filtros, setFiltros] = useState<Omit<FiltrosPessoas, 'busca'>>({
    status: 'ATIVA',
    vistoNosUltimosDias: null,
    ordem: 'nome',
    pagina: 1,
    tamanho: TAMANHO_PAGINA_PADRAO,
  })
  const buscaAtrasada = useValorAtrasado(busca)
  // Pessoa usuária não filtra por status: o backend já devolve só as ativas.
  const consulta = usePessoas({
    ...filtros,
    status: gestor ? filtros.status : '',
    busca: buscaAtrasada,
  })

  const filtrar = (mudanca: Partial<FiltrosPessoas>) =>
    setFiltros((atual) => ({ ...atual, ...mudanca, pagina: 1 }))

  const [aviso, setAviso] = useState<Aviso>(null)
  const [inativando, setInativando] = useState<PessoaResumo | null>(null)
  const reativar = useReativarPessoa()

  const agir = async (pessoa: PessoaResumo) => {
    setAviso(null)
    if (pessoa.status === 'ATIVA') {
      setInativando(pessoa)
      return
    }
    try {
      await reativar.mutateAsync(pessoa.id)
      setAviso({ tipo: 'sucesso', texto: `${nomeCompleto(pessoa)} foi reativada.` })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e instanceof ErroApi ? e.message : MENSAGEM_SEM_CONEXAO })
    }
  }

  const dados = consulta.data

  return (
    <>
      <TituloPagina texto="Busca de dados de pessoas em" destaque="situação de rua" />

      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1 md:ml-auto md:w-96">
          <label htmlFor="busca-pessoas" className="text-sm font-medium text-texto">
            Pesquisar por nome, sobrenome ou apelido
          </label>
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-primaria"
            >
              <path
                fill="currentColor"
                d="M10 3a7 7 0 0 1 5.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"
              />
            </svg>
            <input
              id="busca-pessoas"
              type="search"
              placeholder="Pesquisar"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                setFiltros((atual) => ({ ...atual, pagina: 1 }))
              }}
              className={`${estiloCampo} rounded-full pl-10`}
            />
          </div>
        </div>

        <div className={`grid gap-4 sm:grid-cols-2 ${gestor ? 'lg:grid-cols-3' : ''}`}>
          <CampoSelecao
            rotulo="Visto nos últimos"
            opcoes={OPCOES_VISTO}
            value={filtros.vistoNosUltimosDias?.toString() ?? ''}
            onChange={(e) =>
              filtrar({ vistoNosUltimosDias: e.target.value ? Number(e.target.value) : null })
            }
          />
          {gestor && (
            <CampoSelecao
              rotulo="Status"
              opcoes={OPCOES_STATUS}
              value={filtros.status}
              onChange={(e) => filtrar({ status: e.target.value as StatusPessoa | '' })}
            />
          )}
          <CampoSelecao
            rotulo="Ordenar por"
            opcoes={OPCOES_ORDEM}
            value={filtros.ordem}
            onChange={(e) => filtrar({ ordem: e.target.value as FiltrosPessoas['ordem'] })}
          />
        </div>
      </div>

      {aviso && (
        <div className="mb-4">
          <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>
        </div>
      )}

      {consulta.isPending ? (
        <Esqueleto />
      ) : consulta.isError ? (
        <Alerta tipo="erro">
          Não foi possível carregar as pessoas. {consulta.error.message}{' '}
          <button type="button" className="underline" onClick={() => consulta.refetch()}>
            Tentar novamente
          </button>
        </Alerta>
      ) : dados && dados.itens.length === 0 ? (
        <p role="status" className="py-10 text-center text-texto-suave">
          Nenhuma pessoa encontrada.
        </p>
      ) : (
        dados && (
          <div aria-busy={consulta.isFetching} className="flex flex-col">
            <Tabela pessoas={dados.itens} gestor={gestor} ordem={filtros.ordem} aoAgir={agir} />
            <Cartoes pessoas={dados.itens} gestor={gestor} aoAgir={agir} />
            <Paginacao
              pagina={filtros.pagina}
              tamanho={filtros.tamanho}
              total={dados.total}
              aoMudarPagina={(pagina) => setFiltros((atual) => ({ ...atual, pagina }))}
              aoMudarTamanho={(tamanho) => filtrar({ tamanho })}
            />
          </div>
        )
      )}

      <Ondas className="mx-auto mt-10 h-16 w-full max-w-md" />

      {inativando && (
        <ModalInativar
          pessoa={inativando}
          aoFechar={() => setInativando(null)}
          aoConcluir={() => {
            setAviso({ tipo: 'sucesso', texto: `${nomeCompleto(inativando)} foi inativada.` })
            setInativando(null)
          }}
        />
      )}
    </>
  )
}

// --- Partes da lista ---

interface ListaProps {
  pessoas: PessoaResumo[]
  gestor: boolean
  aoAgir: (pessoa: PessoaResumo) => void
}

function NomePessoa({ pessoa }: { pessoa: PessoaResumo }) {
  return (
    <span className="flex items-center gap-3">
      <Avatar
        url={pessoa.url_miniatura}
        iniciais={iniciais(pessoa)}
        alt={pessoa.url_miniatura ? altFoto(pessoa) : ''}
        tamanho="pequeno"
      />
      <span className="flex flex-col">
        <span className="font-semibold text-texto">{nomeCompleto(pessoa)}</span>
        {pessoa.apelido && <span className="text-sm text-texto-suave">"{pessoa.apelido}"</span>}
      </span>
    </span>
  )
}

function SeloStatus({ status }: { status: StatusPessoa }) {
  const ativa = status === 'ATIVA'
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${
        ativa ? 'border-primaria text-primaria' : 'border-divisor text-texto-suave'
      }`}
    >
      {ativa ? 'Ativa' : 'Inativa'}
    </span>
  )
}

const estiloLinkAcao =
  'alvo-toque inline-flex items-center justify-center rounded-botao border border-borda-campo px-3 text-sm font-semibold whitespace-nowrap text-texto hover:bg-fundo-topo'

function Acoes({ pessoa, gestor, aoAgir }: { pessoa: PessoaResumo } & Omit<ListaProps, 'pessoas'>) {
  const nome = nomeCompleto(pessoa)
  return (
    <div className="flex flex-nowrap gap-2">
      <Link to={`/pessoas/${pessoa.id}`} aria-label={`Ver ${nome}`} className={estiloLinkAcao}>
        Ver
      </Link>
      {gestor && (
        <>
          <Link
            to={`/pessoas/${pessoa.id}/editar`}
            aria-label={`Editar ${nome}`}
            className={estiloLinkAcao}
          >
            Editar
          </Link>
          <Botao
            variante="secundario"
            className="px-3 text-sm whitespace-nowrap"
            aria-label={`${pessoa.status === 'ATIVA' ? 'Inativar' : 'Reativar'} ${nome}`}
            onClick={() => aoAgir(pessoa)}
          >
            {pessoa.status === 'ATIVA' ? 'Inativar' : 'Reativar'}
          </Botao>
        </>
      )}
    </div>
  )
}

function Tabela({
  pessoas,
  gestor,
  ordem,
  aoAgir,
}: ListaProps & { ordem: FiltrosPessoas['ordem'] }) {
  const colunas = [
    { titulo: 'Pessoa', ordenada: ordem === 'nome' },
    { titulo: 'Status' },
    { titulo: 'Última localização' },
    { titulo: 'Visto por último', ordenada: ordem === 'visto' },
    { titulo: 'Cadastrada por' },
    { titulo: 'Ações' },
  ]
  return (
    <div className="hidden overflow-x-auto rounded-card border border-divisor md:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Pessoas em situação de rua encontradas</caption>
        <thead className="bg-fundo-topo text-texto">
          <tr>
            {colunas.map(({ titulo, ordenada }) => (
              <th
                key={titulo}
                scope="col"
                aria-sort={
                  ordenada ? (titulo === 'Pessoa' ? 'ascending' : 'descending') : undefined
                }
                className="px-4 py-3 font-semibold whitespace-nowrap"
              >
                {titulo}
                {ordenada && (
                  <span aria-hidden="true" className="ml-1 text-primaria">
                    {titulo === 'Pessoa' ? '↑' : '↓'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pessoas.map((pessoa) => (
            <tr key={pessoa.id} className="border-t border-divisor align-middle">
              <th scope="row" className="px-4 py-3 font-normal">
                <NomePessoa pessoa={pessoa} />
              </th>
              <td className="px-4 py-3">
                <SeloStatus status={pessoa.status} />
              </td>
              <td className="max-w-56 px-4 py-3 text-texto">
                {localizacao(pessoa) ?? <span className="text-texto-suave">Sem registro</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-texto">
                {pessoa.ultima_vez_visto ? (
                  formatarDataHora(pessoa.ultima_vez_visto)
                ) : (
                  <span className="text-texto-suave">Sem registro</span>
                )}
              </td>
              <td className="px-4 py-3 text-texto">{pessoa.cadastrada_por?.nome ?? '—'}</td>
              <td className="px-4 py-3">
                <Acoes pessoa={pessoa} gestor={gestor} aoAgir={aoAgir} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** No celular, a tabela vira uma lista de cartões (seção 4.3). */
function Cartoes({ pessoas, gestor, aoAgir }: ListaProps) {
  return (
    <ul
      className="flex flex-col gap-3 md:hidden"
      aria-label="Pessoas em situação de rua encontradas"
    >
      {pessoas.map((pessoa) => (
        <li key={pessoa.id} className="flex flex-col gap-3 rounded-card border border-divisor p-4">
          <div className="flex items-start justify-between gap-2">
            <NomePessoa pessoa={pessoa} />
            <SeloStatus status={pessoa.status} />
          </div>
          <dl className="grid gap-1 text-sm">
            <div className="flex gap-1">
              <dt className="text-texto-suave">Visto por último:</dt>
              <dd className="text-texto">
                {pessoa.ultima_vez_visto
                  ? formatarDataHora(pessoa.ultima_vez_visto)
                  : 'Sem registro'}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt className="shrink-0 text-texto-suave">Local:</dt>
              <dd className="text-texto">{localizacao(pessoa) ?? 'Sem registro'}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-texto-suave">Cadastrada por:</dt>
              <dd className="text-texto">{pessoa.cadastrada_por?.nome ?? '—'}</dd>
            </div>
          </dl>
          <Acoes pessoa={pessoa} gestor={gestor} aoAgir={aoAgir} />
        </li>
      ))}
    </ul>
  )
}

/** Carregamento: linhas "fantasma" no formato da lista. */
function Esqueleto() {
  return (
    <div role="status" aria-label="Carregando pessoas" className="flex flex-col gap-3">
      {Array.from({ length: TAMANHO_PAGINA_PADRAO }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex animate-pulse items-center gap-3 rounded-card border border-divisor p-4"
        >
          <span className="size-10 rounded-full bg-divisor" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3 w-1/3 rounded bg-divisor" />
            <span className="h-3 w-1/5 rounded bg-divisor" />
          </span>
          <span className="hidden h-3 w-1/6 rounded bg-divisor md:block" />
          <span className="hidden h-3 w-1/6 rounded bg-divisor md:block" />
        </div>
      ))}
    </div>
  )
}
