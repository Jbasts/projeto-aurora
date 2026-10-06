import { z } from 'zod'

import { MENSAGEM_SENHAS_DIFERENTES, senhaForte, telefone } from '../auth/esquemas'

// Espelham app/schemas/usuarios.py.

export const esquemaMeusDados = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome.').max(150, 'Use no máximo 150 caracteres.'),
  telefone,
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
