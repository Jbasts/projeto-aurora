/** Número de pendências ao lado de um item de menu. */
export function Contador({ valor }: { valor?: number }) {
  if (!valor) return null
  return (
    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primaria px-1.5 text-xs font-bold text-sobre-primaria no-underline">
      <span aria-hidden="true">{valor}</span>
      <span className="sr-only">{`, ${valor} ${valor === 1 ? 'pendente' : 'pendentes'}`}</span>
    </span>
  )
}
