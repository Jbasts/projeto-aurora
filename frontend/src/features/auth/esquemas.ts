import { z } from 'zod'

import { calcularIdade, hojeNoCampoData } from '../comum/datas'
import { camposEndereco } from '../enderecos/esquemas'

// Espelham as validações do backend (app/schemas/comum.py e app/schemas/autenticacao.py).

export const REQUISITOS_SENHA = [
  { id: 'tamanho', texto: 'Pelo menos 8 caracteres', atende: (s: string) => s.length >= 8 },
  { id: 'letra', texto: 'Pelo menos uma letra', atende: (s: string) => /\p{L}/u.test(s) },
  { id: 'numero', texto: 'Pelo menos um número', atende: (s: string) => /\d/.test(s) },
] as const

export const MENSAGEM_REQUISITOS_SENHA =
  'A senha precisa ter pelo menos 8 caracteres, com pelo menos uma letra e um número.'

const email = z
  .string()
  .trim()
  .min(1, 'Informe seu email.')
  .pipe(z.email('Informe um email válido.'))

export const senhaForte = z
  .string()
  .max(128, 'Use no máximo 128 caracteres.')
  .refine((s) => REQUISITOS_SENHA.every((r) => r.atende(s)), MENSAGEM_REQUISITOS_SENHA)

export const telefone = z
  .string()
  .trim()
  .refine((t) => {
    const digitos = t.replace(/\D/g, '').length
    return digitos === 0 || digitos === 10 || digitos === 11
  }, 'Informe o telefone com DDD, no formato (00) 00000-0000.')

export const celular = z
  .string()
  .trim()
  .refine(
    (t) => t.replace(/\D/g, '').length === 11,
    'Informe o celular com DDD, no formato (00) 00000-0000.',
  )

export const sobrenome = z
  .string()
  .trim()
  .min(2, 'Informe seu sobrenome.')
  .max(150, 'Use no máximo 150 caracteres.')

/** Mesma regra de app/schemas/comum.py: 11 dígitos, não repetidos, dígitos verificadores. */
export function cpfValido(valor: string): boolean {
  const d = valor.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const verificador = (tamanho: number) => {
    let soma = 0
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return verificador(9) === Number(d[9]) && verificador(10) === Number(d[10])
}

const cpf = z.string().trim().refine(cpfValido, 'Informe um CPF válido.')

/** Mesmas regras de app/schemas/comum.py: não pode ser no futuro nem passar de 120 anos. */
export const dataNascimento = z
  .string()
  .min(1, 'Informe sua data de nascimento.')
  .refine((d) => calcularIdade(d) !== null, 'Informe uma data válida.')
  .refine((d) => d <= hojeNoCampoData(), 'A data de nascimento não pode ser no futuro.')
  .refine((d) => (calcularIdade(d) ?? 0) <= 120, 'Confira a data de nascimento.')

/** Email ou CPF (login e recuperação de senha). */
export function emailOuCpfValido(valor: string): boolean {
  const texto = valor.trim()
  return texto.includes('@') ? z.email().safeParse(texto).success : cpfValido(texto)
}

export const TIPOS_FOTO_CONTA = ['image/jpeg', 'image/png', 'image/webp']
export const TAMANHO_MAXIMO_FOTO_CONTA = 5 * 1024 * 1024

/** Foto da conta: mesmas regras do backend (app/services/fotos.py). */
export const fotoConta = z
  .instanceof(File, { message: 'Envie uma foto sua.' })
  .refine((f) => TIPOS_FOTO_CONTA.includes(f.type), 'Envie uma foto em JPG, PNG ou WEBP.')
  .refine((f) => f.size <= TAMANHO_MAXIMO_FOTO_CONTA, 'A foto deve ter no máximo 5 MB.')

export const MENSAGEM_SENHAS_DIFERENTES = 'As senhas não são iguais.'

export const esquemaLogin = z.object({
  login: z.string().trim().min(1, 'Informe seu email ou CPF.'),
  senha: z.string().min(1, 'Informe sua senha.'),
})

export const esquemaCadastro = z
  .object({
    nome: z.string().trim().min(2, 'Informe seu nome.').max(150, 'Use no máximo 150 caracteres.'),
    sobrenome,
    cpf,
    data_nascimento: dataNascimento,
    email,
    telefone: celular,
    foto: fotoConta,
    senha: senhaForte,
    confirmar_senha: z.string(),
    ...camposEndereco,
  })
  .refine((d) => d.senha === d.confirmar_senha, {
    message: MENSAGEM_SENHAS_DIFERENTES,
    path: ['confirmar_senha'],
  })

export const esquemaRecuperarSenha = z.object({
  login: z
    .string()
    .trim()
    .min(1, 'Informe seu email ou CPF.')
    .refine(emailOuCpfValido, 'Informe um email ou CPF válido.'),
})

export const esquemaReenviarConfirmacao = z.object({ email })

export const esquemaRedefinirSenha = z
  .object({ senha: senhaForte, confirmar_senha: z.string() })
  .refine((d) => d.senha === d.confirmar_senha, {
    message: MENSAGEM_SENHAS_DIFERENTES,
    path: ['confirmar_senha'],
  })

export type DadosLogin = z.infer<typeof esquemaLogin>
export type DadosCadastro = z.infer<typeof esquemaCadastro>
export type DadosRecuperarSenha = z.infer<typeof esquemaRecuperarSenha>
export type DadosReenviarConfirmacao = z.infer<typeof esquemaReenviarConfirmacao>
export type DadosRedefinirSenha = z.infer<typeof esquemaRedefinirSenha>
