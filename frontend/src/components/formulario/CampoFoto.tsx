import { useEffect, useId, useRef, useState, type Ref } from 'react'

import { Avatar } from '../Avatar'

interface CampoFotoProps {
  rotulo: string
  arquivo: File | null | undefined
  aoEscolher: (arquivo: File | null) => void
  /** Iniciais mostradas enquanto não há foto escolhida. */
  iniciais: string
  dica?: string
  erro?: string
  name?: string
  ref?: Ref<HTMLInputElement>
}

/** Escolha de uma foto com prévia redonda. Dica e erro ligados por aria-describedby. */
export function CampoFoto({
  rotulo,
  arquivo,
  aoEscolher,
  iniciais,
  dica,
  erro,
  name,
  ref,
}: CampoFotoProps) {
  const id = useId()
  const idDica = `${id}-dica`
  const idErro = `${id}-erro`
  const descritores = [dica ? idDica : null, erro ? idErro : null].filter(Boolean).join(' ')
  // Prévia do arquivo escolhido; as URLs temporárias são liberadas ao sair da tela.
  const [previa, setPrevia] = useState<string | null>(null)
  const previas = useRef<string[]>([])
  useEffect(() => () => previas.current.forEach((url) => URL.revokeObjectURL(url)), [])

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-texto" id={`${id}-rotulo`}>
        {rotulo}
      </span>
      <div className="flex items-center gap-4">
        <Avatar url={previa} iniciais={iniciais || '?'} alt={previa ? 'Prévia da sua foto' : ''} />
        <label className="alvo-toque inline-flex w-fit cursor-pointer items-center gap-2 rounded-botao border border-borda-campo bg-fundo px-4 font-semibold text-texto focus-within:outline-3 focus-within:outline-primaria hover:bg-fundo-topo">
          <svg viewBox="0 0 24 24" className="size-5 text-primaria" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 8.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 3h6l1.8 2H20a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3.2zm.9 2L8.1 7H4v11h16V7h-4.1l-1.8-2z"
            />
          </svg>
          {arquivo ? 'Trocar foto' : 'Escolher foto'}
          <input
            ref={ref}
            name={name}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-labelledby={`${id}-rotulo`}
            aria-describedby={descritores || undefined}
            aria-invalid={erro ? true : undefined}
            onChange={(e) => {
              const escolhido = e.target.files?.[0] ?? null
              e.target.value = ''
              if (escolhido) {
                const url = URL.createObjectURL(escolhido)
                previas.current.push(url)
                setPrevia(url)
              }
              aoEscolher(escolhido)
            }}
          />
        </label>
      </div>
      {dica && (
        <p id={idDica} className="text-sm text-texto-suave">
          {dica}
        </p>
      )}
      <p id={idErro} aria-live="polite" className="text-sm font-medium text-erro empty:hidden">
        {erro}
      </p>
    </div>
  )
}
