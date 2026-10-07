import { Link, Outlet } from 'react-router'

import { BarraAcessibilidade } from '../BarraAcessibilidade'
import { LinkPularConteudo } from '../LinkPularConteudo'
import { Logo } from '../Logo'
import { Rodape } from '../Rodape'

/** Páginas abertas a todos (ex.: Privacidade), com ou sem login. */
export function LayoutPublico() {
  return (
    <div className="flex min-h-screen flex-col bg-fundo">
      <LinkPularConteudo />
      <BarraAcessibilidade />
      <header className="border-b border-divisor bg-fundo-topo">
        <div className="mx-auto flex max-w-conteudo items-center px-4 py-3">
          <Link to="/" aria-label="Projeto Aurora — início" className="inline-flex">
            <Logo className="h-12 w-auto text-texto" />
          </Link>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-conteudo flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Rodape />
    </div>
  )
}
