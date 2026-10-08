import { Link, useSearchParams } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { CartaoAutenticacao, estiloLink } from '../components/layout/CartaoAutenticacao'
import { estiloBotaoPrimario } from '../components/PaginaErro'
import { TelaCarregando } from '../components/TelaCarregando'
import { useVerificarEmail } from '../features/auth/api'
import { ReenviarConfirmacao } from '../features/auth/ReenviarConfirmacao'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

const MENSAGEM_LINK_INVALIDO =
  'Este link de confirmação não é mais válido. Ele expirou ou já foi usado.'

/** /verificar-email?token= — aberto pelo link do email enviado no cadastro. */
export function PaginaVerificarEmail() {
  useTituloDocumento('Confirmar email')
  const token = useSearchParams()[0].get('token') ?? ''
  const verificacao = useVerificarEmail(token)

  if (token && verificacao.isPending) return <TelaCarregando mensagem="Confirmando seu email…" />

  if (verificacao.isSuccess) {
    return (
      <CartaoAutenticacao titulo="Email confirmado">
        <Alerta tipo="sucesso">{verificacao.data.mensagem}</Alerta>
        <p className="text-center text-texto-suave">
          Você pode entrar assim que seu acesso for liberado.
        </p>
        <Link to="/login" className={`${estiloBotaoPrimario} w-full`}>
          Ir para o login
        </Link>
      </CartaoAutenticacao>
    )
  }

  const erro = verificacao.error
  const linkInvalido = !token || (erro instanceof ErroApi && erro.codigo === 'TOKEN_INVALIDO')

  return (
    <CartaoAutenticacao titulo="Confirmar email">
      <Alerta tipo="erro">
        {linkInvalido
          ? MENSAGEM_LINK_INVALIDO
          : erro instanceof ErroApi
            ? erro.message
            : MENSAGEM_SEM_CONEXAO}
      </Alerta>
      <p className="text-center text-sm text-texto-suave">
        Se você já confirmou seu email, é só aguardar a liberação do acesso. Se não, peça um novo
        link.
      </p>
      <ReenviarConfirmacao />
      <p className="text-center text-sm text-texto">
        <Link to="/login" className={estiloLink}>
          Voltar ao login
        </Link>
      </p>
    </CartaoAutenticacao>
  )
}
