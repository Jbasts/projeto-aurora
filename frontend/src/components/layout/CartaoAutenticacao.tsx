import type { ReactNode } from 'react'

/** Área do formulário nas telas de autenticação (coluna da direita). */
export function CartaoAutenticacao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <h1 className="text-center text-2xl font-semibold text-texto md:text-3xl">{titulo}</h1>
      {children}
    </div>
  )
}

export const estiloLink =
  'font-semibold text-primaria underline underline-offset-2 hover:text-primaria-hover'
