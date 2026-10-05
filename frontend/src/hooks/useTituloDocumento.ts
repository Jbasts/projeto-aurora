import { useEffect } from 'react'

/** Atualiza o título da aba, para quem usa leitor de tela saber em que página está. */
export function useTituloDocumento(titulo: string) {
  useEffect(() => {
    document.title = `${titulo} | Projeto Aurora`
  }, [titulo])
}
