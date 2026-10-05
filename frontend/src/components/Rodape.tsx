import { Link } from 'react-router'

import { RedesSociais } from './RedesSociais'

export function Rodape() {
  return (
    <footer className="mt-auto border-t border-divisor bg-fundo">
      <div className="mx-auto flex max-w-conteudo flex-col items-center gap-2 px-4 py-4 text-center text-sm text-texto-suave md:flex-row md:justify-center md:gap-4">
        <address className="not-italic">
          R. Afrânio de Melo Franco, 333 – Quitandinha – Petrópolis/RJ – CEP: 25651-000
        </address>
        <RedesSociais className="gap-1" />
        <Link
          to="/privacidade"
          className="alvo-toque inline-flex items-center font-medium text-primaria underline hover:text-primaria-hover"
        >
          Privacidade
        </Link>
      </div>
    </footer>
  )
}
