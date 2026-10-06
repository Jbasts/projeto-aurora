import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ModalProps {
  titulo: string
  aoFechar: () => void
  children: ReactNode
}

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Janela de diálogo acessível: foco vai para dentro ao abrir, fica preso nela (Tab),
 * Esc fecha e o foco volta para o elemento que a abriu.
 */
export function Modal({ titulo, aoFechar, children }: ModalProps) {
  const idTitulo = useId()
  const caixa = useRef<HTMLDivElement>(null)
  const aoFecharAtual = useRef(aoFechar)

  useEffect(() => {
    aoFecharAtual.current = aoFechar
  }, [aoFechar])

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    const elementos = () => [...(caixa.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? [])]
    ;(elementos()[0] ?? caixa.current)?.focus()

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        aoFecharAtual.current()
        return
      }
      if (evento.key !== 'Tab') return
      const lista = elementos()
      if (lista.length === 0) return
      const primeiro = lista[0]
      const ultimo = lista[lista.length - 1]
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primeiro.focus()
      }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      anterior?.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-texto/50 p-4 sm:items-center">
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-card bg-fundo p-6 shadow-xl"
      >
        <h2 id={idTitulo} className="text-lg font-semibold text-texto">
          {titulo}
        </h2>
        {children}
      </div>
    </div>
  )
}
