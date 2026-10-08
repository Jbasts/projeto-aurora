import { Link, useLocation } from 'react-router'

import { CartaoAutenticacao, estiloLink } from '../components/layout/CartaoAutenticacao'
import { ReenviarConfirmacao } from '../features/auth/ReenviarConfirmacao'
import { useTituloDocumento } from '../hooks/useTituloDocumento'
import type { EstadoCadastroEnviado } from './PaginaCadastro'

export function PaginaCadastroEnviado() {
  useTituloDocumento('Cadastro enviado')
  const email = (useLocation().state as EstadoCadastroEnviado | null)?.email

  return (
    <CartaoAutenticacao titulo="Cadastro enviado">
      <div className="flex flex-col gap-3 text-center text-texto">
        <p className="font-semibold">Confirme seu email</p>
        <p>
          Enviamos um link de confirmação para{' '}
          {email ? <strong className="break-all">{email}</strong> : 'o email informado'}. Abra o
          email e clique no link. Ele vale por 24 horas.
        </p>
        <p className="text-texto-suave">
          Depois da confirmação, para proteger os dados das pessoas em situação de rua, uma pessoa
          administradora vai analisar o pedido e liberar seu acesso. Depois disso, você já pode
          entrar com seu email e senha.
        </p>
      </div>

      <section aria-labelledby="titulo-reenviar" className="flex flex-col gap-3">
        <h2 id="titulo-reenviar" className="text-sm font-semibold text-texto">
          Não recebeu? Confira a caixa de spam ou peça outro link.
        </h2>
        <ReenviarConfirmacao email={email} />
      </section>

      <p className="text-center text-sm text-texto">
        <Link to="/login" className={estiloLink}>
          Voltar ao login
        </Link>
      </p>
    </CartaoAutenticacao>
  )
}
