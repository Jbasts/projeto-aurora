import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { Botao } from '../components/Botao'
import { CampoTexto } from '../components/formulario/CampoTexto'
import { CartaoAutenticacao } from '../components/layout/CartaoAutenticacao'
import { useSolicitarRecuperacao } from '../features/auth/api'
import { esquemaRecuperarSenha, type DadosRecuperarSenha } from '../features/auth/esquemas'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

const estiloVoltar =
  'alvo-toque inline-flex items-center justify-center self-center text-sm text-texto underline underline-offset-2 hover:text-primaria'

export function PaginaRecuperarSenha() {
  useTituloDocumento('Recuperar senha')
  const solicitar = useSolicitarRecuperacao()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosRecuperarSenha>({ resolver: zodResolver(esquemaRecuperarSenha) })

  const enviar = handleSubmit((dados) => solicitar.mutate(dados))

  if (solicitar.isSuccess) {
    return (
      <CartaoAutenticacao titulo="Recuperar senha">
        <Alerta tipo="sucesso">{solicitar.data.mensagem}</Alerta>
        <p className="text-center text-sm text-texto-suave">
          Confira também a caixa de spam. O link vale por 30 minutos.
        </p>
        <Link to="/login" className={estiloVoltar}>
          Voltar ao login
        </Link>
      </CartaoAutenticacao>
    )
  }

  return (
    <CartaoAutenticacao titulo="Recuperar senha">
      {solicitar.isError && (
        <Alerta tipo="erro">
          {solicitar.error instanceof ErroApi ? solicitar.error.message : MENSAGEM_SEM_CONEXAO}
        </Alerta>
      )}
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <CampoTexto
          rotulo="Email ou CPF"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          dica="O link para criar uma nova senha vai para o email da sua conta."
          erro={errors.login?.message}
          {...register('login')}
        />
        <Botao type="submit" carregando={solicitar.isPending}>
          Receber email
        </Botao>
      </form>
      <Link to="/login" className={estiloVoltar}>
        Voltar
      </Link>
    </CartaoAutenticacao>
  )
}
