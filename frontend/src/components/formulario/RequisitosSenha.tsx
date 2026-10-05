import { REQUISITOS_SENHA } from '../../features/auth/esquemas'

/** Requisitos da senha, marcados conforme a pessoa digita (ícone + texto, não só cor). */
export function RequisitosSenha({ senha }: { senha: string }) {
  return (
    <ul className="mt-1 flex flex-col gap-1" aria-label="Requisitos da senha">
      {REQUISITOS_SENHA.map((requisito) => {
        const atende = requisito.atende(senha)
        return (
          <li
            key={requisito.id}
            className={`flex items-center gap-2 text-sm ${atende ? 'text-primaria' : 'text-texto-suave'}`}
          >
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
              {atende ? (
                <path fill="currentColor" d="m9 16.2-3.5-3.5L4 14.1l5 5 11-11-1.4-1.4z" />
              ) : (
                <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
              )}
            </svg>
            <span>
              {requisito.texto}
              <span className="sr-only">{atende ? ' (atendido)' : ' (pendente)'}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
