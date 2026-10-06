/** Botão que abre o seletor de fotos (JPG, PNG ou WEBP). */
export function CampoArquivo({
  rotulo,
  multiplo = false,
  aoEscolher,
}: {
  rotulo: string
  multiplo?: boolean
  aoEscolher: (arquivos: FileList | null) => void
}) {
  return (
    <label className="alvo-toque inline-flex w-fit cursor-pointer items-center gap-2 rounded-botao border border-borda-campo bg-fundo px-4 font-semibold text-texto focus-within:outline-3 focus-within:outline-primaria hover:bg-fundo-topo">
      <svg viewBox="0 0 24 24" className="size-5 text-primaria" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 8.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 3h6l1.8 2H20a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3.2zm.9 2L8.1 7H4v11h16V7h-4.1l-1.8-2z"
        />
      </svg>
      {rotulo}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiplo}
        className="sr-only"
        onChange={(e) => {
          aoEscolher(e.target.files)
          e.target.value = ''
        }}
      />
    </label>
  )
}
