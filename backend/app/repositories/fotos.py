import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.entities import Foto, TipoFoto


def buscar_por_id(sessao: Session, foto_id: uuid.UUID) -> Foto | None:
    return sessao.get(Foto, foto_id)


def album(sessao: Session, pessoa_id: uuid.UUID) -> list[Foto]:
    """Fotos do álbum, da mais recente para a mais antiga."""
    return list(
        sessao.scalars(
            select(Foto)
            .where(Foto.pessoa_id == pessoa_id, Foto.tipo == TipoFoto.ALBUM)
            .order_by(Foto.criado_em.desc(), Foto.id)
        )
    )


def contar_album(sessao: Session, pessoa_id: uuid.UUID) -> int:
    return (
        sessao.scalar(
            select(func.count())
            .select_from(Foto)
            .where(Foto.pessoa_id == pessoa_id, Foto.tipo == TipoFoto.ALBUM)
        )
        or 0
    )


def adicionar(sessao: Session, foto: Foto) -> Foto:
    sessao.add(foto)
    sessao.flush()
    return foto


def remover(sessao: Session, foto: Foto) -> None:
    sessao.delete(foto)
    sessao.flush()
