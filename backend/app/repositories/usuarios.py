import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.entities import Usuario


def buscar_por_id(sessao: Session, usuario_id: uuid.UUID) -> Usuario | None:
    return sessao.get(Usuario, usuario_id)


def buscar_por_email(sessao: Session, email: str) -> Usuario | None:
    # email é citext: a comparação já ignora maiúsculas.
    return sessao.scalar(select(Usuario).where(Usuario.email == email))


def adicionar(sessao: Session, usuario: Usuario) -> Usuario:
    sessao.add(usuario)
    sessao.flush()
    return usuario
