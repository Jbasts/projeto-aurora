// Logo PROVISÓRIO "PROJETO AURORA", redesenhado a partir do protótipo até o arquivo oficial chegar.
// É SVG inline (e não <img>) para usar a fonte Montserrat da página e herdar a cor do texto,
// o que o deixa nítido em qualquer tamanho e legível no modo escuro.

// Segmentos do "O", no sentido horário a partir do topo. `null` usa a cor do texto.
const SEGMENTOS_ANEL = [
  '#F2C12E',
  '#3DAE49',
  '#2B6CC4',
  '#7B3FA0',
  '#E86FA6',
  '#C9CED1',
  null,
  '#E53935',
  '#F28C28',
]

const CENTRO_X = 112
const CENTRO_Y = 45
const RAIO = 10.5
const ESPESSURA = 7
const CIRCUNFERENCIA = 2 * Math.PI * RAIO
const VAO = 1.1
const TRECHO = CIRCUNFERENCIA / SEGMENTOS_ANEL.length

export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 196 64"
      role="img"
      aria-label="Projeto Aurora"
      className={`text-texto ${className}`}
    >
      <g fill="currentColor" style={{ fontFamily: 'var(--fonte-base)', fontWeight: 700 }}>
        <text x={CENTRO_X - 12} y="20" fontSize="13.5" textAnchor="middle" letterSpacing="0.6">
          PROJETO
        </text>
        <text x={CENTRO_X - RAIO - ESPESSURA / 2 - 3} y="59" fontSize="40" textAnchor="end">
          AUR
        </text>
        <text x={CENTRO_X + RAIO + ESPESSURA / 2 + 3} y="59" fontSize="40">
          RA
        </text>
      </g>
      <g
        fill="none"
        strokeWidth={ESPESSURA}
        transform={`rotate(-110 ${CENTRO_X} ${CENTRO_Y})`}
        aria-hidden="true"
      >
        {SEGMENTOS_ANEL.map((cor, i) => (
          <circle
            key={i}
            cx={CENTRO_X}
            cy={CENTRO_Y}
            r={RAIO}
            stroke={cor ?? 'currentColor'}
            strokeDasharray={`${TRECHO - VAO} ${CIRCUNFERENCIA - TRECHO + VAO}`}
            strokeDashoffset={-i * TRECHO}
          />
        ))}
      </g>
    </svg>
  )
}
