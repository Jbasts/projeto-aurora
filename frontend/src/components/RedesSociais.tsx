import type { ReactNode } from 'react'

// TODO: trocar "#" pelos endereços oficiais das redes do projeto.
const REDES: { nome: string; url: string; icone: ReactNode }[] = [
  {
    nome: 'Instagram',
    url: '#',
    icone: (
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
      </g>
    ),
  },
  {
    nome: 'LinkedIn',
    url: '#',
    icone: (
      <g fill="currentColor">
        <rect x="3" y="9" width="4" height="12" />
        <circle cx="5" cy="5" r="2.2" />
        <path d="M10 9h3.8v1.7C14.4 9.7 15.7 8.8 17.6 8.8 20.4 8.8 21 10.7 21 13.2V21h-4v-6.8c0-1.4-.3-2.6-1.8-2.6-1.6 0-2.2 1.1-2.2 2.6V21h-3z" />
      </g>
    ),
  },
  {
    nome: 'Facebook',
    url: '#',
    icone: (
      <path
        fill="currentColor"
        d="M13.5 22v-8.2h2.8l.4-3.3h-3.2V8.4c0-.9.3-1.6 1.6-1.6h1.7V3.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.3h2.8V22z"
      />
    ),
  },
  {
    nome: 'X',
    url: '#',
    icone: (
      <path
        fill="currentColor"
        d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z"
      />
    ),
  },
  {
    nome: 'YouTube',
    url: '#',
    icone: (
      <g>
        <rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" />
        <path d="M10 9v6l5-3z" fill="var(--cor-fundo)" />
      </g>
    ),
  },
]

export function RedesSociais({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex items-center ${className}`} aria-label="Redes sociais">
      {REDES.map((rede) => (
        <li key={rede.nome}>
          <a
            href={rede.url}
            aria-label={`${rede.nome} do Projeto Aurora`}
            className="alvo-toque inline-flex items-center justify-center rounded-campo text-primaria hover:text-primaria-hover"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" focusable="false">
              {rede.icone}
            </svg>
          </a>
        </li>
      ))}
    </ul>
  )
}
