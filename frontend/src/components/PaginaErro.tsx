import type { ReactNode } from 'react'

import { LinkPularConteudo } from './LinkPularConteudo'
import { Ondas } from './Ondas'

interface PaginaErroProps {
  /** Linha em verde acima do título (ex.: "Erro 404"). */
  sobretitulo?: string
  titulo: string
  descricao: string
  /** Botões e links de ação. */
  children: ReactNode
}

/** Layout de tela cheia das páginas de erro, com as ondas decorativas nos cantos. */
export function PaginaErro({ sobretitulo, titulo, descricao, children }: PaginaErroProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-fundo">
      <LinkPularConteudo />
      <Ondas invertida className="absolute top-0 left-0 h-16 w-64 md:h-24 md:w-96" />
      <main
        id="conteudo"
        tabIndex={-1}
        className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center"
      >
        {sobretitulo && <p className="text-xl font-semibold text-primaria">{sobretitulo}</p>}
        <h1 className="text-2xl font-semibold text-texto md:text-3xl">{titulo}</h1>
        <p className="max-w-md text-texto-suave">{descricao}</p>
        <div className="mt-4 flex flex-col items-center gap-3">{children}</div>
      </main>
      <Ondas className="absolute right-0 bottom-0 h-16 w-64 md:h-24 md:w-96" />
    </div>
  )
}

export const estiloBotaoPrimario =
  'alvo-toque inline-flex items-center justify-center rounded-botao bg-primaria px-6 font-semibold text-sobre-primaria hover:bg-primaria-hover'
