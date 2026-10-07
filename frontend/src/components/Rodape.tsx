import { Link } from 'react-router'

import { useInstalarApp } from '../hooks/useInstalarApp'
import { RedesSociais } from './RedesSociais'

const estiloLink =
  'alvo-toque inline-flex items-center font-medium text-texto underline-offset-4 hover:text-primaria hover:underline'

/** Divisor vertical entre os blocos (só no computador, como no protótipo). */
function Divisor() {
  return <span aria-hidden="true" className="hidden h-6 w-px bg-linha md:block" />
}

/**
 * Rodapé do protótipo: linha cinza, endereço, redes sociais e, no lugar de "Baixe o app",
 * "Instalar app" (PWA, quando o navegador oferece) e o link "Privacidade" (seção 3.11).
 */
export function Rodape() {
  const { podeInstalar, instalar } = useInstalarApp()

  return (
    <footer className="mt-auto px-4 pt-6 pb-4">
      <div className="mx-auto flex max-w-[calc(var(--largura-conteudo)+6rem)] flex-col items-center gap-2 border-t border-linha pt-3 text-center text-sm text-texto md:flex-row md:justify-center md:gap-5">
        <Divisor />
        <address className="not-italic">
          R. Afrânio de Melo Franco, 333 – Quitandinha – Petrópolis/RJ – CEP: 25651-000
        </address>
        <RedesSociais cor="texto" className="gap-1" />
        <Divisor />
        <div className="flex items-center gap-4">
          {podeInstalar && (
            <button type="button" onClick={instalar} className={estiloLink}>
              Instalar app
            </button>
          )}
          <Link to="/privacidade" className={estiloLink}>
            Privacidade
          </Link>
        </div>
      </div>
    </footer>
  )
}
