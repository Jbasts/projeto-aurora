import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../../api/cliente'
import { Alerta } from '../../components/Alerta'
import { Botao } from '../../components/Botao'
import { CampoSenha } from '../../components/formulario/CampoSenha'
import { CampoTexto } from '../../components/formulario/CampoTexto'
import { mascaraCpf } from '../../components/formulario/mascaras'
import { Modal } from '../../components/Modal'
import { useAutenticacao, useUsuarioLogado } from '../../contexts/autenticacao'
import { formatarData } from '../comum/datas'
import type { SolicitacaoPropria } from '../solicitacoes/tipos'
import { useCancelarTroca, usePedirAlteracao } from './api'
import { esquemaPedidoAlteracao, type DadosPedidoAlteracao } from './esquemas'

type Aviso = { tipo: 'sucesso' | 'erro'; texto: string } | null
type Troca = 'email' | 'cpf'

/**
 * Meu perfil: solicitações de troca de email e CPF e o botão que abre o pedido.
 * Nenhuma troca vale sem a aprovação de uma pessoa administradora (tela Solicitações).
 * Email: antes, a pessoa abre o link enviado ao email novo.
 */
export function AlteracaoEmailCpf() {
  const usuario = useUsuarioLogado()
  const { atualizarUsuario } = useAutenticacao()
  const cancelar = useCancelarTroca()
  const [aberto, setAberto] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)

  const cancelarTroca = async (troca: Troca) => {
    setAviso(null)
    try {
      atualizarUsuario(await cancelar.mutateAsync(troca))
      setAviso({
        tipo: 'sucesso',
        texto: troca === 'email' ? 'Troca de email cancelada.' : 'Troca de CPF cancelada.',
      })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e instanceof ErroApi ? e.message : MENSAGEM_SEM_CONEXAO })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {aviso && <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>}

      <Situacao
        solicitacao={usuario.solicitacao_email}
        atual={usuario.email}
        cancelando={cancelar.isPending}
        aoCancelar={() => cancelarTroca('email')}
      />
      <Situacao
        solicitacao={usuario.solicitacao_cpf}
        atual={usuario.cpf_mascarado}
        cancelando={cancelar.isPending}
        aoCancelar={() => cancelarTroca('cpf')}
      />

      <Botao
        variante="secundario"
        className="self-start"
        onClick={() => {
          setAviso(null)
          setAberto(true)
        }}
      >
        Alterar email ou CPF
      </Botao>
      <p className="text-sm text-texto-suave">
        Trocas de email e de CPF passam pela aprovação de uma pessoa administradora. Para mudar o
        perfil de acesso, fale com uma delas.
      </p>

      {aberto && (
        <ModalPedidoAlteracao
          aoFechar={() => setAberto(false)}
          aoEnviar={(mensagem) => {
            setAberto(false)
            setAviso({ tipo: 'sucesso', texto: mensagem })
          }}
        />
      )}
    </div>
  )
}

/** Situação da última solicitação de um tipo: em andamento (com cancelar) ou recusada. */
function Situacao({
  solicitacao,
  atual,
  cancelando,
  aoCancelar,
}: {
  solicitacao: SolicitacaoPropria | null
  atual: string | null
  cancelando: boolean
  aoCancelar: () => void
}) {
  if (!solicitacao) return null
  const eEmail = solicitacao.tipo === 'EMAIL'
  const nome = eEmail ? 'email' : 'CPF'

  if (solicitacao.status === 'RECUSADA' && solicitacao.decidido_em) {
    return (
      <Alerta tipo="info">
        Sua solicitação de troca de {nome} foi recusada em {formatarData(solicitacao.decidido_em)}.
        Se precisar, fale com uma pessoa administradora.
      </Alerta>
    )
  }
  if (solicitacao.status !== 'AGUARDANDO_EMAIL' && solicitacao.status !== 'PENDENTE') return null

  const novo = <span className="font-semibold break-all">{solicitacao.valor_novo_exibicao}</span>
  const continua = atual && (
    <>
      {' '}
      Até a aprovação, continue usando <span className="break-all">{atual}</span>.
    </>
  )

  return (
    <div className="flex flex-col gap-2 rounded-campo border border-divisor p-3 text-sm">
      <p className="text-texto">
        {solicitacao.status === 'AGUARDANDO_EMAIL' ? (
          <>
            <strong>Troca de email: falta abrir o link.</strong> Abra o link que enviamos para{' '}
            {novo}. Depois disso, uma pessoa administradora vai analisar a troca.
          </>
        ) : (
          <>
            <strong>Troca de {nome} em análise.</strong> Você pediu para trocar o {nome} por {novo}{' '}
            em {formatarData(solicitacao.criado_em)}. Uma pessoa administradora vai aprovar ou
            recusar.
          </>
        )}
        {continua}
      </p>
      <Botao
        variante="secundario"
        className="self-start"
        disabled={cancelando}
        onClick={aoCancelar}
      >
        Cancelar troca de {nome}
      </Botao>
    </div>
  )
}

const CAMPOS = ['email', 'cpf', 'senha'] as const

function ModalPedidoAlteracao({
  aoFechar,
  aoEnviar,
}: {
  aoFechar: () => void
  aoEnviar: (mensagem: string) => void
}) {
  const { atualizarUsuario } = useAutenticacao()
  const pedir = usePedirAlteracao()
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DadosPedidoAlteracao>({
    resolver: zodResolver(esquemaPedidoAlteracao),
    defaultValues: { email: '', cpf: '', senha: '' },
  })
  const cpf = register('cpf')

  const enviar = handleSubmit(async (dados) => {
    setErro(null)
    try {
      atualizarUsuario(await pedir.mutateAsync(dados))
      const partes = [
        dados.email &&
          `Enviamos um link para ${dados.email.trim()}. Depois de abrir o link, a troca de email vai para a aprovação de uma pessoa administradora.`,
        dados.cpf && 'A troca de CPF foi enviada para a aprovação de uma pessoa administradora.',
      ]
      aoEnviar(partes.filter(Boolean).join(' '))
    } catch (e) {
      if (e instanceof ErroApi && e.campos.length > 0) {
        for (const { campo, mensagem } of e.campos) {
          const nome = CAMPOS.find((c) => c === campo)
          if (nome) setError(nome, { message: mensagem }, { shouldFocus: true })
          else setErro(mensagem)
        }
      } else {
        setErro(e instanceof ErroApi ? e.message : MENSAGEM_SEM_CONEXAO)
      }
    }
  })

  return (
    <Modal titulo="Alterar email ou CPF" aoFechar={aoFechar}>
      <p className="text-sm text-texto-suave">
        Preencha o que quiser trocar. Toda troca passa pela aprovação de uma pessoa administradora;
        para o email, antes você abre o link que vamos enviar ao endereço novo. Até a aprovação, o
        email e o CPF atuais continuam valendo.
      </p>
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <CampoTexto
          rotulo="Novo email (opcional)"
          type="email"
          autoComplete="email"
          inputMode="email"
          erro={errors.email?.message}
          {...register('email')}
        />
        <CampoTexto
          rotulo="Novo CPF (opcional)"
          inputMode="numeric"
          placeholder="000.000.000-00"
          maxLength={14}
          erro={errors.cpf?.message}
          {...cpf}
          onChange={(evento) => {
            evento.target.value = mascaraCpf(evento.target.value)
            return cpf.onChange(evento)
          }}
        />
        <CampoSenha
          rotulo="Sua senha"
          autoComplete="current-password"
          dica="Para sua segurança, confirme com a senha da conta."
          erro={errors.senha?.message}
          {...register('senha')}
        />
        <div className="flex flex-wrap justify-end gap-3">
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={pedir.isPending}>
            Enviar pedido
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
