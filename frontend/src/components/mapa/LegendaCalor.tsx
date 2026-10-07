/** Legenda da escala de cores, com texto (a informação não depende só da cor). */
export function LegendaCalor() {
  return (
    <div className="flex items-center gap-3 text-sm text-texto-suave">
      <span>Menos avistamentos</span>
      <span
        aria-hidden="true"
        className="h-3 w-32 rounded-full"
        style={{
          background:
            'linear-gradient(to right, var(--cor-calor-1), var(--cor-calor-2), var(--cor-calor-3), var(--cor-calor-4))',
        }}
      />
      <span>Mais avistamentos</span>
    </div>
  )
}
