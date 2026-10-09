/** Formata enquanto a pessoa digita: (00) 00000-0000 (celular) ou (00) 0000-0000 (fixo). */
export function mascaraTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11)
  if (digitos.length === 0) return ''
  if (digitos.length <= 2) return `(${digitos}`
  const ddd = digitos.slice(0, 2)
  const resto = digitos.slice(2)
  if (resto.length <= 4) return `(${ddd}) ${resto}`
  const meio = digitos.length === 11 ? 5 : 4
  return `(${ddd}) ${resto.slice(0, meio)}-${resto.slice(meio)}`
}

/** Formata enquanto a pessoa digita: 00000-000. */
export function mascaraCep(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 8)
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos
}

/** Formata enquanto a pessoa digita: 000.000.000-00. */
export function mascaraCpf(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}
