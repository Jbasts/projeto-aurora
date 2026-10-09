import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { Botao } from '../components/Botao'
import { CampoSenha } from '../components/formulario/CampoSenha'
import { CampoTexto } from '../components/formulario/CampoTexto'
import { CartaoAutenticacao, estiloLink } from '../components/layout/CartaoAutenticacao'
import { useAutenticacao } from '../contexts/autenticacao'
import { ReenviarConfirmacao } from '../features/auth/ReenviarConfirmacao'
import { esquemaLogin, type DadosLogin } from '../features/auth/esquemas'
import { formatarMinutosSegundos, useContagemRegressiva } from '../hooks/useContagemRegressiva'
import { useTituloDocumento } from '../hooks/useTituloDocumento'
import type { EstadoNavegacaoLogin } from '../routes/protecao'

export function PaginaLogin() {
  useTituloDocumento('Entrar')
  const { entrar } = useAutenticacao()
  const aviso = (useLocation().state as EstadoNavegacaoLogin | null)?.aviso
  const [erro, setErro] = useState<string | null>(null)
  // Email da conta que ainda não confirmou o email: oferece reenviar o link.
  const [emailNaoVerificado, setEmailNaoVerificado] = useState<string | null>(null)
  const bloqueio = useContagemRegressiva()
  // Minutos anunciados uma vez ao leitor de tela; o relógio visível muda a cada segundo.
  const [minutosBloqueio, setMinutosBloqueio] = useState(0)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DadosLogin>({ resolver: zodResolver(esquemaLogin) })

  // Depois de entrar, <RotaSomenteAnonima> leva para a rota pedida antes do login.
  const enviar = handleSubmit(async ({ login, senha }) => {
    setErro(null)
    setEmailNaoVerificado(null)
    try {
      await entrar(login, senha)
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'EMAIL_NAO_VERIFICADO') {
        setErro(e.message)
        // Entrou com o CPF: o email não é conhecido aqui, a pessoa digita no reenvio.
        setEmailNaoVerificado(login.includes('@') ? login.trim() : '')
      } else if (e instanceof ErroApi && e.codigo === 'CONTA_BLOQUEADA') {
        const segundos = Number(e.extras.segundos_restantes) || 300
        setMinutosBloqueio(Math.ceil(segundos / 60))
        bloqueio.iniciar(segundos)
      } else {
        setErro(e instanceof ErroApi ? e.message : MENSAGEM_SEM_CONEXAO)
      }
    }
  })

  return (
    <CartaoAutenticacao titulo="Entrar">
      {aviso && !erro && !bloqueio.ativa && <Alerta tipo="sucesso">{aviso}</Alerta>}
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      {emailNaoVerificado !== null && <ReenviarConfirmacao email={emailNaoVerificado} />}
      {bloqueio.ativa && (
        <Alerta tipo="erro">
          <span aria-hidden="true">
            Muitas tentativas. Tente novamente em {formatarMinutosSegundos(bloqueio.restante)}
          </span>
          <span className="sr-only">
            Muitas tentativas. Tente novamente em {minutosBloqueio}{' '}
            {minutosBloqueio === 1 ? 'minuto' : 'minutos'}.
          </span>
        </Alerta>
      )}

      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <CampoTexto
          rotulo="Email ou CPF"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          erro={errors.login?.message}
          {...register('login')}
        />
        <div className="flex flex-col gap-1">
          <CampoSenha
            rotulo="Senha"
            autoComplete="current-password"
            erro={errors.senha?.message}
            {...register('senha')}
          />
          <Link
            to="/recuperar-senha"
            className="alvo-toque inline-flex items-center self-end text-sm text-texto underline underline-offset-2 hover:text-primaria"
          >
            Esqueci minha senha
          </Link>
        </div>
        <Botao type="submit" carregando={isSubmitting} disabled={bloqueio.ativa}>
          Entrar
        </Botao>
      </form>

      <p className="text-center text-sm text-texto">
        Não tem uma conta?{' '}
        <Link to="/cadastro" className={estiloLink}>
          Cadastre-se
        </Link>
      </p>
    </CartaoAutenticacao>
  )
}
