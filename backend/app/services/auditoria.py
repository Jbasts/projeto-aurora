import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.entities import LogAuditoria
from app.repositories import auditoria as repositorio


class AcaoAuditoria:
    LOGIN_SUCESSO = "LOGIN_SUCESSO"
    LOGIN_FALHA = "LOGIN_FALHA"
    LOGIN_BLOQUEIO = "LOGIN_BLOQUEIO"


def registrar(
    sessao: Session,
    acao: str,
    *,
    usuario_id: uuid.UUID | None = None,
    entidade: str | None = None,
    entidade_id: uuid.UUID | str | None = None,
    detalhes: dict[str, Any] | None = None,
    ip: str | None = None,
) -> None:
    """Grava um registro de auditoria. `detalhes` nunca pode ter dados pessoais de PSDR."""
    repositorio.adicionar(
        sessao,
        LogAuditoria(
            usuario_id=usuario_id,
            acao=acao,
            entidade=entidade,
            entidade_id=str(entidade_id) if entidade_id is not None else None,
            detalhes=detalhes,
            ip=ip,
        ),
    )
