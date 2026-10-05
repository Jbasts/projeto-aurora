import { Link } from 'react-router'

import { estiloBotaoPrimario, PaginaErro } from '../components/PaginaErro'

export function PaginaNaoEncontrada() {
  return (
    <PaginaErro
      sobretitulo="Erro 404"
      titulo="Página não encontrada"
      descricao="A página que você está procurando não existe."
    >
      <Link to="/" className={estiloBotaoPrimario}>
        Voltar ao início
      </Link>
    </PaginaErro>
  )
}
