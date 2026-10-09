import uuid

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.entities import SolicitacaoAlteracao, StatusSolicitacao, TipoSolicitacao

ABERTAS = (StatusSolicitacao.AGUARDANDO_EMAIL, StatusSolicitacao.PENDENTE)


def adicionar(sessao: Session, solicitacao: SolicitacaoAlteracao) -> SolicitacaoAlteracao:
    sessao.add(solicitacao)
    sessao.flush()
    return solicitacao


def buscar_para_alterar(sessao: Session, solicitacao_id: uuid.UUID) -> SolicitacaoAlteracao | None:
    """Busca travando a linha até o fim da transação (decisões simultâneas esperam)."""
    return sessao.get(
        SolicitacaoAlteracao, solicitacao_id, with_for_update=True, populate_existing=True
    )


def aberta_para_alterar(
    sessao: Session, usuario_id: uuid.UUID, tipo: TipoSolicitacao
) -> SolicitacaoAlteracao | None:
    return sessao.scalar(
        select(SolicitacaoAlteracao)
        .where(
            SolicitacaoAlteracao.usuario_id == usuario_id,
            SolicitacaoAlteracao.tipo == tipo,
            SolicitacaoAlteracao.status.in_(ABERTAS),
        )
        .with_for_update()
    )


def listar(
    sessao: Session,
    *,
    status: StatusSolicitacao | None,
    tipo: TipoSolicitacao | None,
    pagina: int,
    tamanho: int,
) -> tuple[list[SolicitacaoAlteracao], int]:
    """Pendentes primeiro, depois da mais recente para a mais antiga."""
    filtros = []
    if status is not None:
        filtros.append(SolicitacaoAlteracao.status == status)
    if tipo is not None:
        filtros.append(SolicitacaoAlteracao.tipo == tipo)

    total = (
        sessao.scalar(select(func.count()).select_from(SolicitacaoAlteracao).where(*filtros)) or 0
    )
    itens = sessao.scalars(
        select(SolicitacaoAlteracao)
        .options(selectinload(SolicitacaoAlteracao.usuario))
        .where(*filtros)
        .order_by(
            case((SolicitacaoAlteracao.status == StatusSolicitacao.PENDENTE, 0), else_=1),
            SolicitacaoAlteracao.criado_em.desc(),
            SolicitacaoAlteracao.id,
        )
        .offset((pagina - 1) * tamanho)
        .limit(tamanho)
    ).all()
    return list(itens), total
