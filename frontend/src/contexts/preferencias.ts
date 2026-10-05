import { createContext, useContext } from 'react'

/** Tamanhos do `font-size` do <html> (seção 6). O índice 1 (100%) é o padrão. */
export const NIVEIS_FONTE = [87.5, 100, 112.5, 125] as const
export const NIVEL_FONTE_PADRAO = 1

export type Tema = 'claro' | 'escuro'

export const CHAVE_TEMA = 'aurora:tema'
export const CHAVE_NIVEL_FONTE = 'aurora:nivel-fonte'

export interface Preferencias {
  nivelFonte: number
  podeDiminuir: boolean
  podeAumentar: boolean
  diminuirFonte: () => void
  aumentarFonte: () => void
  restaurarFonte: () => void
  tema: Tema
  alternarTema: () => void
}

export const PreferenciasContext = createContext<Preferencias | null>(null)

export function usePreferencias(): Preferencias {
  const contexto = useContext(PreferenciasContext)
  if (!contexto) throw new Error('usePreferencias precisa estar dentro de <PreferenciasProvider>.')
  return contexto
}
