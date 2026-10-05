import { Link } from 'react-router'

// Provisória: o formulário de login entra na Fase 2. Serve para visualizar o layout de autenticação.
export function PaginaLogin() {
  return (
    <div className="mx-auto w-full max-w-md text-center">
      <h1 className="mb-4 text-2xl font-semibold text-texto md:text-3xl">Entrar</h1>
      <p className="text-texto-suave">O login estará disponível em breve.</p>
      <Link
        to="/"
        className="alvo-toque mt-4 inline-flex items-center font-medium text-primaria underline"
      >
        Ir para o início
      </Link>
    </div>
  )
}
