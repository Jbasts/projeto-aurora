import { z } from 'zod'

// Espelha ComEndereco em app/schemas/comum.py.

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const // prettier-ignore

export const MENSAGEM_CEP = 'Informe o CEP com 8 dígitos, no formato 00000-000.'

export const camposEndereco = {
  cep: z
    .string()
    .trim()
    .refine((c) => c.replace(/\D/g, '').length === 8, MENSAGEM_CEP),
  logradouro: z.string().trim().min(2, 'Informe a rua.').max(200, 'Use no máximo 200 caracteres.'),
  numero: z
    .string()
    .trim()
    .min(1, 'Informe o número (ou S/N).')
    .max(20, 'Use no máximo 20 caracteres.'),
  complemento: z.string().trim().max(100, 'Use no máximo 100 caracteres.'),
  bairro: z.string().trim().max(100, 'Use no máximo 100 caracteres.'),
  cidade: z.string().trim().min(2, 'Informe a cidade.').max(100, 'Use no máximo 100 caracteres.'),
  uf: z.string().refine((uf) => (UFS as readonly string[]).includes(uf), 'Escolha o estado (UF).'),
}

export const esquemaEndereco = z.object(camposEndereco)

export type DadosEndereco = z.infer<typeof esquemaEndereco>

export const NOMES_CAMPOS_ENDERECO = Object.keys(camposEndereco) as (keyof DadosEndereco)[]

export const ENDERECO_VAZIO: DadosEndereco = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
}

/** Valores iniciais a partir dos dados salvos (que podem ser nulos em contas antigas). */
export function enderecoInicial(salvo: {
  [campo in keyof DadosEndereco]: string | null
}): DadosEndereco {
  return Object.fromEntries(
    NOMES_CAMPOS_ENDERECO.map((campo) => [campo, salvo[campo] ?? '']),
  ) as DadosEndereco
}
