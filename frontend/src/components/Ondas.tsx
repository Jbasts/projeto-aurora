interface Pico {
  /** Posição do pico, de 0 (esquerda) a 1 (direita). */
  centro: number
  /** Altura do pico, de 0 a 1. */
  altura: number
  /** Largura do pico, de 0 a 1. */
  largura: number
}

const PICOS_PADRAO: Pico[] = [
  { centro: 0.18, altura: 0.55, largura: 0.07 },
  { centro: 0.4, altura: 0.3, largura: 0.06 },
  { centro: 0.62, altura: 0.95, largura: 0.07 },
  { centro: 0.8, altura: 0.45, largura: 0.06 },
  { centro: 0.93, altura: 0.3, largura: 0.04 },
]

interface OndasProps {
  className?: string
  picos?: Pico[]
  barras?: number
  /** Espelha verticalmente (barras penduradas a partir do topo). */
  invertida?: boolean
}

/** Ilustração decorativa de ondas em barras verticais (identidade visual do protótipo). */
export function Ondas({
  className = '',
  picos = PICOS_PADRAO,
  barras = 140,
  invertida = false,
}: OndasProps) {
  const largura = barras * 3
  const alturaMaxima = 60

  const retangulos = Array.from({ length: barras }, (_, i) => {
    const x = i / (barras - 1)
    const intensidade = picos.reduce(
      (soma, p) => soma + p.altura * Math.exp(-((x - p.centro) ** 2) / (2 * p.largura ** 2)),
      0.06,
    )
    const altura = Math.max(2, Math.min(1, intensidade) * alturaMaxima)
    return (
      <rect
        key={i}
        x={i * 3}
        y={invertida ? 0 : alturaMaxima - altura}
        width={1.4}
        height={altura}
        rx={0.7}
      />
    )
  })

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${largura} ${alturaMaxima}`}
      preserveAspectRatio="none"
      className={`fill-primaria-clara ${className}`}
    >
      {retangulos}
    </svg>
  )
}
