interface TituloPaginaProps {
  /** Início do título, em texto escuro. */
  texto: string
  /** Trecho final, em verde (ex.: "situação de rua"). */
  destaque: string
}

/** Título de página no estilo do protótipo: final em verde e divisor abaixo. */
export function TituloPagina({ texto, destaque }: TituloPaginaProps) {
  return (
    <div className="mb-8 border-b border-divisor pb-4">
      <h1 className="text-2xl font-semibold text-texto md:text-3xl">
        {texto} <span className="text-primaria">{destaque}</span>
      </h1>
    </div>
  )
}
