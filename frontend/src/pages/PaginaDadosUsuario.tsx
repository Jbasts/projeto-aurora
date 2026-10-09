import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { Avatar } from '../components/Avatar'
import { Botao } from '../components/Botao'
import { CampoTexto } from '../components/formulario/CampoTexto'
import { mascaraCpf } from '../components/formulario/mascaras'
import { Modal } from '../components/Modal'
import { TelaCarregando } from '../components/TelaCarregando'
import { TituloPagina } from '../components/TituloPagina'
import {
  formatarData,
  formatarDataHora,
  formatarDataSimples,
  textoIdade,
} from '../features/comum/datas'
import {
  ROTULOS_STATUS_SOLICITACAO,
  ROTULOS_TIPO_SOLICITACAO,
} from '../features/solicitacoes/tipos'
import { useCompletarDados, useUsuario } from '../features/usuarios/api'
import { iniciaisDaConta, nomeDaConta } from '../features/usuarios/conta'
import { esquemaCompletarDados, type DadosCompletarDados } from '../features/usuarios/esquemas'
import { ROTULOS_PERFIL, ROTULOS_STATUS_USUARIO } from '../features/usuarios/perfis'
import type { UsuarioDetalhe } from '../features/usuarios/tipos'
import { useTituloDocumento } from '../hooks/useTituloDocumento'
import { PaginaNaoEncontrada } from './PaginaNaoEncontrada'

type Aviso = { tipo: 'sucesso' | 'erro'; texto: string } | null

const estiloSecao = 'flex flex-col gap-4 rounded-card border border-divisor p-5 md:p-6'
const estiloVoltar =
  'alvo-toque inline-flex items-center self-start text-sm font-semibold text-primaria underline underline-offset-2 hover:text-primaria-hover'

/** /usuarios/:id — todos os dados de uma conta, só para ADMIN. Abrir a tela gera auditoria. */
export function PaginaDadosUsuario() {
  useTituloDocumento('Dados do usuário')
  const { id = '' } = useParams()
  const consulta = useUsuario(id)

  if (consulta.isPending) return <TelaCarregando />
  if (consulta.isError) {
    if (consulta.error instanceof ErroApi && consulta.error.status === 404) {
      return <PaginaNaoEncontrada />
    }
    return (
      <Alerta tipo="erro">Não foi possível carregar o usuário. {consulta.error.message}</Alerta>
    )
  }
  return <DadosUsuario usuario={consulta.data} />
}

function mensagemDeErro(e: unknown): string {
  if (e instanceof ErroApi) return e.campos[0]?.mensagem ?? e.message
  return MENSAGEM_SEM_CONEXAO
}

function DadosUsuario({ usuario }: { usuario: UsuarioDetalhe }) {
  const nome = nomeDaConta(usuario)
  const rua = [usuario.logradouro, usuario.numero].filter(Boolean).join(', ')
  const cidade = [usuario.cidade, usuario.uf].filter(Boolean).join('/')
  const [aviso, setAviso] = useState<Aviso>(null)
  const [completando, setCompletando] = useState(false)
  const faltaDado = !usuario.sobrenome || !usuario.cpf

  return (
    <>
      <TituloPagina texto="Dados do" destaque="usuário" />
      <div className="flex flex-col gap-6">
        <Link to="/usuarios" className={estiloVoltar}>
          Voltar para Gerenciar usuários
        </Link>
        <p className="text-sm text-texto-suave">
          Dados pessoais protegidos pela LGPD. Use somente para a gestão do projeto; esta consulta
          fica registrada na auditoria.
        </p>

        <div className="flex items-center gap-4">
          <Avatar
            url={usuario.foto_url}
            iniciais={iniciaisDaConta(usuario)}
            alt={usuario.foto_url ? `Foto de ${nome}` : `Sem foto: ${nome}`}
            tamanho="grande"
          />
          <div className="flex flex-col">
            <span className="text-xl font-semibold text-texto">{nome}</span>
            <span className="text-sm text-texto-suave">{ROTULOS_PERFIL[usuario.perfil]}</span>
            {!usuario.foto_url && (
              <span className="text-sm text-texto-suave">Conta ainda sem foto.</span>
            )}
          </div>
        </div>

        {aviso && <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>}

        <SolicitacoesAbertas usuario={usuario} />

        <div className="grid gap-6 lg:grid-cols-2">
          <Secao titulo="Dados pessoais">
            <Lista>
              <Item rotulo="Nome">{usuario.nome}</Item>
              <Item rotulo="Sobrenome">{usuario.sobrenome}</Item>
              <Item rotulo="CPF">{usuario.cpf}</Item>
              <Item rotulo="Data de nascimento">
                {usuario.data_nascimento && formatarDataSimples(usuario.data_nascimento)}
              </Item>
              <Item rotulo="Idade">{usuario.idade !== null && textoIdade(usuario.idade)}</Item>
            </Lista>
            {faltaDado && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-texto-suave">
                  Conta criada antes de sobrenome e CPF serem obrigatórios.
                </p>
                <Botao
                  variante="secundario"
                  className="self-start"
                  onClick={() => {
                    setAviso(null)
                    setCompletando(true)
                  }}
                >
                  Completar dados
                </Botao>
              </div>
            )}
          </Secao>

          <Secao titulo="Contato">
            <Lista>
              <Item rotulo="Email">
                <span className="break-all">{usuario.email}</span>
              </Item>
              <Item rotulo="Email confirmado">
                {usuario.email_verificado_em
                  ? `Sim, em ${formatarDataHora(usuario.email_verificado_em)}`
                  : 'Ainda não'}
              </Item>
              <Item rotulo="Celular">{usuario.telefone}</Item>
            </Lista>
          </Secao>

          <Secao titulo="Endereço">
            <Lista>
              <Item rotulo="CEP">{usuario.cep}</Item>
              <Item rotulo="Rua e número">{rua}</Item>
              <Item rotulo="Complemento">{usuario.complemento}</Item>
              <Item rotulo="Bairro">{usuario.bairro}</Item>
              <Item rotulo="Cidade/UF">{cidade}</Item>
            </Lista>
          </Secao>

          <Secao titulo="Conta">
            <Lista>
              <Item rotulo="Nome completo">{nome}</Item>
              <Item rotulo="Perfil de acesso">{ROTULOS_PERFIL[usuario.perfil]}</Item>
              <Item rotulo="Status">{ROTULOS_STATUS_USUARIO[usuario.status]}</Item>
              <Item rotulo="Criado em">{formatarData(usuario.criado_em)}</Item>
              <Item rotulo="Última alteração">{formatarDataHora(usuario.atualizado_em)}</Item>
            </Lista>
          </Secao>
        </div>
      </div>

      {completando && (
        <ModalCompletarDados
          usuario={usuario}
          aoFechar={() => setCompletando(false)}
          aoSalvar={() => {
            setCompletando(false)
            setAviso({ tipo: 'sucesso', texto: 'Dados completados.' })
          }}
        />
      )}
    </>
  )
}

/** Solicitações em aberto da conta; a decisão fica na tela Solicitações. */
function SolicitacoesAbertas({ usuario }: { usuario: UsuarioDetalhe }) {
  if (usuario.solicitacoes_abertas.length === 0) return null
  return (
    <section aria-label="Solicitações em aberto" className={`${estiloSecao} border-primaria`}>
      <h2 className="text-lg font-semibold text-texto">Solicitações em aberto</h2>
      <ul className="flex flex-col gap-1 text-sm text-texto">
        {usuario.solicitacoes_abertas.map((s) => (
          <li key={s.id}>
            Troca de {ROTULOS_TIPO_SOLICITACAO[s.tipo]} para{' '}
            <span className="font-semibold break-all">{s.valor_novo}</span> —{' '}
            {ROTULOS_STATUS_SOLICITACAO[s.status].toLowerCase()}, pedida em{' '}
            {formatarDataHora(s.criado_em)}
          </li>
        ))}
      </ul>
      <Link to="/solicitacoes" className={estiloVoltar}>
        Ir para Solicitações
      </Link>
    </section>
  )
}

const CAMPOS_COMPLETAR = ['sobrenome', 'cpf'] as const

function ModalCompletarDados({
  usuario,
  aoFechar,
  aoSalvar,
}: {
  usuario: UsuarioDetalhe
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const completar = useCompletarDados(usuario.id)
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DadosCompletarDados>({
    resolver: zodResolver(esquemaCompletarDados),
    defaultValues: { sobrenome: '', cpf: '' },
  })
  const cpf = register('cpf')

  const enviar = handleSubmit(async (dados) => {
    setErro(null)
    try {
      // Só manda o que estava vazio: o que já existe não é substituído.
      await completar.mutateAsync({
        sobrenome: usuario.sobrenome ? '' : dados.sobrenome,
        cpf: usuario.cpf ? '' : dados.cpf,
      })
      aoSalvar()
    } catch (e) {
      if (e instanceof ErroApi && e.campos.length > 0) {
        for (const { campo, mensagem } of e.campos) {
          const nome = CAMPOS_COMPLETAR.find((c) => c === campo)
          if (nome) setError(nome, { message: mensagem }, { shouldFocus: true })
          else setErro(mensagem)
        }
      } else {
        setErro(mensagemDeErro(e))
      }
    }
  })

  return (
    <Modal titulo={`Completar dados de ${nomeDaConta(usuario)}`} aoFechar={aoFechar}>
      <p className="text-sm text-texto-suave">
        Preencha só o que falta. Depois de salvo, o CPF só muda por pedido da própria pessoa.
      </p>
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {!usuario.sobrenome && (
          <CampoTexto
            rotulo="Sobrenome"
            erro={errors.sobrenome?.message}
            {...register('sobrenome')}
          />
        )}
        {!usuario.cpf && (
          <CampoTexto
            rotulo="CPF"
            inputMode="numeric"
            placeholder="000.000.000-00"
            maxLength={14}
            erro={errors.cpf?.message}
            {...cpf}
            onChange={(evento) => {
              evento.target.value = mascaraCpf(evento.target.value)
              return cpf.onChange(evento)
            }}
          />
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={completar.isPending}>
            Salvar
          </Botao>
        </div>
      </form>
    </Modal>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className={estiloSecao}>
      <h2 className="text-lg font-semibold text-texto">{titulo}</h2>
      {children}
    </section>
  )
}

function Lista({ children }: { children: ReactNode }) {
  return <dl className="grid gap-3 text-sm sm:grid-cols-2">{children}</dl>
}

/** Campo vazio aparece como "Não informado" (contas antigas não têm todos os dados). */
function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-texto-suave">{rotulo}</dt>
      <dd className="text-texto">
        {children || <span className="text-texto-suave">Não informado</span>}
      </dd>
    </div>
  )
}
