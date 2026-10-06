import { useEffect, useState } from 'react'

/** Devolve o valor só depois de `atraso` ms sem mudanças (debounce de campos de busca). */
export function useValorAtrasado<T>(valor: T, atraso = 300): T {
  const [atrasado, setAtrasado] = useState(valor)

  useEffect(() => {
    const temporizador = setTimeout(() => setAtrasado(valor), atraso)
    return () => clearTimeout(temporizador)
  }, [valor, atraso])

  return atrasado
}
