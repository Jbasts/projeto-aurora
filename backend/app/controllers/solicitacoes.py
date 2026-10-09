import uuid

from sqlalchemy.orm import Session

from app.entities import SolicitacaoAlteracao, StatusSolicitacao, TipoSolicitacao, Usuario
from app.repositories import usuarios as repositorio_usuarios
from app.schemas.comum import formatar_cpf
from app.schemas.solicitacoes import ContaDaSolicitacao, PaginaSolicitacoes, SolicitacaoSaida
from app.services import solicitacoes as servico
from app.services.arquivos import url_assinada_conta


def _cpf(valor: str | None) -> str | None:
    return formatar_cpf(valor) if valor else None


def _saida(solicitacao: SolicitacaoAlteracao, nomes: dict[uuid.UUID, str]) -> SolicitacaoSaida:
    conta = solicitacao.usuario
    eh_cpf = solicitacao.tipo == TipoSolicitacao.CPF
    return SolicitacaoSaida(
        id=solicitacao.id,
        tipo=solicitacao.tipo,
        status=solicitacao.status,
        usuario=ContaDaSolicitacao(
            id=conta.id,
            nome_completo=conta.nome_completo,
            foto_miniatura_url=(
                url_assinada_conta(conta.foto_id, "miniatura") if conta.foto_id else None
            ),
        ),
        valor_atual=_cpf(conta.cpf) if eh_cpf else conta.email,
        valor_novo=_cpf(solicitacao.valor_novo) if eh_cpf else solicitacao.valor_novo,
        criado_em=solicitacao.criado_em,
        email_confirmado_em=solicitacao.email_confirmado_em,
        decidido_em=solicitacao.decidido_em,
        decidido_por=nomes.get(solicitacao.decidido_por_id)
        if solicitacao.decidido_por_id
        else None,
    )


def listar(
    sessao: Session,
    status: StatusSolicitacao | None,
    tipo: TipoSolicitacao | None,
    pagina: int,
    tamanho: int,
) -> PaginaSolicitacoes:
    itens, total = servico.listar(sessao, status, tipo, pagina, tamanho)
    nomes = repositorio_usuarios.nomes_por_id(
        sessao, {s.decidido_por_id for s in itens if s.decidido_por_id}
    )
    return PaginaSolicitacoes(
        itens=[_saida(s, nomes) for s in itens], total=total, pagina=pagina, tamanho=tamanho
    )


def decidir(
    sessao: Session, admin: Usuario, solicitacao_id: uuid.UUID, aprovar: bool, ip: str | None
) -> SolicitacaoSaida:
    solicitacao = servico.decidir(sessao, admin, solicitacao_id, aprovar, ip)
    return _saida(solicitacao, {admin.id: admin.nome_completo})
