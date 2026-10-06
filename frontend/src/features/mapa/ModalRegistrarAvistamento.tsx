import { useState } from 'react'
import { useNavigate } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../../api/cliente'
import { Alerta } from '../../components/Alerta'
import { Avatar } from '../../components/Avatar'
import { Botao } from '../../components/Botao'
import { CampoAreaTexto } from '../../components/formulario/CampoAreaTexto'
import { CampoTexto } from '../../components/formulario/CampoTexto'
import { Modal } from '../../components/Modal'
import { paraCampoDataHora } from '../comum/datas'
import { iniciais, nomeCompleto } from '../pessoas/nomes'
import { SeletorLocal } from '../pessoas/SeletorLocal'
import type { Coordenadas } from '../pessoas/tipos'
import { useEnderecoAproximado, useRegistrarAvistamento, type Avistamento } from './api'
import { BuscaPessoa } from './BuscaPessoa'

export interface PessoaDoAvistamento {
  id: string
  nome: string
  sobrenome: string
  apelido: string | null
  url_miniatura: string | null
}

/** Estado de navegação para abrir o cadastro com o local já preenchido (etapa 3). */
export interface EstadoCadastroComLocal {
  local?: Coordenadas
}

interface ModalRegistrarAvistamentoProps {
  /** Ponto escolhido no mapa. Sem ele, o modal mostra o seletor de local (uso no perfil). */
  coordenadas?: Coordenadas | null
  /** Pessoa já definida (perfil). Sem ela, o modal mostra a busca (uso no mapa). */
  pessoaFixa?: PessoaDoAvistamento
  aoFechar: () => void
  aoRegistrar: (avistamento: Avistamento, pessoa: PessoaDoAvistamento) => void
}

const formato = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
})

/** Registrar avistamento (seção 3.9): pessoa, local, data e hora, observação. */
export function ModalRegistrarAvistamento({
  coordenadas,
  pessoaFixa,
  aoFechar,
  aoRegistrar,
}: ModalRegistrarAvistamentoProps) {
  const navigate = useNavigate()
  const registrar = useRegistrarAvistamento()

  const [pessoa, setPessoa] = useState<PessoaDoAvistamento | null>(pessoaFixa ?? null)
  const [local, setLocal] = useState<Coordenadas | null>(coordenadas ?? null)
  const [vistoEm, setVistoEm] = useState(() => paraCampoDataHora(new Date()))
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [erroVistoEm, setErroVistoEm] = useState<string | null>(null)

  const endereco = useEnderecoAproximado(local)

  const salvar = async () => {
    setErro(null)
    if (!pessoa) {
      setErro('Escolha quem foi vista.')
      return
    }
    if (!local) {
      setErro('Marque no mapa onde a pessoa foi vista.')
      return
    }
    const data = new Date(vistoEm)
    if (!vistoEm || Number.isNaN(data.getTime())) {
      setErroVistoEm('Informe a data e a hora.')
      return
    }
    if (data.getTime() > Date.now() + 60_000) {
      setErroVistoEm('A data e a hora não podem estar no futuro.')
      return
    }
    setErroVistoEm(null)
    try {
      const avistamento = await registrar.mutateAsync({
        pessoa_id: pessoa.id,
        latitude: local.latitude,
        longitude: local.longitude,
        visto_em: data.toISOString(),
        observacao: observacao.trim() || null,
      })
      aoRegistrar(avistamento, pessoa)
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : MENSAGEM_SEM_CONEXAO)
    }
  }

  const cadastrarNova = () => {
    const estado: EstadoCadastroComLocal = { local: local ?? undefined }
    navigate('/pessoas/nova', { state: estado })
  }

  return (
    <Modal
      titulo={
        pessoaFixa
          ? `Registrar avistamento de ${nomeCompleto(pessoaFixa)}`
          : 'Registrar avistamento'
      }
      aoFechar={aoFechar}
      largo={!coordenadas}
    >
      {pessoa ? (
        <div className="flex items-center gap-3 rounded-campo bg-fundo-topo p-3">
          <Avatar url={pessoa.url_miniatura} iniciais={iniciais(pessoa)} alt="" />
          <span className="flex flex-1 flex-col">
            <span className="font-semibold text-texto">{nomeCompleto(pessoa)}</span>
            {pessoa.apelido && <span className="text-sm text-texto-suave">"{pessoa.apelido}"</span>}
          </span>
          {!pessoaFixa && (
            <Botao variante="secundario" className="px-3 text-sm" onClick={() => setPessoa(null)}>
              Trocar
            </Botao>
          )}
        </div>
      ) : (
        <BuscaPessoa
          aoEscolher={setPessoa}
          semResultado={() => (
            <div className="mt-2 flex flex-col gap-2 rounded-campo border border-divisor p-3">
              <p className="text-sm text-texto">A pessoa ainda não tem cadastro?</p>
              <Botao variante="secundario" onClick={cadastrarNova}>
                Cadastrar nova pessoa
              </Botao>
            </div>
          )}
        />
      )}

      {coordenadas ? (
        <p className="text-sm text-texto">
          <span className="font-medium text-texto-suave">Local: </span>
          {endereco.isPending
            ? 'buscando endereço aproximado…'
            : (endereco.data?.endereco ??
              `${formato.format(coordenadas.latitude)}, ${formato.format(coordenadas.longitude)} (endereço indisponível; serão salvas só as coordenadas)`)}
        </p>
      ) : (
        <>
          <SeletorLocal valor={local} aoMudar={setLocal} />
          {local && endereco.data?.endereco && (
            <p className="text-sm text-texto">
              <span className="font-medium text-texto-suave">Endereço aproximado: </span>
              {endereco.data.endereco}
            </p>
          )}
        </>
      )}

      <CampoTexto
        rotulo="Data e hora em que foi vista"
        type="datetime-local"
        value={vistoEm}
        max={paraCampoDataHora(new Date())}
        erro={erroVistoEm ?? undefined}
        onChange={(e) => setVistoEm(e.target.value)}
      />
      <CampoAreaTexto
        rotulo="Observação (opcional)"
        rows={2}
        maxLength={1000}
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
      />

      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Botao variante="secundario" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Botao carregando={registrar.isPending} onClick={salvar}>
          Salvar avistamento
        </Botao>
      </div>
    </Modal>
  )
}
