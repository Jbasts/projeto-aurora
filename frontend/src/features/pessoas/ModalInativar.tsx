import { useState } from 'react'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../../api/cliente'
import { Alerta } from '../../components/Alerta'
import { Botao } from '../../components/Botao'
import { CampoAreaTexto } from '../../components/formulario/CampoAreaTexto'
import { Modal } from '../../components/Modal'
import { useInativarPessoa } from './api'
import { nomeCompleto } from './nomes'

interface PessoaInativavel {
  id: string
  nome: string
  sobrenome: string
}

/** Confirmação com motivo opcional (seção 3.7). Usado no perfil e na busca. */
export function ModalInativar({
  pessoa,
  aoFechar,
  aoConcluir,
}: {
  pessoa: PessoaInativavel
  aoFechar: () => void
  aoConcluir: () => void
}) {
  const inativar = useInativarPessoa()
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  return (
    <Modal titulo={`Inativar ${nomeCompleto(pessoa)}`} aoFechar={aoFechar}>
      <p className="text-texto">
        A pessoa deixa de aparecer no mapa e no mapa de calor, e pessoas usuárias não a encontram
        mais. O cadastro não é apagado e pode ser reativado depois.
      </p>
      <CampoAreaTexto
        rotulo="Motivo (opcional)"
        rows={3}
        maxLength={500}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Botao variante="secundario" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Botao
          carregando={inativar.isPending}
          onClick={async () => {
            setErro(null)
            try {
              await inativar.mutateAsync({ id: pessoa.id, motivo })
              aoConcluir()
            } catch (e) {
              setErro(e instanceof ErroApi ? e.message : MENSAGEM_SEM_CONEXAO)
            }
          }}
        >
          Inativar
        </Botao>
      </div>
    </Modal>
  )
}
