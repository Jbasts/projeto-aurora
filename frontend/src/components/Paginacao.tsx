import { useId, useState } from 'react'

import { Botao } from './Botao'
import { estiloCampo } from './formulario/CampoTexto'

/** Padrão de todas as listagens paginadas. Espelha app/schemas/comum.py. */
export const TAMANHO_PAGINA_PADRAO = 5
export const TAMANHO_PAGINA_MAXIMO = 100

interface PaginacaoProps {
  pagina: number
  tamanho: number
  total: number
  aoMudarPagina: (pagina: number) => void
  /** Mudar o tamanho volta para a primeira página (quem chama decide). */
  aoMudarTamanho: (tamanho: number) => void
}

function tamanhoValido(texto: string): number | null {
  const numero = Number(texto)
  return Number.isInteger(numero) && numero >= 1 && numero <= TAMANHO_PAGINA_MAXIMO ? numero : null
}

/** Paginação no servidor: total, itens por página (qualquer valor de 1 a 100) e navegação. */
export function Paginacao({
  pagina,
  tamanho,
  total,
  aoMudarPagina,
  aoMudarTamanho,
}: PaginacaoProps) {
  const idTamanho = useId()
  const [texto, setTexto] = useState(String(tamanho))
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho))

  // Se o tamanho mudar por fora, o campo acompanha.
  const [tamanhoAnterior, setTamanhoAnterior] = useState(tamanho)
  if (tamanho !== tamanhoAnterior) {
    setTamanhoAnterior(tamanho)
    setTexto(String(tamanho))
  }

  return (
    <nav
      aria-label="Paginação"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-texto"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p>
          Total de registros: <strong>{total}</strong>
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor={idTamanho}>Itens por página</label>
          <input
            id={idTamanho}
            type="number"
            inputMode="numeric"
            min={1}
            max={TAMANHO_PAGINA_MAXIMO}
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value)
              const novo = tamanhoValido(evento.target.value)
              if (novo !== null && novo !== tamanho) aoMudarTamanho(novo)
            }}
            onBlur={() => setTexto(String(tamanho))}
            aria-describedby={`${idTamanho}-dica`}
            className={`${estiloCampo} w-20`}
          />
          <span id={`${idTamanho}-dica`} className="sr-only">
            De 1 a {TAMANHO_PAGINA_MAXIMO}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Botao
          variante="secundario"
          className="px-0"
          aria-label="Página anterior"
          disabled={pagina <= 1}
          onClick={() => aoMudarPagina(pagina - 1)}
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path fill="currentColor" d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z" />
          </svg>
        </Botao>
        <span aria-current="page" className="whitespace-nowrap">
          Página {pagina} de {totalPaginas}
        </span>
        <Botao
          variante="secundario"
          className="px-0"
          aria-label="Próxima página"
          disabled={pagina >= totalPaginas}
          onClick={() => aoMudarPagina(pagina + 1)}
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path fill="currentColor" d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z" />
          </svg>
        </Botao>
      </div>
    </nav>
  )
}
