import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.entities.comum import (
    StatusPessoa,
    TipoFoto,
    coluna_atualizado_em,
    coluna_criado_em,
    coluna_id,
    enum_pg,
)

# Criados à mão na migração inicial (o autogenerate não compara índices de expressão):
# - função IMMUTABLE texto_busca_pessoa(nome, sobrenome, apelido): texto sem acentos e minúsculo;
# - índice GIN trigram ix_pessoas_busca_trgm sobre essa função.
# Nas consultas, use func.texto_busca_pessoa(Pessoa.nome, Pessoa.sobrenome, Pessoa.apelido)
# para aproveitar o índice.
INDICE_BUSCA_TRGM = "ix_pessoas_busca_trgm"


class Pessoa(Base):
    """Pessoa em situação de rua (PSDR)."""

    __tablename__ = "pessoas"
    __table_args__ = (
        CheckConstraint(
            "idade_aproximada IS NULL OR idade_aproximada BETWEEN 0 AND 130", name="idade_valida"
        ),
        CheckConstraint(
            "ultima_latitude IS NULL OR ultima_latitude BETWEEN -90 AND 90",
            name="ultima_latitude_valida",
        ),
        CheckConstraint(
            "ultima_longitude IS NULL OR ultima_longitude BETWEEN -180 AND 180",
            name="ultima_longitude_valida",
        ),
    )

    id: Mapped[uuid.UUID] = coluna_id()
    nome: Mapped[str] = mapped_column(String(100))
    sobrenome: Mapped[str] = mapped_column(String(150))
    apelido: Mapped[str | None] = mapped_column(String(100))
    idade_aproximada: Mapped[int | None] = mapped_column(SmallInteger)
    email: Mapped[str | None] = mapped_column(String(254))
    telefone: Mapped[str | None] = mapped_column(String(20))
    nome_contato: Mapped[str | None] = mapped_column(String(150))
    telefone_contato: Mapped[str | None] = mapped_column(String(20))
    observacoes: Mapped[str | None] = mapped_column(Text)

    consentimento: Mapped[bool] = mapped_column(Boolean)
    consentimento_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    foto_perfil_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        # use_alter: fotos e pessoas se referenciam; esta FK é criada depois das duas tabelas.
        ForeignKey("fotos.id", ondelete="SET NULL", use_alter=True),
    )

    status: Mapped[StatusPessoa] = mapped_column(
        enum_pg(StatusPessoa, "status_pessoa"),
        default=StatusPessoa.ATIVA,
        server_default=StatusPessoa.ATIVA.value,
        index=True,
    )
    motivo_inativacao: Mapped[str | None] = mapped_column(Text)
    inativada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    inativada_por_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id")
    )

    cadastrada_por_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id")
    )

    # Desnormalizados: espelham o avistamento mais recente (atualizados pelo service).
    ultima_vez_visto: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    ultima_latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    ultima_longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    ultimo_endereco: Mapped[str | None] = mapped_column(Text)

    criado_em: Mapped[datetime] = coluna_criado_em()
    atualizado_em: Mapped[datetime] = coluna_atualizado_em()


class Foto(Base):
    __tablename__ = "fotos"

    id: Mapped[uuid.UUID] = coluna_id()
    pessoa_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pessoas.id"), index=True
    )
    tipo: Mapped[TipoFoto] = mapped_column(enum_pg(TipoFoto, "tipo_foto"))
    caminho: Mapped[str] = mapped_column(String(255))
    caminho_miniatura: Mapped[str] = mapped_column(String(255))
    mime: Mapped[str] = mapped_column(String(50))
    tamanho_bytes: Mapped[int]
    legenda: Mapped[str | None] = mapped_column(String(255))
    enviada_por_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id"))
    criado_em: Mapped[datetime] = coluna_criado_em()
