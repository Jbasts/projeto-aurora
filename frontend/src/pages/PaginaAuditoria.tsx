import { useState } from 'react'
import { Link } from 'react-router'

import { Alerta } from '../components/Alerta'
import { Botao } from '../components/Botao'
import { CampoSelecao } from '../components/formulario/CampoSelecao'
import { CampoTexto } from '../components/formulario/CampoTexto'
import { Paginacao, TAMANHO_PAGINA_PADRAO, TAMANHO_PAGINA_MAXIMO } from '../components/Paginacao'
import { TituloPagina } from '../components/TituloPagina'
import { useLogsAuditoria, type LogAuditoria } from '../features/auditoria/api'
import {
  ACOES,
  descreverDetalhes,
  pessoaDoRegistro,
  ROTULOS_ACAO,
  type AcaoAuditoria,
} from '../features/auditoria/rotulos'
import { formatarDataHora, limiteDoDia, paraCampoData } from '../features/comum/datas'
import { useUsuarios } from '../features/usuarios/api'
import { ROTULOS_PERFIL } from '../features/usuarios/perfis'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

const OPCOES_ACAO = [
  { valor: '', rotulo: 'Todas' },
  ...ACOES.map((acao) => ({ valor: acao, rotulo: ROTULOS_ACAO[acao] })),
]

interface Filtros {
  usuarioId: string
  acao: AcaoAuditoria | ''
  inicio: string
  fim: string
}

const SEM_FILTROS: Filtros = { usuarioId: '', acao: '', inicio: '', fim: '' }

/** Logs de auditoria (seção 3.11), somente para a pessoa administradora. */
export function PaginaAuditoria() {
  useTituloDocumento('Logs de auditoria')
  const [hoje] = useState(() => paraCampoData(new Date()))
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS)
  const [pagina, setPagina] = useState(1)
  const [tamanho, setTamanho] = useState(TAMANHO_PAGINA_PADRAO)

  const de = filtros.inicio ? limiteDoDia(filtros.inicio, false) : null
  const ate = filtros.fim ? limiteDoDia(filtros.fim, true) : null
  const intervaloInvalido = de !== null && ate !== null && de > ate

  const consulta = useLogsAuditoria(
    { usuarioId: filtros.usuarioId, acao: filtros.acao, de, ate, pagina, tamanho },
    !intervaloInvalido,
  )
  // Opções do filtro de usuário: até 100, em ordem de nome (pendentes primeiro).
  const usuarios = useUsuarios({
    busca: '',
    perfil: '',
    status: '',
    pagina: 1,
    tamanho: TAMANHO_PAGINA_MAXIMO,
  })
  const opcoesUsuario = [
    { valor: '', rotulo: 'Todos' },
    ...(usuarios.data?.itens ?? []).map((u) => ({ valor: u.id, rotulo: `${u.nome} (${u.email})` })),
  ]

  const filtrar = (mudanca: Partial<Filtros>) => {
    setFiltros((atual) => ({ ...atual, ...mudanca }))
    setPagina(1)
  }
  const temFiltro = JSON.stringify(filtros) !== JSON.stringify(SEM_FILTROS)
  const dados = consulta.data

  return (
    <>
      <TituloPagina texto="Logs de" destaque="auditoria" />

      <p className="mb-6 text-texto-suave">
        Registro de logins, alterações de usuários e ações sobre o cadastro das pessoas em situação
        de rua. Os detalhes guardam só identificadores, nunca dados pessoais.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CampoSelecao
          rotulo="Usuário"
          opcoes={opcoesUsuario}
          value={filtros.usuarioId}
          onChange={(e) => filtrar({ usuarioId: e.target.value })}
        />
        <CampoSelecao
          rotulo="Ação"
          opcoes={OPCOES_ACAO}
          value={filtros.acao}
          onChange={(e) => filtrar({ acao: e.target.value as AcaoAuditoria | '' })}
        />
        <CampoTexto
          rotulo="De"
          type="date"
          max={hoje}
          value={filtros.inicio}
          onChange={(e) => filtrar({ inicio: e.target.value })}
        />
        <CampoTexto
          rotulo="Até"
          type="date"
          max={hoje}
          value={filtros.fim}
          erro={intervaloInvalido ? 'A data final não pode ser antes da inicial.' : undefined}
          onChange={(e) => filtrar({ fim: e.target.value })}
        />
      </div>
      {temFiltro && (
        <div className="mb-4">
          <Botao variante="secundario" onClick={() => filtrar(SEM_FILTROS)}>
            Limpar filtros
          </Botao>
        </div>
      )}

      {consulta.isError ? (
        <Alerta tipo="erro">
          Não foi possível carregar os registros. {consulta.error.message}
        </Alerta>
      ) : intervaloInvalido ? null : !dados ? (
        <p role="status" className="py-10 text-center text-texto-suave">
          Carregando registros…
        </p>
      ) : dados.total === 0 ? (
        <p role="status" className="py-10 text-center text-texto-suave">
          Nenhum registro encontrado.
        </p>
      ) : (
        <>
          <TabelaLogs logs={dados.itens} />
          <ListaLogs logs={dados.itens} />
          <Paginacao
            pagina={pagina}
            tamanho={tamanho}
            total={dados.total}
            aoMudarPagina={setPagina}
            aoMudarTamanho={(novo) => {
              setTamanho(novo)
              setPagina(1)
            }}
          />
        </>
      )}
    </>
  )
}

function Autor({ log }: { log: LogAuditoria }) {
  if (!log.usuario) return <span className="text-texto-suave">Não identificado</span>
  return (
    <span className="flex flex-col">
      <span className="font-medium text-texto">{log.usuario.nome}</span>
      <span className="break-all text-texto-suave">{log.usuario.email}</span>
      <span className="text-texto-suave">{ROTULOS_PERFIL[log.usuario.perfil]}</span>
    </span>
  )
}

function Registro({ log }: { log: LogAuditoria }) {
  const pessoaId = pessoaDoRegistro(log)
  const detalhes = descreverDetalhes(log.detalhes)
  return (
    <span className="flex flex-col gap-1">
      {log.usuario_afetado && (
        <span className="text-texto">
          Usuário: {log.usuario_afetado.nome}{' '}
          <span className="break-all text-texto-suave">({log.usuario_afetado.email})</span>
        </span>
      )}
      {detalhes && <span className="text-texto">{detalhes}</span>}
      {pessoaId && (
        <Link
          to={`/pessoas/${pessoaId}`}
          className="font-medium text-primaria underline hover:text-primaria-hover"
        >
          Ver pessoa
        </Link>
      )}
      {!log.usuario_afetado && !detalhes && !pessoaId && (
        <span className="text-texto-suave">—</span>
      )}
    </span>
  )
}

function TabelaLogs({ logs }: { logs: LogAuditoria[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-card border border-divisor md:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Registros de auditoria, do mais recente</caption>
        <thead className="bg-fundo-topo text-texto">
          <tr>
            {['Data e hora', 'Quem', 'Ação', 'Detalhes', 'IP'].map((t) => (
              <th key={t} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-t border-divisor align-top">
              <th scope="row" className="px-4 py-3 font-normal whitespace-nowrap text-texto">
                {formatarDataHora(log.criado_em)}
              </th>
              <td className="px-4 py-3">
                <Autor log={log} />
              </td>
              <td className="px-4 py-3 font-medium text-texto">{ROTULOS_ACAO[log.acao]}</td>
              <td className="px-4 py-3">
                <Registro log={log} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-texto-suave">{log.ip ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** No celular, a tabela vira uma lista de cartões. */
function ListaLogs({ logs }: { logs: LogAuditoria[] }) {
  return (
    <ul className="flex flex-col gap-3 md:hidden" aria-label="Registros de auditoria">
      {logs.map((log) => (
        <li
          key={log.id}
          className="flex flex-col gap-2 rounded-card border border-divisor p-4 text-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold text-texto">{ROTULOS_ACAO[log.acao]}</span>
            <span className="text-texto-suave">{formatarDataHora(log.criado_em)}</span>
          </div>
          <Autor log={log} />
          <Registro log={log} />
          {log.ip && <span className="text-texto-suave">IP: {log.ip}</span>}
        </li>
      ))}
    </ul>
  )
}
