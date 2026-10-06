interface AvatarProps {
  /** URL assinada da miniatura; sem foto, mostra as iniciais. */
  url: string | null | undefined
  iniciais: string
  /** Texto alternativo ("Foto de …"). Vazio quando o nome já aparece ao lado. */
  alt: string
  tamanho?: 'pequeno' | 'medio' | 'grande'
}

const tamanhos = {
  pequeno: 'size-10 text-sm',
  medio: 'size-16 text-lg',
  grande: 'size-28 text-3xl md:size-36 md:text-4xl',
}

/** Foto redonda da pessoa ou avatar com iniciais (nunca foto real em dados de teste). */
export function Avatar({ url, iniciais, alt, tamanho = 'medio' }: AvatarProps) {
  const classes = `${tamanhos[tamanho]} shrink-0 rounded-full`
  if (url) {
    return <img src={url} alt={alt} className={`${classes} bg-fundo-topo object-cover`} />
  }
  return (
    <span
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={`${classes} inline-flex items-center justify-center bg-fundo-topo font-semibold text-primaria`}
    >
      {iniciais}
    </span>
  )
}
