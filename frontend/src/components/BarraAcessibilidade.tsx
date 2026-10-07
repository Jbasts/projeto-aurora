import { useLocation } from 'react-router'

import { usePreferencias } from '../contexts/preferencias'
import { useInstalarApp } from '../hooks/useInstalarApp'
import { useOuvirPagina } from '../hooks/useOuvirPagina'
import { useVLibras } from '../hooks/useVLibras'
import { RedesSociais } from './RedesSociais'

const estiloBotao =
  'alvo-toque inline-flex items-center justify-center rounded-campo px-1 text-sm font-semibold text-primaria hover:bg-fundo disabled:cursor-not-allowed disabled:opacity-50'

function Icone({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={d} />
    </svg>
  )
}

const ICONE_OUVIR =
  'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z'
const ICONE_PARAR = 'M6 6h12v12H6z'
const ICONE_MAO =
  'M18.75 8c-.69 0-1.25.56-1.25 1.25V15H17c-1.65 0-3 1.35-3 3h-1c0-2.04 1.53-3.72 3.5-3.97V3.25C16.5 2.56 15.94 2 15.25 2S14 2.56 14 3.25V11h-1V1.25C13 .56 12.44 0 11.75 0S10.5.56 10.5 1.25V11h-1V2.75c0-.69-.56-1.25-1.25-1.25S7 2.06 7 2.75V12H6V5.75c0-.69-.56-1.25-1.25-1.25S3.5 5.06 3.5 5.75v10c0 4.56 3.69 8.25 8.25 8.25S20 20.31 20 15.75v-6.5C20 8.56 19.44 8 18.75 8z'
const ICONE_INSTALAR = 'M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z'

/** Barra superior (seção 5): ouvir página, Libras, tamanho do texto, modo escuro e instalar. */
export function BarraAcessibilidade() {
  const { pathname } = useLocation()
  const leitura = useOuvirPagina(pathname)
  const libras = useVLibras()
  const { podeInstalar, instalar } = useInstalarApp()
  const {
    podeDiminuir,
    podeAumentar,
    diminuirFonte,
    aumentarFonte,
    restaurarFonte,
    tema,
    alternarTema,
  } = usePreferencias()

  return (
    // Landmark próprio: leitores de tela encontram a barra ao navegar por regiões.
    <section
      aria-label="Barra de acessibilidade"
      className="sticky top-0 z-40 border-b border-divisor bg-fundo-topo"
    >
      <div className="mx-auto flex max-w-conteudo flex-wrap items-center justify-between gap-2 px-4 py-1">
        <div
          role="group"
          aria-label="Acessibilidade"
          className="flex flex-wrap items-center gap-x-1 rounded-botao border border-borda-campo px-1 sm:px-2"
        >
          <span
            className="hidden pr-1 text-sm font-medium text-primaria underline sm:inline"
            aria-hidden="true"
          >
            Acessibilidade
          </span>
          {leitura.disponivel && (
            <button
              type="button"
              className={estiloBotao}
              onClick={leitura.alternar}
              aria-pressed={leitura.lendo}
              aria-label={leitura.lendo ? 'Parar leitura da página' : 'Ouvir página'}
              title={leitura.lendo ? 'Parar leitura' : 'Ouvir página'}
            >
              <Icone d={leitura.lendo ? ICONE_PARAR : ICONE_OUVIR} />
            </button>
          )}
          <button
            type="button"
            className={estiloBotao}
            onClick={libras.abrir}
            disabled={libras.carregando}
            aria-label="Traduzir para Libras (VLibras)"
            title="Libras"
          >
            <Icone d={ICONE_MAO} />
          </button>
          <span className="h-5 w-px bg-divisor" aria-hidden="true" />
          <button
            type="button"
            className={estiloBotao}
            onClick={diminuirFonte}
            disabled={!podeDiminuir}
            aria-label="Diminuir tamanho do texto"
          >
            A-
          </button>
          <button
            type="button"
            className={estiloBotao}
            onClick={restaurarFonte}
            aria-label="Tamanho padrão do texto"
          >
            Aa
          </button>
          <button
            type="button"
            className={estiloBotao}
            onClick={aumentarFonte}
            disabled={!podeAumentar}
            aria-label="Aumentar tamanho do texto"
          >
            A+
          </button>
          <span className="h-5 w-px bg-divisor" aria-hidden="true" />
          <button
            type="button"
            className={estiloBotao}
            onClick={alternarTema}
            aria-pressed={tema === 'escuro'}
            aria-label="Modo escuro"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z"
              />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {podeInstalar && (
            <button
              type="button"
              onClick={instalar}
              className="alvo-toque inline-flex items-center gap-1 rounded-botao border border-borda-campo px-3 text-sm font-semibold text-primaria hover:bg-fundo"
            >
              <Icone d={ICONE_INSTALAR} />
              Instalar app
            </button>
          )}
          <RedesSociais className="hidden gap-1 sm:flex" />
        </div>
      </div>
      {libras.erro && (
        <p role="alert" className="mx-auto max-w-conteudo px-4 pb-1 text-sm font-medium text-erro">
          {libras.erro}
        </p>
      )}
    </section>
  )
}
