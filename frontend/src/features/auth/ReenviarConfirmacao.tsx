import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../../api/cliente'
import { Alerta } from '../../components/Alerta'
import { Botao } from '../../components/Botao'
import { CampoTexto } from '../../components/formulario/CampoTexto'
import { useReenviarVerificacao } from './api'
import { esquemaRecuperarSenha, type DadosRecuperarSenha } from './esquemas'

/** Pede um novo link de confirmação de email. O email vem preenchido quando já é conhecido. */
export function ReenviarConfirmacao({ email = '' }: { email?: string }) {
  const reenviar = useReenviarVerificacao()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosRecuperarSenha>({
    resolver: zodResolver(esquemaRecuperarSenha),
    defaultValues: { email },
  })

  const enviar = handleSubmit((dados) => reenviar.mutate(dados.email))

  return (
    <div className="flex flex-col gap-3">
      {reenviar.isSuccess && <Alerta tipo="sucesso">{reenviar.data.mensagem}</Alerta>}
      {reenviar.isError && (
        <Alerta tipo="erro">
          {reenviar.error instanceof ErroApi ? reenviar.error.message : MENSAGEM_SEM_CONEXAO}
        </Alerta>
      )}
      <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
        <CampoTexto
          rotulo="Email cadastrado"
          type="email"
          autoComplete="email"
          inputMode="email"
          erro={errors.email?.message}
          {...register('email')}
        />
        <Botao type="submit" variante="secundario" carregando={reenviar.isPending}>
          Reenviar email de confirmação
        </Botao>
      </form>
    </div>
  )
}
