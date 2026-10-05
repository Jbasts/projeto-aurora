import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.entities.comum import coluna_criado_em, coluna_id


class Avistamento(Base):
    """Registro de que uma PSDR foi vista em um ponto do mapa, em uma data e hora."""

    __tablename__ = "avistamentos"
    __table_args__ = (
        CheckConstraint("latitude BETWEEN -90 AND 90", name="latitude_valida"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="longitude_valida"),
    )

    id: Mapped[uuid.UUID] = coluna_id()
    pessoa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pessoas.id"))
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    endereco: Mapped[str | None] = mapped_column(Text)
    visto_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    observacao: Mapped[str | None] = mapped_column(Text)
    registrado_por_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id")
    )
    criado_em: Mapped[datetime] = coluna_criado_em()


# Histórico da pessoa, do mais recente para o mais antigo.
Index(
    "ix_avistamentos_pessoa_id_visto_em",
    Avistamento.pessoa_id,
    Avistamento.visto_em.desc(),
)
