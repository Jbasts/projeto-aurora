import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class PerfilUsuario(enum.StrEnum):
    ADMIN = "ADMIN"
    COLABORADOR = "COLABORADOR"
    PADRAO = "PADRAO"


class StatusUsuario(enum.StrEnum):
    PENDENTE = "PENDENTE"
    ATIVO = "ATIVO"
    INATIVO = "INATIVO"


class StatusPessoa(enum.StrEnum):
    ATIVA = "ATIVA"
    INATIVA = "INATIVA"


class TipoFoto(enum.StrEnum):
    PERFIL = "PERFIL"
    ALBUM = "ALBUM"


def enum_pg(classe: type[enum.Enum], nome: str) -> Enum:
    """Enum nativo do PostgreSQL que grava o valor (ex.: 'ADMIN')."""
    return Enum(classe, name=nome, values_callable=lambda c: [m.value for m in c])


def coluna_id() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )


def coluna_criado_em() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


def coluna_atualizado_em() -> Mapped[datetime]:
    return mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
