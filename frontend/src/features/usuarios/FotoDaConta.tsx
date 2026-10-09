import { useState } from 'react'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../../api/cliente'
import { Alerta } from '../../components/Alerta'
import { Avatar } from '../../components/Avatar'
import { CampoArquivo } from '../../components/formulario/CampoArquivo'
import { useAutenticacao, useUsuarioLogado } from '../../contexts/autenticacao'
import { fotoConta } from '../auth/esquemas'
import { useTrocarFoto } from './api'
import { iniciaisDaConta, nomeDaConta } from './conta'

type Aviso = { tipo: 'sucesso' | 'erro'; texto: string } | null

/** Meu perfil: foto da conta (obrigatória). Contas antigas sem foto veem um aviso. */
export function FotoDaConta() {
  const usuario = useUsuarioLogado()
  const { atualizarUsuario } = useAutenticacao()
  const trocar = useTrocarFoto()
  const [aviso, setAviso] = useState<Aviso>(null)

  const enviar = async (arquivos: FileList | null) => {
    const arquivo = arquivos?.[0]
    if (!arquivo) return
    setAviso(null)
    const validacao = fotoConta.safeParse(arquivo)
    if (!validacao.success) {
      setAviso({ tipo: 'erro', texto: validacao.error.issues[0].message })
      return
    }
    try {
      atualizarUsuario(await trocar.mutateAsync(arquivo))
      setAviso({ tipo: 'sucesso', texto: 'Foto atualizada.' })
    } catch (e) {
      const texto =
        e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : MENSAGEM_SEM_CONEXAO
      setAviso({ tipo: 'erro', texto })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!usuario.foto_url && !aviso && (
        <Alerta tipo="info">
          Sua conta ainda não tem foto. Envie uma foto do seu rosto: ela ajuda a equipe do projeto a
          reconhecer você.
        </Alerta>
      )}
      {aviso && <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>}
      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          url={usuario.foto_url}
          iniciais={iniciaisDaConta(usuario)}
          alt={`Foto de ${nomeDaConta(usuario)}`}
          tamanho="grande"
        />
        <div className="flex flex-col gap-1">
          <CampoArquivo
            rotulo={
              trocar.isPending ? 'Enviando…' : usuario.foto_url ? 'Trocar foto' : 'Enviar foto'
            }
            aoEscolher={enviar}
          />
          <p className="text-sm text-texto-suave">JPG, PNG ou WEBP, até 5 MB.</p>
        </div>
      </div>
    </div>
  )
}
