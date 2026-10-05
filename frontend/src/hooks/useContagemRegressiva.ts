import { useCallback, useEffect, useState } from 'react'

/** Contagem regressiva em segundos. `iniciar(segundos)` começa (ou reinicia) a contagem. */
export function useContagemRegressiva() {
  const [fim, setFim] = useState<number | null>(null)
  const [restante, setRestante] = useState(0)

  useEffect(() => {
    if (fim === null) return
    const atualizar = () => {
      const segundos = Math.max(0, Math.ceil((fim - Date.now()) / 1000))
      setRestante(segundos)
      if (segundos === 0) setFim(null)
    }
    atualizar()
    const intervalo = window.setInterval(atualizar, 250)
    return () => window.clearInterval(intervalo)
  }, [fim])

  const iniciar = useCallback((segundos: number) => {
    setRestante(segundos)
    setFim(Date.now() + segundos * 1000)
  }, [])

  return { restante, ativa: restante > 0, iniciar }
}

/** 272 → "4:32" */
export function formatarMinutosSegundos(segundos: number): string {
  const minutos = Math.floor(segundos / 60)
  return `${minutos}:${String(segundos % 60).padStart(2, '0')}`
}
