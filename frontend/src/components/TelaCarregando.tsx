export function TelaCarregando({ mensagem = 'Carregando…' }: { mensagem?: string }) {
  return (
    <div role="status" className="flex min-h-[50vh] items-center justify-center p-8">
      <span
        className="mr-3 size-6 animate-spin rounded-full border-4 border-divisor border-t-primaria"
        aria-hidden="true"
      />
      <span className="text-texto-suave">{mensagem}</span>
    </div>
  )
}
