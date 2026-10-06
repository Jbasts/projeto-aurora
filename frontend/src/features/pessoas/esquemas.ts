import { z } from 'zod'

import { telefone } from '../auth/esquemas'
import type { DadosPessoaApi } from './tipos'

// Espelham app/schemas/pessoas.py. Os campos do formulário são texto; a conversão para o
// formato da API fica em paraDadosApi.

const opcional = (maximo: number) =>
  z.string().trim().max(maximo, `Use no máximo ${maximo} caracteres.`)

export const esquemaPessoa = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.').max(100, 'Use no máximo 100 caracteres.'),
  sobrenome: z
    .string()
    .trim()
    .min(1, 'Informe o sobrenome.')
    .max(150, 'Use no máximo 150 caracteres.'),
  apelido: opcional(100),
  idade_aproximada: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d{1,3}$/.test(v) && Number(v) <= 130), {
      message: 'Informe uma idade entre 0 e 130.',
    }),
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Informe um email válido.'),
  telefone,
  nome_contato: opcional(150),
  telefone_contato: telefone,
  observacoes: opcional(2000),
  // '' = ainda não respondido (o campo é obrigatório, sem resposta pré-marcada).
  consentimento: z
    .string()
    .refine(
      (v) => v === 'sim' || v === 'nao',
      'Informe se a pessoa autorizou o cadastro e o uso de fotos.',
    ),
})

export type DadosPessoa = z.input<typeof esquemaPessoa>

export const PESSOA_VAZIA: DadosPessoa = {
  nome: '',
  sobrenome: '',
  apelido: '',
  idade_aproximada: '',
  email: '',
  telefone: '',
  nome_contato: '',
  telefone_contato: '',
  observacoes: '',
  consentimento: '',
}

const ouNulo = (valor: string) => valor.trim() || null

export function paraDadosApi(dados: DadosPessoa): DadosPessoaApi {
  return {
    nome: dados.nome.trim(),
    sobrenome: dados.sobrenome.trim(),
    apelido: ouNulo(dados.apelido),
    idade_aproximada: dados.idade_aproximada.trim() ? Number(dados.idade_aproximada) : null,
    email: ouNulo(dados.email),
    telefone: ouNulo(dados.telefone),
    nome_contato: ouNulo(dados.nome_contato),
    telefone_contato: ouNulo(dados.telefone_contato),
    observacoes: ouNulo(dados.observacoes),
    consentimento: dados.consentimento === 'sim',
  }
}

export function paraFormulario(pessoa: DadosPessoaApi): DadosPessoa {
  return {
    nome: pessoa.nome,
    sobrenome: pessoa.sobrenome,
    apelido: pessoa.apelido ?? '',
    idade_aproximada: pessoa.idade_aproximada?.toString() ?? '',
    email: pessoa.email ?? '',
    telefone: pessoa.telefone ?? '',
    nome_contato: pessoa.nome_contato ?? '',
    telefone_contato: pessoa.telefone_contato ?? '',
    observacoes: pessoa.observacoes ?? '',
    consentimento: pessoa.consentimento ? 'sim' : 'nao',
  }
}

// --- Fotos (seção 3.8) ---

export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']
export const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024
export const MAXIMO_FOTOS_ALBUM = 20

/** Mesmas regras do backend, para avisar antes de enviar. */
export function erroDaFoto(arquivo: File): string | null {
  if (!TIPOS_FOTO.includes(arquivo.type)) return 'Envie uma foto em JPG, PNG ou WEBP.'
  if (arquivo.size > TAMANHO_MAXIMO_FOTO) return 'A foto deve ter no máximo 5 MB.'
  return null
}
