import { useState } from 'react'

import { CampoTexto, type CampoTextoProps } from './CampoTexto'

export function CampoSenha(props: Omit<CampoTextoProps, 'type' | 'acessorio'>) {
  const [visivel, setVisivel] = useState(false)

  return (
    <CampoTexto
      {...props}
      type={visivel ? 'text' : 'password'}
      acessorio={
        <button
          type="button"
          onClick={() => setVisivel((valor) => !valor)}
          aria-pressed={visivel}
          aria-label={`Mostrar ${props.rotulo.toLowerCase()}`}
          className="alvo-toque inline-flex items-center justify-center rounded-campo text-texto-suave hover:text-primaria"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" focusable="false">
            {visivel ? (
              <path
                fill="currentColor"
                d="M2.3 3.7 3.7 2.3l18 18-1.4 1.4-3.3-3.3A10.9 10.9 0 0 1 12 19.5C6.5 19.5 2.7 15 1.5 12a12.6 12.6 0 0 1 4-5.1zm5.4 5.4a4.5 4.5 0 0 0 6.2 6.2l-1.5-1.5a2.5 2.5 0 0 1-3.2-3.2zM12 4.5c5.5 0 9.3 4.5 10.5 7.5a12.5 12.5 0 0 1-2.9 4.2L16.4 13a4.5 4.5 0 0 0-5.4-5.4L8.7 5.2A11 11 0 0 1 12 4.5z"
              />
            ) : (
              <path
                fill="currentColor"
                d="M12 4.5c5.5 0 9.3 4.5 10.5 7.5-1.2 3-5 7.5-10.5 7.5S2.7 15 1.5 12C2.7 9 6.5 4.5 12 4.5zm0 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"
              />
            )}
          </svg>
        </button>
      }
    />
  )
}
