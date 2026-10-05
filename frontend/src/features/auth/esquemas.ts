import { z } from 'zod'

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

const senhaForte = z
  .string()
  .max(128, 'Use no máximo 128 caracteres.')
  .refine((s) => REQUISITOS_SENHA.every((r) => r.atende(s)), MENSAGEM_REQUISITOS_SENHA)

const telefone = z
  .string()
  .trim()
  .refine((t) => {
    const digitos = t.replace(/\D/g, '').length
    return digitos === 0 || digitos === 10 || digitos === 11
  }, 'Informe o telefone com DDD, no formato (00) 00000-0000.')

const MENSAGEM_SENHAS_DIFERENTES = 'As senhas não são iguais.'

export const esquemaLogin = z.object({
  email: z.string().trim().min(1, 'Informe seu email.'),
  senha: z.string().min(1, 'Informe sua senha.'),
})

export const esquemaCadastro = z
  .object({
    nome: z.string().trim().min(2, 'Informe seu nome.').max(150, 'Use no máximo 150 caracteres.'),
    email,
    telefone,
    senha: senhaForte,
    confirmar_senha: z.string(),
  })
  .refine((d) => d.senha === d.confirmar_senha, {
    message: MENSAGEM_SENHAS_DIFERENTES,
    path: ['confirmar_senha'],
  })

export const esquemaRecuperarSenha = z.object({ email })

export const esquemaRedefinirSenha = z
  .object({ senha: senhaForte, confirmar_senha: z.string() })
  .refine((d) => d.senha === d.confirmar_senha, {
    message: MENSAGEM_SENHAS_DIFERENTES,
    path: ['confirmar_senha'],
  })

export type DadosLogin = z.infer<typeof esquemaLogin>
export type DadosCadastro = z.infer<typeof esquemaCadastro>
export type DadosRecuperarSenha = z.infer<typeof esquemaRecuperarSenha>
export type DadosRedefinirSenha = z.infer<typeof esquemaRedefinirSenha>
