import { usePreferencias } from '../contexts/preferencias'
import { RedesSociais } from './RedesSociais'

const estiloBotao =
  'alvo-toque inline-flex items-center justify-center rounded-campo px-1 text-sm font-semibold text-primaria hover:bg-fundo disabled:cursor-not-allowed disabled:opacity-50'

// "Ouvir página", Libras (VLibras) e "Instalar app" (PWA) entram na Fase 8.
export function BarraAcessibilidade() {
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
    <div className="bg-fundo-topo">
      <div className="mx-auto flex max-w-conteudo flex-wrap items-center justify-between gap-2 px-4 py-1">
        <div
          role="group"
          aria-label="Acessibilidade"
          className="flex items-center gap-1 rounded-botao border border-borda-campo px-2"
        >
          <span className="pr-1 text-sm font-medium text-primaria underline" aria-hidden="true">
            Acessibilidade
          </span>
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
        <RedesSociais className="hidden gap-1 sm:flex" />
      </div>
    </div>
  )
}
