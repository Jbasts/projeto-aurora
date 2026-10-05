import { Link } from 'react-router'

import { CartaoAutenticacao } from '../components/layout/CartaoAutenticacao'
import { estiloBotaoPrimario } from '../components/PaginaErro'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

export function PaginaCadastroEnviado() {
  useTituloDocumento('Cadastro enviado')

  return (
    <CartaoAutenticacao titulo="Cadastro enviado">
      <div className="flex flex-col gap-3 text-center text-texto">
        <p>Recebemos seu cadastro.</p>
        <p className="text-texto-suave">
          Para proteger os dados das pessoas em situação de rua, uma pessoa administradora vai
          analisar o pedido e liberar seu acesso. Depois disso, você já pode entrar com seu email e
          senha.
        </p>
      </div>
      <Link to="/login" className={`${estiloBotaoPrimario} w-full`}>
        Voltar ao login
      </Link>
    </CartaoAutenticacao>
  )
}
