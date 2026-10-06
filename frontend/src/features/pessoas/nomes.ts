interface ComNome {
  nome: string
  sobrenome: string
  apelido?: string | null
}

export function nomeCompleto(pessoa: ComNome): string {
  return `${pessoa.nome} ${pessoa.sobrenome}`.trim()
}

/** Texto alternativo das fotos (seção 6): "Foto de {apelido ou nome}". */
export function altFoto(pessoa: ComNome): string {
  return `Foto de ${pessoa.apelido || nomeCompleto(pessoa)}`
}

/** Iniciais para o avatar sem foto (ex.: "João da Conceição" → "JC"). */
export function iniciais(pessoa: ComNome): string {
  const primeira = pessoa.nome.trim()[0] ?? ''
  const partes = pessoa.sobrenome.trim().split(/\s+/)
  const ultima = partes[partes.length - 1]?.[0] ?? ''
  return `${primeira}${ultima}`.toUpperCase()
}
