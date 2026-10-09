import { useState } from 'react'
import { Link } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { Avatar } from '../components/Avatar'
import { Botao } from '../components/Botao'
import { CampoSelecao } from '../components/formulario/CampoSelecao'
import { Modal } from '../components/Modal'
import { Paginacao, TAMANHO_PAGINA_PADRAO } from '../components/Paginacao'
import { TituloPagina } from '../components/TituloPagina'
import { formatarDataHora } from '../features/comum/datas'
import { useDecidirSolicitacao, useSolicitacoes } from '../features/solicitacoes/api'
import {
  ROTULOS_STATUS_SOLICITACAO,
  ROTULOS_TIPO_SOLICITACAO,
  type Solicitacao,
  type StatusSolicitacao,
  type TipoSolicitacao,
} from '../features/solicitacoes/tipos'
import { iniciaisDaConta } from '../features/usuarios/conta'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

type Decisao = 'aprovar' | 'recusar'

const OPCOES_STATUS = [
  { valor: 'PENDENTE', rotulo: 'Pendentes' },
  { valor: 'AGUARDANDO_EMAIL', rotulo: 'Aguardando confirmação do email' },
  { valor: 'APROVADA', rotulo: 'Aprovadas' },
  { valor: 'RECUSADA', rotulo: 'Recusadas' },
  { valor: 'CANCELADA', rotulo: 'Canceladas' },
  { valor: '', rotulo: 'Todas' },
]
const OPCOES_TIPO = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'EMAIL', rotulo: 'Email' },
  { valor: 'CPF', rotulo: 'CPF' },
]

const estiloStatus: Record<StatusSolicitacao, string> = {
  PENDENTE: 'border-primaria text-primaria font-semibold',
  AGUARDANDO_EMAIL: 'border-divisor text-texto',
  APROVADA: 'border-divisor text-texto',
  RECUSADA: 'border-divisor text-texto-suave',
  CANCELADA: 'border-divisor text-texto-suave',
}

/** /solicitacoes — trocas de email e CPF pedidas em Meu perfil (somente ADMIN). */
export function PaginaSolicitacoes() {
  useTituloDocumento('Solicitações')
  const [status, setStatus] = useState<StatusSolicitacao | ''>('PENDENTE')
  const [tipo, setTipo] = useState<TipoSolicitacao | ''>('')
  const [pagina, setPagina] = useState(1)
  const [tamanho, setTamanho] = useState(TAMANHO_PAGINA_PADRAO)
  const consulta = useSolicitacoes({ status, tipo, pagina, tamanho })
  const decidir = useDecidirSolicitacao()

  const [aberta, setAberta] = useState<{ decisao: Decisao; solicitacao: Solicitacao } | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const filtrar = (mudar: () => void) => {
    mudar()
    setPagina(1)
  }

  const confirmar = async () => {
    if (!aberta) return
    const { decisao, solicitacao } = aberta
    try {
      await decidir.mutateAsync({ id: solicitacao.id, decisao })
      setAberta(null)
      const oQue = `troca de ${ROTULOS_TIPO_SOLICITACAO[solicitacao.tipo]} de ${solicitacao.usuario.nome_completo}`
      setSucesso(decisao === 'aprovar' ? `A ${oQue} foi aprovada.` : `A ${oQue} foi recusada.`)
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : MENSAGEM_SEM_CONEXAO)
    }
  }

  const dados = consulta.data

  return (
    <>
      <TituloPagina texto="Solicitações de" destaque="troca" />
      <p className="mb-6 text-sm text-texto-suave">
        Pedidos de troca de email ou de CPF feitos em Meu perfil. Nada muda na conta até você
        aprovar. Trocas de email só chegam como pendentes depois que a pessoa abre o link enviado ao
        email novo.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 md:max-w-2xl">
        <CampoSelecao
          rotulo="Situação"
          opcoes={OPCOES_STATUS}
          value={status}
          onChange={(e) => filtrar(() => setStatus(e.target.value as StatusSolicitacao | ''))}
        />
        <CampoSelecao
          rotulo="Tipo"
          opcoes={OPCOES_TIPO}
          value={tipo}
          onChange={(e) => filtrar(() => setTipo(e.target.value as TipoSolicitacao | ''))}
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 empty:hidden">
        {sucesso && <Alerta tipo="sucesso">{sucesso}</Alerta>}
        {erro && !aberta && <Alerta tipo="erro">{erro}</Alerta>}
      </div>

      {consulta.isPending ? (
        <p role="status" className="py-8 text-center text-texto-suave">
          Carregando solicitações…
        </p>
      ) : consulta.isError ? (
        <Alerta tipo="erro">
          Não foi possível carregar as solicitações. {consulta.error.message}
        </Alerta>
      ) : dados && dados.itens.length === 0 ? (
        <p role="status" className="py-8 text-center text-texto-suave">
          Nenhuma solicitação encontrada.
        </p>
      ) : (
        dados && (
          <>
            <ul className="flex flex-col gap-3" aria-label="Solicitações">
              {dados.itens.map((solicitacao) => (
                <CartaoSolicitacao
                  key={solicitacao.id}
                  solicitacao={solicitacao}
                  aoDecidir={(decisao) => {
                    setErro(null)
                    setSucesso(null)
                    setAberta({ decisao, solicitacao })
                  }}
                />
              ))}
            </ul>
            <Paginacao
              pagina={pagina}
              tamanho={tamanho}
              total={dados.total}
              aoMudarPagina={setPagina}
              aoMudarTamanho={(novo) => filtrar(() => setTamanho(novo))}
            />
          </>
        )
      )}

      {aberta && (
        <ModalDecisao
          {...aberta}
          erro={erro}
          carregando={decidir.isPending}
          aoFechar={() => {
            setAberta(null)
            setErro(null)
          }}
          aoConfirmar={confirmar}
        />
      )}
    </>
  )
}

function CartaoSolicitacao({
  solicitacao,
  aoDecidir,
}: {
  solicitacao: Solicitacao
  aoDecidir: (decisao: Decisao) => void
}) {
  const { usuario } = solicitacao
  const tipo = ROTULOS_TIPO_SOLICITACAO[solicitacao.tipo]
  const descricao = `troca de ${tipo} de ${usuario.nome_completo}`

  return (
    <li className="flex flex-col gap-3 rounded-card border border-divisor p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <Avatar
          url={usuario.foto_miniatura_url}
          iniciais={iniciaisDaConta({ nome: usuario.nome_completo })}
          alt=""
          tamanho="pequeno"
        />
        <div className="flex flex-col gap-1 text-sm">
          <span className="flex flex-wrap items-center gap-2">
            <Link
              to={`/usuarios/${usuario.id}`}
              className="text-base font-semibold text-texto underline-offset-2 hover:underline"
            >
              {usuario.nome_completo}
            </Link>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs ${estiloStatus[solicitacao.status]}`}
            >
              {ROTULOS_STATUS_SOLICITACAO[solicitacao.status]}
            </span>
          </span>
          <span className="font-medium text-texto">Troca de {tipo}</span>
          <dl className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[auto_1fr]">
            <dt className="text-texto-suave">Atual:</dt>
            <dd className="break-all text-texto">{solicitacao.valor_atual ?? 'Não informado'}</dd>
            <dt className="text-texto-suave">Novo:</dt>
            <dd className="font-semibold break-all text-texto">{solicitacao.valor_novo}</dd>
            <dt className="text-texto-suave">Pedida em:</dt>
            <dd className="text-texto">{formatarDataHora(solicitacao.criado_em)}</dd>
            {solicitacao.email_confirmado_em && (
              <>
                <dt className="text-texto-suave">Email novo confirmado em:</dt>
                <dd className="text-texto">{formatarDataHora(solicitacao.email_confirmado_em)}</dd>
              </>
            )}
            {solicitacao.decidido_em && (
              <>
                <dt className="text-texto-suave">Encerrada em:</dt>
                <dd className="text-texto">
                  {formatarDataHora(solicitacao.decidido_em)}
                  {solicitacao.decidido_por && ` por ${solicitacao.decidido_por}`}
                </dd>
              </>
            )}
          </dl>
        </div>
      </div>
      {solicitacao.status === 'PENDENTE' && (
        <div className="flex flex-wrap gap-2 md:flex-nowrap">
          <Botao
            className="px-4 text-sm whitespace-nowrap"
            aria-label={`Aprovar ${descricao}`}
            onClick={() => aoDecidir('aprovar')}
          >
            Aprovar
          </Botao>
          <Botao
            variante="secundario"
            className="px-4 text-sm whitespace-nowrap"
            aria-label={`Recusar ${descricao}`}
            onClick={() => aoDecidir('recusar')}
          >
            Recusar
          </Botao>
        </div>
      )}
    </li>
  )
}

function ModalDecisao({
  decisao,
  solicitacao,
  erro,
  carregando,
  aoFechar,
  aoConfirmar,
}: {
  decisao: Decisao
  solicitacao: Solicitacao
  erro: string | null
  carregando: boolean
  aoFechar: () => void
  aoConfirmar: () => void
}) {
  const tipo = ROTULOS_TIPO_SOLICITACAO[solicitacao.tipo]
  const aprovar = decisao === 'aprovar'
  return (
    <Modal
      titulo={`${aprovar ? 'Aprovar' : 'Recusar'} troca de ${tipo} de ${solicitacao.usuario.nome_completo}`}
      aoFechar={aoFechar}
    >
      <p className="text-sm break-all text-texto">
        De <strong>{solicitacao.valor_atual ?? 'não informado'}</strong> para{' '}
        <strong>{solicitacao.valor_novo}</strong>.
      </p>
      <p className="text-sm text-texto-suave">
        {aprovar
          ? solicitacao.tipo === 'CPF'
            ? 'Confira o documento da pessoa antes de aprovar. Aprovado, o novo CPF passa a valer na hora para entrar na plataforma.'
            : 'Aprovado, o novo email passa a valer na hora para entrar na plataforma, e o email antigo fica livre.'
          : `Nada muda na conta. A pessoa vê em Meu perfil que a troca de ${tipo} foi recusada.`}
      </p>
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Botao variante="secundario" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Botao carregando={carregando} onClick={aoConfirmar}>
          {aprovar ? 'Aprovar troca' : 'Recusar troca'}
        </Botao>
      </div>
    </Modal>
  )
}
