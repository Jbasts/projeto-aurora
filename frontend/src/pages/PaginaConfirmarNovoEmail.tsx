import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO, requisitar } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { CartaoAutenticacao, estiloLink } from '../components/layout/CartaoAutenticacao'
import { estiloBotaoPrimario } from '../components/PaginaErro'
import { TelaCarregando } from '../components/TelaCarregando'
import { useAutenticacao } from '../contexts/autenticacao'
import { useConfirmarNovoEmail } from '../features/auth/api'
import type { Usuario } from '../features/auth/tipos'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

const MENSAGEM_LINK_INVALIDO =
  'Este link não é mais válido. Ele expirou, já foi usado ou a troca foi cancelada. ' +
  'Peça a troca de novo em Meu perfil.'

/** /confirmar-novo-email?token= — link enviado ao email novo. Confirmado, a troca vai para ADMIN. */
export function PaginaConfirmarNovoEmail() {
  useTituloDocumento('Confirmar novo email')
  const token = useSearchParams()[0].get('token') ?? ''
  const confirmacao = useConfirmarNovoEmail(token)
  const { estado, atualizarUsuario } = useAutenticacao()
  const logado = estado.situacao === 'autenticada'

  // Com a sessão aberta neste navegador, o menu e Meu perfil já mostram o email novo.
  useEffect(() => {
    if (!confirmacao.isSuccess || !logado) return
    requisitar<Usuario>('/auth/me')
      .then(atualizarUsuario)
      .catch(() => {})
  }, [confirmacao.isSuccess, logado, atualizarUsuario])

  if (token && confirmacao.isPending) {
    return <TelaCarregando mensagem="Confirmando seu novo email…" />
  }

  if (confirmacao.isSuccess) {
    return (
      <CartaoAutenticacao titulo="Email confirmado">
        <Alerta tipo="sucesso">{confirmacao.data.mensagem}</Alerta>
        <Link to={logado ? '/meu-perfil' : '/login'} className={`${estiloBotaoPrimario} w-full`}>
          {logado ? 'Ir para Meu perfil' : 'Ir para o login'}
        </Link>
      </CartaoAutenticacao>
    )
  }

  const erro = confirmacao.error
  const linkInvalido = !token || (erro instanceof ErroApi && erro.codigo === 'TOKEN_INVALIDO')

  return (
    <CartaoAutenticacao titulo="Confirmar novo email">
      <Alerta tipo="erro">
        {linkInvalido
          ? MENSAGEM_LINK_INVALIDO
          : erro instanceof ErroApi
            ? erro.message
            : MENSAGEM_SEM_CONEXAO}
      </Alerta>
      <p className="text-center text-sm text-texto">
        <Link to={logado ? '/meu-perfil' : '/login'} className={estiloLink}>
          {logado ? 'Voltar para Meu perfil' : 'Voltar ao login'}
        </Link>
      </p>
    </CartaoAutenticacao>
  )
}
