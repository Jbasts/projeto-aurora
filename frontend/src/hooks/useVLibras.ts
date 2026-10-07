import { useCallback, useState } from 'react'

// Widget oficial do Governo Federal (seção 6). Só é baixado quando a pessoa aciona a Libras.
const URL_VLIBRAS = 'https://vlibras.gov.br/app'

interface JanelaComVLibras {
  VLibras?: { Widget: new (caminho: string) => unknown }
  VLibrasWidget?: { open?: () => void }
}

const janela = () => window as unknown as JanelaComVLibras

// Carregamento em andamento (dois cliques seguidos não baixam o script duas vezes).
let carregamento: Promise<void> | null = null

function carregarVLibras(): Promise<void> {
  if (janela().VLibrasWidget?.open) return Promise.resolve()
  carregamento ??= new Promise<void>((resolver, rejeitar) => {
    const script = document.createElement('script')
    script.src = `${URL_VLIBRAS}/vlibras-plugin.js`
    script.async = true
    script.onload = () => {
      carregamento = null
      // Inicializa já (sem esperar o carregamento da página, que aconteceu antes).
      const { VLibras } = janela()
      if (VLibras) new VLibras.Widget(URL_VLIBRAS)
      resolver()
    }
    script.onerror = () => {
      carregamento = null
      script.remove()
      rejeitar(new Error('VLibras indisponível'))
    }
    document.body.appendChild(script)
  })
  return carregamento
}

/** Abre o tradutor de Libras (VLibras), carregando o widget na primeira vez. */
export function useVLibras() {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const abrir = useCallback(async () => {
    setErro(null)
    setCarregando(true)
    try {
      await carregarVLibras()
      janela().VLibrasWidget?.open?.()
    } catch {
      setErro('Não foi possível abrir o VLibras. Verifique a conexão e tente de novo.')
    } finally {
      setCarregando(false)
    }
  }, [])

  return { abrir, carregando, erro }
}
