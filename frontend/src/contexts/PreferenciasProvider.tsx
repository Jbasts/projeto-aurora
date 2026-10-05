import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  CHAVE_NIVEL_FONTE,
  CHAVE_TEMA,
  NIVEIS_FONTE,
  NIVEL_FONTE_PADRAO,
  PreferenciasContext,
  type Tema,
} from './preferencias'

// localStorage pode lançar erro (modo privado, armazenamento bloqueado): nunca quebra a tela.
function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave)
  } catch {
    return null
  }
}

function gravar(chave: string, valor: string): void {
  try {
    localStorage.setItem(chave, valor)
  } catch {
    // Sem persistência; a escolha vale só nesta visita.
  }
}

function temaDoSistema(): Tema {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
}

function nivelInicial(): number {
  const bruto = ler(CHAVE_NIVEL_FONTE)
  if (bruto === null) return NIVEL_FONTE_PADRAO
  const salvo = Number(bruto)
  return Number.isInteger(salvo) && salvo >= 0 && salvo < NIVEIS_FONTE.length
    ? salvo
    : NIVEL_FONTE_PADRAO
}

function temaSalvo(): Tema | null {
  const salvo = ler(CHAVE_TEMA)
  return salvo === 'claro' || salvo === 'escuro' ? salvo : null
}

export function PreferenciasProvider({ children }: { children: ReactNode }) {
  const [nivelFonte, setNivelFonte] = useState(nivelInicial)
  const [temaEscolhido, setTemaEscolhido] = useState<Tema | null>(temaSalvo)
  const [temaSistema, setTemaSistema] = useState<Tema>(temaDoSistema)
  const tema = temaEscolhido ?? temaSistema

  useEffect(() => {
    document.documentElement.style.fontSize = `${NIVEIS_FONTE[nivelFonte]}%`
  }, [nivelFonte])

  useEffect(() => {
    document.documentElement.dataset.tema = tema
  }, [tema])

  // Sem escolha salva, o tema acompanha o sistema operacional.
  useEffect(() => {
    const consulta = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!consulta) return
    const aoMudar = (evento: MediaQueryListEvent) =>
      setTemaSistema(evento.matches ? 'escuro' : 'claro')
    consulta.addEventListener('change', aoMudar)
    return () => consulta.removeEventListener('change', aoMudar)
  }, [])

  const mudarNivel = useCallback((novo: number) => {
    const limitado = Math.min(Math.max(novo, 0), NIVEIS_FONTE.length - 1)
    setNivelFonte(limitado)
    gravar(CHAVE_NIVEL_FONTE, String(limitado))
  }, [])

  const alternarTema = useCallback(() => {
    const novo: Tema = tema === 'escuro' ? 'claro' : 'escuro'
    setTemaEscolhido(novo)
    gravar(CHAVE_TEMA, novo)
  }, [tema])

  const valor = useMemo(
    () => ({
      nivelFonte,
      podeDiminuir: nivelFonte > 0,
      podeAumentar: nivelFonte < NIVEIS_FONTE.length - 1,
      diminuirFonte: () => mudarNivel(nivelFonte - 1),
      aumentarFonte: () => mudarNivel(nivelFonte + 1),
      restaurarFonte: () => mudarNivel(NIVEL_FONTE_PADRAO),
      tema,
      alternarTema,
    }),
    [nivelFonte, mudarNivel, tema, alternarTema],
  )

  return <PreferenciasContext.Provider value={valor}>{children}</PreferenciasContext.Provider>
}
