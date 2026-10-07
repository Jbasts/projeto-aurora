import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.entities import LogAuditoria, Usuario


def adicionar(sessao: Session, log: LogAuditoria) -> LogAuditoria:
    sessao.add(log)
    sessao.flush()
    return log


def listar(
    sessao: Session,
    *,
    usuario_id: uuid.UUID | None,
    acao: str | None,
    de: datetime | None,
    ate: datetime | None,
    pagina: int,
    tamanho: int,
) -> tuple[list[tuple[LogAuditoria, Usuario | None]], int]:
    filtros = []
    if usuario_id is not None:
        filtros.append(LogAuditoria.usuario_id == usuario_id)
    if acao is not None:
        filtros.append(LogAuditoria.acao == acao)
    if de is not None:
        filtros.append(LogAuditoria.criado_em >= de)
    if ate is not None:
        filtros.append(LogAuditoria.criado_em <= ate)

    total = sessao.scalar(select(func.count()).select_from(LogAuditoria).where(*filtros)) or 0
    consulta = (
        select(LogAuditoria, Usuario)
        .outerjoin(Usuario, Usuario.id == LogAuditoria.usuario_id)
        .where(*filtros)
        .order_by(LogAuditoria.criado_em.desc(), LogAuditoria.id.desc())
        .offset((pagina - 1) * tamanho)
        .limit(tamanho)
    )
    return [(log, usuario) for log, usuario in sessao.execute(consulta).all()], total
