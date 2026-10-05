import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { Botao } from '../components/Botao'
import { CampoSenha } from '../components/formulario/CampoSenha'
import { RequisitosSenha } from '../components/formulario/RequisitosSenha'
import { CartaoAutenticacao } from '../components/layout/CartaoAutenticacao'
import { TelaCarregando } from '../components/TelaCarregando'
import { useRedefinirSenha, useValidarTokenRedefinicao } from '../features/auth/api'
import { esquemaRedefinirSenha, type DadosRedefinirSenha } from '../features/auth/esquemas'
import { useTituloDocumento } from '../hooks/useTituloDocumento'
import type { EstadoNavegacaoLogin } from '../routes/protecao'

const tokenInvalido = (erro: unknown) => erro instanceof ErroApi && erro.codigo === 'TOKEN_INVALIDO'

export function PaginaRedefinirSenha() {
  useTituloDocumento('Recuperar senha')
  const navigate = useNavigate()
  const token = useSearchParams()[0].get('token') ?? ''
  const validacao = useValidarTokenRedefinicao(token)
  const redefinir = useRedefinirSenha()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<DadosRedefinirSenha>({
    resolver: zodResolver(esquemaRedefinirSenha),
    defaultValues: { senha: '', confirmar_senha: '' },
  })
  const senha = useWatch({ control, name: 'senha' })

  if (!token || tokenInvalido(validacao.error) || tokenInvalido(redefinir.error)) {
    return <Navigate to="/link-expirado" replace />
  }
  if (validacao.isPending) return <TelaCarregando mensagem="Verificando o link…" />

  const enviar = handleSubmit(async (dados) => {
    const resposta = await redefinir.mutateAsync({ ...dados, token }).catch(() => null)
    if (resposta) {
      const estado: EstadoNavegacaoLogin = { aviso: resposta.mensagem }
      navigate('/login', { replace: true, state: estado })
    }
  })

  const erroGeral = validacao.error ?? redefinir.error

  return (
    <CartaoAutenticacao titulo="Recuperar senha">
      {erroGeral && (
        <Alerta tipo="erro">
          {erroGeral instanceof ErroApi ? erroGeral.message : MENSAGEM_SEM_CONEXAO}
        </Alerta>
      )}
      {validacao.isSuccess && (
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
          <CampoSenha
            rotulo="Nova senha"
            autoComplete="new-password"
            erro={errors.senha?.message}
            dica={<RequisitosSenha senha={senha} />}
            {...register('senha')}
          />
          <CampoSenha
            rotulo="Confirmar senha"
            autoComplete="new-password"
            erro={errors.confirmar_senha?.message}
            {...register('confirmar_senha')}
          />
          <Botao type="submit" carregando={redefinir.isPending}>
            Atualizar senha
          </Botao>
        </form>
      )}
      <Link
        to="/login"
        className="alvo-toque inline-flex items-center justify-center self-center text-sm text-texto underline underline-offset-2 hover:text-primaria"
      >
        Voltar
      </Link>
    </CartaoAutenticacao>
  )
}
