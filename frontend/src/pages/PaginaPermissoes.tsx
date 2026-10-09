import { useState } from 'react'

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
import { useAlterarUsuario, useUsuarios } from '../features/usuarios/api'
import { iniciaisDaConta, nomeDaConta } from '../features/usuarios/conta'
import { EscolhaPerfil } from '../features/usuarios/EscolhaPerfil'
import {
  PERFIS,
  ROTULOS_PERFIL,
  ROTULOS_STATUS_USUARIO,
  type Perfil,
} from '../features/usuarios/perfis'
import type { UsuarioGestao } from '../features/usuarios/tipos'
import { useTituloDocumento } from '../hooks/useTituloDocumento'
import { useValorAtrasado } from '../hooks/useValorAtrasado'

const OPCOES_PERFIL = [
  { valor: '', rotulo: 'Todos' },
  ...PERFIS.map((p) => ({ valor: p, rotulo: ROTULOS_PERFIL[p] })),
]

/** /permissoes — perfil de acesso de cada conta (somente ADMIN). */
export function PaginaPermissoes() {
  useTituloDocumento('Permissões')
  const eu = useUsuarioLogado()
  const { atualizarUsuario } = useAutenticacao()

  const [busca, setBusca] = useState('')
  const [perfil, setPerfil] = useState<Perfil | ''>('')
  const [pagina, setPagina] = useState(1)
  const [tamanho, setTamanho] = useState(TAMANHO_PAGINA_PADRAO)
  const buscaAtrasada = useValorAtrasado(busca)
  const consulta = useUsuarios({ busca: buscaAtrasada, perfil, status: '', pagina, tamanho })
  const alterar = useAlterarUsuario()

  const [editando, setEditando] = useState<UsuarioGestao | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const filtrar = (mudar: () => void) => {
    mudar()
    setPagina(1)
  }

  const salvar = async (usuario: UsuarioGestao, novo: Perfil) => {
    try {
      const alterado = await alterar.mutateAsync({ id: usuario.id, perfil: novo })
      setEditando(null)
      setSucesso(
        `Perfil de acesso de ${nomeDaConta(alterado)} alterado para ${ROTULOS_PERFIL[novo]}.`,
      )
      // A própria pessoa administradora mudou o próprio perfil: reflete na hora.
      if (alterado.id === eu.id) atualizarUsuario({ ...eu, perfil: alterado.perfil })
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : MENSAGEM_SEM_CONEXAO)
    }
  }

  const dados = consulta.data

  return (
    <>
      <TituloPagina texto="Permissões de" destaque="acesso" />
      <p className="mb-6 text-sm text-texto-suave">
        Pessoas usuárias consultam; pessoas colaboradoras também cadastram pessoas e registram
        avistamentos; pessoas administradoras também gerenciam usuários, solicitações e permissões.
        Cadastros pendentes recebem o perfil na aprovação, em Usuários.
      </p>

      <div className="mb-6 grid gap-4 md:grid-cols-[2fr_1fr] md:items-end">
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
      </div>

      <div className="mb-4 flex flex-col gap-3 empty:hidden">
        {sucesso && <Alerta tipo="sucesso">{sucesso}</Alerta>}
        {erro && !editando && <Alerta tipo="erro">{erro}</Alerta>}
      </div>

      {consulta.isPending ? (
        <p role="status" className="py-8 text-center text-texto-suave">
          Carregando contas…
        </p>
      ) : consulta.isError ? (
        <Alerta tipo="erro">Não foi possível carregar as contas. {consulta.error.message}</Alerta>
      ) : dados && dados.itens.length === 0 ? (
        <p role="status" className="py-8 text-center text-texto-suave">
          Nenhuma conta encontrada.
        </p>
      ) : (
        dados && (
          <>
            <ul className="flex flex-col gap-3" aria-label="Permissões das contas">
              {dados.itens.map((usuario) => (
                <li
                  key={usuario.id}
                  className="flex flex-col gap-3 rounded-card border border-divisor p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      url={usuario.foto_miniatura_url}
                      iniciais={iniciaisDaConta(usuario)}
                      alt=""
                      tamanho="pequeno"
                    />
                    <div className="flex flex-col text-sm">
                      <span className="font-semibold text-texto">
                        {nomeDaConta(usuario)}
                        {usuario.id === eu.id && (
                          <span className="font-normal text-texto-suave"> (você)</span>
                        )}
                      </span>
                      <span className="break-all text-texto-suave">{usuario.email}</span>
                      <span className="text-texto">
                        {ROTULOS_PERFIL[usuario.perfil]} · {ROTULOS_STATUS_USUARIO[usuario.status]}
                      </span>
                    </div>
                  </div>
                  {usuario.status === 'PENDENTE' ? (
                    <span className="text-sm text-texto-suave">Aguardando aprovação</span>
                  ) : (
                    <Botao
                      variante="secundario"
                      className="self-start px-4 text-sm whitespace-nowrap sm:self-auto"
                      aria-label={`Alterar perfil: ${nomeDaConta(usuario)}`}
                      onClick={() => {
                        setErro(null)
                        setSucesso(null)
                        setEditando(usuario)
                      }}
                    >
                      Alterar perfil
                    </Botao>
                  )}
                </li>
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

      {editando && (
        <ModalPerfil
          usuario={editando}
          erro={erro}
          carregando={alterar.isPending}
          aoFechar={() => {
            setEditando(null)
            setErro(null)
          }}
          aoSalvar={(novo) => salvar(editando, novo)}
        />
      )}
    </>
  )
}

function ModalPerfil({
  usuario,
  erro,
  carregando,
  aoFechar,
  aoSalvar,
}: {
  usuario: UsuarioGestao
  erro: string | null
  carregando: boolean
  aoFechar: () => void
  aoSalvar: (perfil: Perfil) => void
}) {
  const [escolhido, setEscolhido] = useState<Perfil>(usuario.perfil)
  return (
    <Modal titulo={`Alterar perfil de ${nomeDaConta(usuario)}`} aoFechar={aoFechar}>
      <p className="text-sm break-all text-texto-suave">{usuario.email}</p>
      <EscolhaPerfil valor={escolhido} aoMudar={setEscolhido} />
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Botao variante="secundario" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Botao carregando={carregando} onClick={() => aoSalvar(escolhido)}>
          Salvar perfil
        </Botao>
      </div>
    </Modal>
  )
}
