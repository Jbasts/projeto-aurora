import { useState } from 'react'
import { Link } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { Avatar } from '../components/Avatar'
import { Botao } from '../components/Botao'
import { CampoSelecao } from '../components/formulario/CampoSelecao'
import { CampoTexto } from '../components/formulario/CampoTexto'
import { Modal } from '../components/Modal'
import { Paginacao, TAMANHO_PAGINA_PADRAO } from '../components/Paginacao'
import { TituloPagina } from '../components/TituloPagina'
import { useAutenticacao, useUsuarioLogado } from '../contexts/autenticacao'
import type { StatusUsuario } from '../features/auth/tipos'
import { useAlterarUsuario, useContagemPendentes, useUsuarios } from '../features/usuarios/api'
import { formatarData } from '../features/comum/datas'
import { iniciaisDaConta } from '../features/usuarios/conta'
import { EscolhaPerfil } from '../features/usuarios/EscolhaPerfil'
import {
  PERFIS,
  ROTULOS_PERFIL,
  ROTULOS_STATUS_USUARIO,
  type Perfil,
} from '../features/usuarios/perfis'
import type { AlteracaoUsuario, UsuarioGestao } from '../features/usuarios/tipos'
import { useTituloDocumento } from '../hooks/useTituloDocumento'
import { useValorAtrasado } from '../hooks/useValorAtrasado'

// O perfil de quem já foi aprovado muda na tela Permissões.
type Acao = 'aprovar' | 'recusar' | 'inativar' | 'reativar'

interface AcaoAberta {
  acao: Acao
  usuario: UsuarioGestao
}

const OPCOES_PERFIL = [
  { valor: '', rotulo: 'Todos' },
  ...PERFIS.map((p) => ({ valor: p, rotulo: ROTULOS_PERFIL[p] })),
]
const OPCOES_STATUS = [
  { valor: '', rotulo: 'Todos' },
  ...(['PENDENTE', 'ATIVO', 'INATIVO'] as const).map((s) => ({
    valor: s,
    rotulo: ROTULOS_STATUS_USUARIO[s],
  })),
]

const MENSAGENS_SUCESSO: Record<Acao, (nome: string) => string> = {
  aprovar: (nome) => `Cadastro de ${nome} aprovado.`,
  recusar: (nome) => `Cadastro de ${nome} recusado.`,
  inativar: (nome) => `${nome} foi inativado(a) e perdeu o acesso.`,
  reativar: (nome) => `${nome} foi reativado(a).`,
}

const estiloStatus: Record<StatusUsuario, string> = {
  PENDENTE: 'border-primaria text-primaria font-semibold',
  ATIVO: 'border-divisor text-texto',
  INATIVO: 'border-divisor text-texto-suave',
}

export function PaginaUsuarios() {
  useTituloDocumento('Gerenciar usuários')
  const eu = useUsuarioLogado()
  const { atualizarUsuario, sair } = useAutenticacao()

  const [busca, setBusca] = useState('')
  const [perfil, setPerfil] = useState<Perfil | ''>('')
  const [status, setStatus] = useState<StatusUsuario | ''>('')
  const [pagina, setPagina] = useState(1)
  const [tamanho, setTamanho] = useState(TAMANHO_PAGINA_PADRAO)
  const buscaAtrasada = useValorAtrasado(busca)

  const consulta = useUsuarios({ busca: buscaAtrasada, perfil, status, pagina, tamanho })
  const { data: pendentes = 0 } = useContagemPendentes(true)
  const alterar = useAlterarUsuario()

  const [acaoAberta, setAcaoAberta] = useState<AcaoAberta | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  const filtrar = (mudar: () => void) => {
    mudar()
    setPagina(1)
  }

  const abrir = (acao: Acao, usuario: UsuarioGestao) => {
    setErroAcao(null)
    setSucesso(null)
    if (acao === 'reativar') {
      void executar(acao, usuario, { status: 'ATIVO' })
    } else {
      setAcaoAberta({ acao, usuario })
    }
  }

  const executar = async (acao: Acao, usuario: UsuarioGestao, dados: AlteracaoUsuario) => {
    try {
      const alterado = await alterar.mutateAsync({ id: usuario.id, ...dados })
      setAcaoAberta(null)
      setSucesso(MENSAGENS_SUCESSO[acao](nomeCompleto(alterado)))
      // A própria pessoa administradora mudou o próprio acesso: reflete na hora.
      if (alterado.id === eu.id) {
        if (alterado.status !== 'ATIVO') await sair()
        else atualizarUsuario({ ...eu, perfil: alterado.perfil })
      }
    } catch (e) {
      setErroAcao(e instanceof ErroApi ? e.message : MENSAGEM_SEM_CONEXAO)
    }
  }

  const dados = consulta.data
  const soPendentes = status === 'PENDENTE'

  return (
    <>
      <TituloPagina texto="Gerenciar" destaque="usuários" />

      <div className="mb-6 flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
          <CampoTexto
            rotulo="Buscar por nome ou email"
            type="search"
            value={busca}
            onChange={(e) => filtrar(() => setBusca(e.target.value))}
          />
          <CampoSelecao
            rotulo="Perfil de acesso"
            opcoes={OPCOES_PERFIL}
            value={perfil}
            onChange={(e) => filtrar(() => setPerfil(e.target.value as Perfil | ''))}
          />
          <CampoSelecao
            rotulo="Status"
            opcoes={OPCOES_STATUS}
            value={status}
            onChange={(e) => filtrar(() => setStatus(e.target.value as StatusUsuario | ''))}
          />
          <Botao
            variante={soPendentes ? 'primario' : 'secundario'}
            aria-pressed={soPendentes}
            onClick={() => filtrar(() => setStatus(soPendentes ? '' : 'PENDENTE'))}
          >
            Pendentes ({pendentes})
          </Botao>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 empty:hidden">
        {sucesso && <Alerta tipo="sucesso">{sucesso}</Alerta>}
        {erroAcao && !acaoAberta && <Alerta tipo="erro">{erroAcao}</Alerta>}
      </div>

      {consulta.isPending ? (
        <p role="status" className="py-8 text-center text-texto-suave">
          Carregando usuários…
        </p>
      ) : consulta.isError ? (
        <Alerta tipo="erro">Não foi possível carregar os usuários. {consulta.error.message}</Alerta>
      ) : dados && dados.itens.length === 0 ? (
        <p role="status" className="py-8 text-center text-texto-suave">
          Nenhum usuário encontrado.
        </p>
      ) : (
        dados && (
          <>
            <TabelaUsuarios usuarios={dados.itens} euId={eu.id} aoAgir={abrir} />
            <ListaUsuarios usuarios={dados.itens} euId={eu.id} aoAgir={abrir} />
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

      {acaoAberta && (
        <ModalAcao
          {...acaoAberta}
          erro={erroAcao}
          carregando={alterar.isPending}
          aoFechar={() => {
            setAcaoAberta(null)
            setErroAcao(null)
          }}
          aoConfirmar={(dadosAcao) => executar(acaoAberta.acao, acaoAberta.usuario, dadosAcao)}
        />
      )}
    </>
  )
}

// --- Linhas e ações ---

interface ListaProps {
  usuarios: UsuarioGestao[]
  euId: string
  aoAgir: (acao: Acao, usuario: UsuarioGestao) => void
}

function acoesDoStatus(status: StatusUsuario): Acao[] {
  if (status === 'PENDENTE') return ['aprovar', 'recusar']
  if (status === 'ATIVO') return ['inativar']
  return ['reativar']
}

const ROTULOS_ACAO: Record<Acao, string> = {
  aprovar: 'Aprovar',
  recusar: 'Recusar',
  inativar: 'Inativar',
  reativar: 'Reativar',
}

const estiloLinkDados =
  'alvo-toque inline-flex items-center justify-center rounded-botao border border-borda-campo bg-fundo px-3 text-sm font-semibold whitespace-nowrap text-texto hover:bg-fundo-topo'

function Acoes({ usuario, aoAgir }: { usuario: UsuarioGestao; aoAgir: ListaProps['aoAgir'] }) {
  return (
    <div className="flex flex-nowrap gap-2">
      <Link
        to={`/usuarios/${usuario.id}`}
        aria-label={`Ver dados: ${nomeCompleto(usuario)}`}
        className={estiloLinkDados}
      >
        Ver dados
      </Link>
      {acoesDoStatus(usuario.status).map((acao) => (
        <Botao
          key={acao}
          variante={acao === 'aprovar' ? 'primario' : 'secundario'}
          className="px-3 text-sm whitespace-nowrap"
          aria-label={`${ROTULOS_ACAO[acao]}: ${nomeCompleto(usuario)}`}
          onClick={() => aoAgir(acao, usuario)}
        >
          {ROTULOS_ACAO[acao]}
        </Botao>
      ))}
    </div>
  )
}

function SeloStatus({ status }: { status: StatusUsuario }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${estiloStatus[status]}`}
    >
      {ROTULOS_STATUS_USUARIO[status]}
    </span>
  )
}

function nomeCompleto(usuario: UsuarioGestao): string {
  return usuario.sobrenome ? `${usuario.nome} ${usuario.sobrenome}` : usuario.nome
}

function NomeUsuario({ usuario, euId }: { usuario: UsuarioGestao; euId: string }) {
  return (
    <span className="flex items-center gap-3">
      <Avatar
        url={usuario.foto_miniatura_url}
        iniciais={iniciaisDaConta(usuario)}
        alt=""
        tamanho="pequeno"
      />
      <span className="flex flex-col items-start gap-1">
        <span className="font-semibold text-texto">
          {nomeCompleto(usuario)}
          {usuario.id === euId && <span className="font-normal text-texto-suave"> (você)</span>}
        </span>
      </span>
    </span>
  )
}

function TabelaUsuarios({ usuarios, euId, aoAgir }: ListaProps) {
  return (
    <div className="hidden overflow-x-auto rounded-card border border-divisor md:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Usuários da plataforma</caption>
        <thead className="bg-fundo-topo text-texto">
          <tr>
            {['Nome', 'Email', 'Perfil de acesso', 'Status', 'Criado em', 'Ações'].map((t) => (
              <th key={t} scope="col" className="px-4 py-3 font-semibold">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <tr key={usuario.id} className="border-t border-divisor align-middle">
              <th scope="row" className="px-4 py-3 font-normal">
                <NomeUsuario usuario={usuario} euId={euId} />
              </th>
              <td className="px-4 py-3 text-texto">
                <span className="block break-all">{usuario.email}</span>
                {usuario.cpf && (
                  <span className="block whitespace-nowrap text-texto-suave">
                    CPF {usuario.cpf}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-texto">{ROTULOS_PERFIL[usuario.perfil]}</td>
              <td className="px-4 py-3">
                <SeloStatus status={usuario.status} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-texto">
                {formatarData(usuario.criado_em)}
              </td>
              <td className="px-4 py-3">
                <Acoes usuario={usuario} aoAgir={aoAgir} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** No celular, a tabela vira uma lista de cartões. */
function ListaUsuarios({ usuarios, euId, aoAgir }: ListaProps) {
  return (
    <ul className="flex flex-col gap-3 md:hidden" aria-label="Usuários da plataforma">
      {usuarios.map((usuario) => (
        <li key={usuario.id} className="flex flex-col gap-3 rounded-card border border-divisor p-4">
          <div className="flex items-start justify-between gap-2">
            <NomeUsuario usuario={usuario} euId={euId} />
            <SeloStatus status={usuario.status} />
          </div>
          <dl className="grid gap-1 text-sm">
            <div>
              <dt className="sr-only">Email</dt>
              <dd className="break-all text-texto">{usuario.email}</dd>
            </div>
            {usuario.cpf && (
              <div className="flex gap-1">
                <dt className="text-texto-suave">CPF:</dt>
                <dd className="text-texto">{usuario.cpf}</dd>
              </div>
            )}
            <div className="flex gap-1">
              <dt className="text-texto-suave">Perfil de acesso:</dt>
              <dd className="text-texto">{ROTULOS_PERFIL[usuario.perfil]}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-texto-suave">Criado em:</dt>
              <dd className="text-texto">{formatarData(usuario.criado_em)}</dd>
            </div>
          </dl>
          <Acoes usuario={usuario} aoAgir={aoAgir} />
        </li>
      ))}
    </ul>
  )
}

// --- Modal de confirmação ---

interface ModalAcaoProps extends AcaoAberta {
  erro: string | null
  carregando: boolean
  aoFechar: () => void
  aoConfirmar: (dados: AlteracaoUsuario) => void
}

function ModalAcao({ acao, usuario, erro, carregando, aoFechar, aoConfirmar }: ModalAcaoProps) {
  const [perfilEscolhido, setPerfilEscolhido] = useState<Perfil>(usuario.perfil)
  const escolhePerfil = acao === 'aprovar'

  const textos: Record<Exclude<Acao, 'reativar'>, { titulo: string; botao: string }> = {
    aprovar: { titulo: `Aprovar cadastro de ${nomeCompleto(usuario)}`, botao: 'Aprovar' },
    recusar: { titulo: `Recusar cadastro de ${nomeCompleto(usuario)}`, botao: 'Recusar cadastro' },
    inativar: { titulo: `Inativar ${nomeCompleto(usuario)}`, botao: 'Inativar' },
  }
  const { titulo, botao } = textos[acao as Exclude<Acao, 'reativar'>]

  const confirmar = () => {
    if (acao === 'aprovar') aoConfirmar({ status: 'ATIVO', perfil: perfilEscolhido })
    else aoConfirmar({ status: 'INATIVO' })
  }

  return (
    <Modal titulo={titulo} aoFechar={aoFechar}>
      <p className="text-sm break-all text-texto-suave">{usuario.email}</p>

      {escolhePerfil ? (
        <EscolhaPerfil valor={perfilEscolhido} aoMudar={setPerfilEscolhido} />
      ) : (
        <p className="text-texto">
          {acao === 'recusar'
            ? 'A pessoa não terá acesso à plataforma. Você pode reativar a conta depois, se mudar de ideia.'
            : 'A pessoa perde o acesso na hora. Você pode reativar a conta depois.'}
        </p>
      )}

      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Botao variante="secundario" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Botao carregando={carregando} onClick={confirmar}>
          {botao}
        </Botao>
      </div>
    </Modal>
  )
}
