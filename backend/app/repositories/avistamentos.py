import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.entities import Avistamento, Pessoa, StatusPessoa, Usuario


def adicionar(sessao: Session, avistamento: Avistamento) -> Avistamento:
    sessao.add(avistamento)
    sessao.flush()
    return avistamento


def historico(
    sessao: Session, pessoa_id: uuid.UUID, *, pagina: int, tamanho: int
) -> tuple[list[tuple[Avistamento, Usuario | None]], int]:
    """Avistamentos da pessoa, do mais recente para o mais antigo, com quem registrou."""
    total = (
        sessao.scalar(
            select(func.count()).select_from(Avistamento).where(Avistamento.pessoa_id == pessoa_id)
        )
        or 0
    )
    consulta = (
        select(Avistamento, Usuario)
        .outerjoin(Usuario, Usuario.id == Avistamento.registrado_por_id)
        .where(Avistamento.pessoa_id == pessoa_id)
        .order_by(Avistamento.visto_em.desc(), Avistamento.criado_em.desc(), Avistamento.id)
        .offset((pagina - 1) * tamanho)
        .limit(tamanho)
    )
    return [
        (avistamento, usuario) for avistamento, usuario in sessao.execute(consulta).all()
    ], total


def calor(
    sessao: Session,
    *,
    pessoa_id: uuid.UUID | None,
    de: datetime | None,
    ate: datetime | None,
) -> list[tuple[float, float, int]]:
    """Pontos do mapa de calor: um por coordenada, com o número de avistamentos como peso.

    Sem pessoa, considera só as PSDR ativas (seção 3.10).
    """
    filtros = []
    if pessoa_id is not None:
        filtros.append(Avistamento.pessoa_id == pessoa_id)
    else:
        filtros.append(Pessoa.status == StatusPessoa.ATIVA)
    if de is not None:
        filtros.append(Avistamento.visto_em >= de)
    if ate is not None:
        filtros.append(Avistamento.visto_em <= ate)
    consulta = (
        select(Avistamento.latitude, Avistamento.longitude, func.count())
        .join(Pessoa, Pessoa.id == Avistamento.pessoa_id)
        .where(*filtros)
        .group_by(Avistamento.latitude, Avistamento.longitude)
    )
    return [
        (float(latitude), float(longitude), quantidade)
        for latitude, longitude, quantidade in sessao.execute(consulta).all()
    ]
