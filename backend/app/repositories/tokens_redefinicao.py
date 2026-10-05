import uuid
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.entities import TokenRedefinicaoSenha


def adicionar(sessao: Session, token: TokenRedefinicaoSenha) -> TokenRedefinicaoSenha:
    sessao.add(token)
    sessao.flush()
    return token


def buscar_por_hash(sessao: Session, token_hash: str) -> TokenRedefinicaoSenha | None:
    return sessao.scalar(
        select(TokenRedefinicaoSenha).where(TokenRedefinicaoSenha.token_hash == token_hash)
    )


def contar_criados_desde(sessao: Session, usuario_id: uuid.UUID, desde: datetime) -> int:
    return (
        sessao.scalar(
            select(func.count())
            .select_from(TokenRedefinicaoSenha)
            .where(
                TokenRedefinicaoSenha.usuario_id == usuario_id,
                TokenRedefinicaoSenha.criado_em >= desde,
            )
        )
        or 0
    )


def invalidar_pendentes(sessao: Session, usuario_id: uuid.UUID, agora: datetime) -> None:
    """Marca como usados todos os tokens ainda não usados da pessoa."""
    sessao.execute(
        update(TokenRedefinicaoSenha)
        .where(
            TokenRedefinicaoSenha.usuario_id == usuario_id,
            TokenRedefinicaoSenha.usado_em.is_(None),
        )
        .values(usado_em=agora)
    )
