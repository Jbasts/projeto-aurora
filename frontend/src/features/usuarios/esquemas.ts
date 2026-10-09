import { z } from 'zod'

import {
  celular,
  cpfValido,
  MENSAGEM_SENHAS_DIFERENTES,
  senhaForte,
  sobrenome,
} from '../auth/esquemas'
import { camposEndereco } from '../enderecos/esquemas'

// Espelham app/schemas/usuarios.py.

export const esquemaMeusDados = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome.').max(150, 'Use no máximo 150 caracteres.'),
  sobrenome,
  telefone: celular,
  ...camposEndereco,
})

export const esquemaTrocarSenha = z
  .object({
    senha_atual: z.string().min(1, 'Informe sua senha atual.'),
    senha: senhaForte,
    confirmar_senha: z.string(),
  })
  .refine((d) => d.senha === d.confirmar_senha, {
    message: MENSAGEM_SENHAS_DIFERENTES,
    path: ['confirmar_senha'],
  })

export type DadosMeusDados = z.infer<typeof esquemaMeusDados>
export type DadosTrocarSenha = z.infer<typeof esquemaTrocarSenha>

const emailOpcional = z
  .string()
  .trim()
  .refine((t) => t === '' || z.email().safeParse(t).success, 'Informe um email válido.')

const cpfOpcional = z
  .string()
  .trim()
  .refine((t) => t === '' || cpfValido(t), 'Informe um CPF válido.')

export const MENSAGEM_NADA_PARA_ALTERAR = 'Informe o novo email, o novo CPF ou os dois.'

/** Meu perfil → "Alterar email ou CPF". */
export const esquemaPedidoAlteracao = z
  .object({
    email: emailOpcional,
    cpf: cpfOpcional,
    senha: z.string().min(1, 'Informe sua senha.'),
  })
  .refine((d) => d.email !== '' || d.cpf !== '', {
    message: MENSAGEM_NADA_PARA_ALTERAR,
    path: ['email'],
  })

/** Dados do usuário → "Completar dados" (contas antigas). */
export const esquemaCompletarDados = z
  .object({
    sobrenome: z
      .string()
      .trim()
      .refine((t) => t === '' || t.length >= 2, 'Use pelo menos 2 caracteres.')
      .refine((t) => t.length <= 150, 'Use no máximo 150 caracteres.'),
    cpf: cpfOpcional,
  })
  .refine((d) => d.sobrenome !== '' || d.cpf !== '', {
    message: 'Informe o sobrenome, o CPF ou os dois.',
    path: ['sobrenome'],
  })

export type DadosPedidoAlteracao = z.infer<typeof esquemaPedidoAlteracao>
export type DadosCompletarDados = z.infer<typeof esquemaCompletarDados>
