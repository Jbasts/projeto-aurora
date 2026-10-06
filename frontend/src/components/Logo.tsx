// Logo PROVISÓRIO "PROJETO AURORA", redesenhado a partir do protótipo até o arquivo oficial chegar.
// É SVG inline (e não <img>) para usar a fonte Montserrat da página e herdar a cor do texto,
// o que o deixa nítido em qualquer tamanho e legível no modo escuro.
// As larguras dos textos são fixadas com `textLength`, então o espaçamento não depende da
// métrica exata da fonte carregada.

// Cores da marca no anel do "O", no sentido horário a partir do topo; o anel é um degradê
// contínuo entre elas (aurora).
const CORES_ANEL = ['#F2C12E', '#3DAE49', '#2B6CC4', '#7B3FA0', '#E86FA6', '#E53935', '#F28C28']

const LARGURA = 218
const BASE_AURORA = 76
const ALTURA_MAIUSCULA = 31 // altura das maiúsculas da Montserrat em 44px

const CENTRO_X = 127
const CENTRO_Y = BASE_AURORA - ALTURA_MAIUSCULA / 2
const ESPESSURA = 5.5
const RAIO = (ALTURA_MAIUSCULA + 1.5 - ESPESSURA) / 2 // leve excesso, como num "O" desenhado
const CIRCUNFERENCIA = 2 * Math.PI * RAIO
const FATIAS = 84
const FATIA = CIRCUNFERENCIA / FATIAS

function hexParaRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function corNoAnel(fracao: number) {
  const posicao = fracao * CORES_ANEL.length
  const i = Math.floor(posicao)
  const t = posicao - i
  const a = hexParaRgb(CORES_ANEL[i % CORES_ANEL.length])
  const b = hexParaRgb(CORES_ANEL[(i + 1) % CORES_ANEL.length])
  const [r, g, bl] = a.map((canal, k) => Math.round(canal + (b[k] - canal) * t))
  return `rgb(${r} ${g} ${bl})`
}

const CORES_FATIAS = Array.from({ length: FATIAS }, (_, i) => corNoAnel(i / FATIAS))

export function Logo({ className = 'text-texto' }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${LARGURA} 82`} role="img" aria-label="Projeto Aurora" className={className}>
      <g fill="currentColor" style={{ fontFamily: 'var(--fonte-base)' }}>
        {/* "PROJETO" em versalete espaçado, entre filetes */}
        <rect x="2" y="17.5" width="54" height="1" opacity="0.55" />
        <rect x={LARGURA - 56} y="17.5" width="54" height="1" opacity="0.55" />
        <text
          x={LARGURA / 2 - 42}
          y="22.5"
          fontSize="12"
          fontWeight={500}
          textLength="84"
          lengthAdjust="spacing"
        >
          PROJETO
        </text>

        <text
          x="2"
          y={BASE_AURORA}
          fontSize="44"
          fontWeight={600}
          textLength="105"
          lengthAdjust="spacing"
        >
          AUR
        </text>
        <text
          x={CENTRO_X + RAIO + ESPESSURA / 2 + 3.5}
          y={BASE_AURORA}
          fontSize="44"
          fontWeight={600}
          textLength="68"
          lengthAdjust="spacing"
        >
          RA
        </text>
      </g>
      <g
        fill="none"
        strokeWidth={ESPESSURA}
        transform={`rotate(-90 ${CENTRO_X} ${CENTRO_Y})`}
        aria-hidden="true"
      >
        {CORES_FATIAS.map((cor, i) => (
          <circle
            key={i}
            cx={CENTRO_X}
            cy={CENTRO_Y}
            r={RAIO}
            stroke={cor}
            // Cada fatia invade um pouco a seguinte para não aparecer emenda.
            strokeDasharray={`${FATIA + 0.6} ${CIRCUNFERENCIA - FATIA - 0.6}`}
            strokeDashoffset={-i * FATIA}
          />
        ))}
      </g>
    </svg>
  )
}
