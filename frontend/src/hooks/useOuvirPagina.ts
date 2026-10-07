import { useCallback, useEffect, useState } from 'react'

// O Chrome interrompe falas longas depois de ~15 s: a leitura é feita em trechos curtos.
const TAMANHO_TRECHO = 200

/** Divide o texto em trechos de até ~200 caracteres, quebrando em fim de frase quando dá. */
export function dividirEmTrechos(texto: string): string[] {
  const frases = texto
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?:;])\s+/)
  const trechos: string[] = []
  let atual = ''
  for (const frase of frases) {
    if (!frase) continue
    if (atual && (atual + ' ' + frase).length > TAMANHO_TRECHO) {
      trechos.push(atual)
      atual = frase
    } else {
      atual = atual ? `${atual} ${frase}` : frase
    }
  }
  if (atual) trechos.push(atual)
  return trechos
}

export function suportaLeitura(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * "Ouvir página" (seção 6): lê em voz pt-BR o conteúdo do <main>. O mesmo botão alterna entre
 * ouvir e parar; trocar de página interrompe a leitura (quem chama passa `chave` = rota atual).
 */
export function useOuvirPagina(chave: string) {
  const [lendo, setLendo] = useState(false)

  const parar = useCallback(() => {
    if (suportaLeitura()) window.speechSynthesis.cancel()
    setLendo(false)
  }, [])

  // Nova página ou saída da tela: para a leitura.
  useEffect(() => parar, [chave, parar])

  const ouvir = useCallback(() => {
    if (!suportaLeitura()) return
    const conteudo = document.getElementById('conteudo')
    const trechos = dividirEmTrechos(conteudo?.innerText ?? '')
    if (trechos.length === 0) return

    const sintese = window.speechSynthesis
    sintese.cancel()
    const voz = sintese.getVoices().find((v) => v.lang.toLowerCase().startsWith('pt-br'))
    trechos.forEach((texto, indice) => {
      const fala = new SpeechSynthesisUtterance(texto)
      fala.lang = 'pt-BR'
      if (voz) fala.voice = voz
      if (indice === trechos.length - 1) fala.onend = () => setLendo(false)
      fala.onerror = () => setLendo(false)
      sintese.speak(fala)
    })
    setLendo(true)
  }, [])

  const alternar = useCallback(() => (lendo ? parar() : ouvir()), [lendo, ouvir, parar])

  return { lendo, alternar, disponivel: suportaLeitura() }
}
