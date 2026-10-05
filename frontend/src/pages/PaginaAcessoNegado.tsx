import { Link } from 'react-router'

import { estiloBotaoPrimario, PaginaErro } from '../components/PaginaErro'

export function PaginaAcessoNegado() {
  return (
    <PaginaErro
      sobretitulo="Erro 403"
      titulo="Acesso negado"
      descricao="Você não tem permissão para acessar esta página."
    >
      <Link to="/" className={estiloBotaoPrimario}>
        Voltar ao início
      </Link>
    </PaginaErro>
  )
}
