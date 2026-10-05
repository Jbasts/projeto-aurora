import { Link } from 'react-router'

import { estiloBotaoPrimario, PaginaErro } from '../components/PaginaErro'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

export function PaginaLinkExpirado() {
  useTituloDocumento('Link expirado')

  return (
    <PaginaErro
      sobretitulo="Link expirado"
      titulo="Este link não é mais válido"
      descricao="Ele expirou ou já foi usado. Solicite um novo link para redefinir sua senha."
    >
      <Link to="/recuperar-senha" className={estiloBotaoPrimario}>
        Solicitar novo link
      </Link>
      <Link
        to="/login"
        className="alvo-toque inline-flex items-center font-medium text-primaria underline underline-offset-2 hover:text-primaria-hover"
      >
        Voltar ao login
      </Link>
    </PaginaErro>
  )
}
