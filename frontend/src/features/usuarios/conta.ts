/** Nome e iniciais das contas (pessoas usuárias da plataforma). Contas antigas não têm sobrenome. */
interface ComNomeDeConta {
  nome: string
  sobrenome?: string | null
}

export function nomeDaConta(conta: ComNomeDeConta): string {
  return conta.sobrenome ? `${conta.nome} ${conta.sobrenome}` : conta.nome
}

/** Iniciais para o avatar sem foto (ex.: "Ana Souza" → "AS"; "Ana" → "A"). */
export function iniciaisDaConta(conta: ComNomeDeConta): string {
  const partes = nomeDaConta(conta).trim().split(/\s+/)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : ''
  return `${primeira}${ultima}`.toUpperCase()
}
