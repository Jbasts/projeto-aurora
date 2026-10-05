import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, ForeignKey, Identity, Index, String
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.entities.comum import coluna_criado_em


class LogAuditoria(Base):
    """Trilha de auditoria. `detalhes` nunca pode conter dados pessoais de PSDR, só IDs."""

    __tablename__ = "logs_auditoria"
    __table_args__ = (Index("ix_logs_auditoria_criado_em", "criado_em"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id"), index=True
    )
    acao: Mapped[str] = mapped_column(String(60), index=True)
    entidade: Mapped[str | None] = mapped_column(String(60))
    entidade_id: Mapped[str | None] = mapped_column(String(64))
    detalhes: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    ip: Mapped[str | None] = mapped_column(INET)
    criado_em: Mapped[datetime] = coluna_criado_em()
