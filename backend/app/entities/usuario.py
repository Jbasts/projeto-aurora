import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.entities.comum import (
    PerfilUsuario,
    StatusUsuario,
    coluna_atualizado_em,
    coluna_criado_em,
    coluna_id,
    enum_pg,
)


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = coluna_id()
    nome: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(CITEXT, unique=True)
    telefone: Mapped[str | None] = mapped_column(String(20))
    # Endereço (obrigatório no cadastro; nulo nas contas criadas antes dele ou por script)
    cep: Mapped[str | None] = mapped_column(String(9))
    logradouro: Mapped[str | None] = mapped_column(String(200))
    numero: Mapped[str | None] = mapped_column(String(20))
    complemento: Mapped[str | None] = mapped_column(String(100))
    bairro: Mapped[str | None] = mapped_column(String(100))
    cidade: Mapped[str | None] = mapped_column(String(100))
    uf: Mapped[str | None] = mapped_column(String(2))
    email_verificado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    senha_hash: Mapped[str] = mapped_column(String(255))
    perfil: Mapped[PerfilUsuario] = mapped_column(
        enum_pg(PerfilUsuario, "perfil_usuario"),
        default=PerfilUsuario.PADRAO,
        server_default=PerfilUsuario.PADRAO.value,
    )
    status: Mapped[StatusUsuario] = mapped_column(
        enum_pg(StatusUsuario, "status_usuario"),
        default=StatusUsuario.PENDENTE,
        server_default=StatusUsuario.PENDENTE.value,
        index=True,
    )
    tentativas_falhas: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    bloqueado_ate: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    criado_em: Mapped[datetime] = coluna_criado_em()
    atualizado_em: Mapped[datetime] = coluna_atualizado_em()


class TokenRedefinicaoSenha(Base):
    __tablename__ = "tokens_redefinicao_senha"

    id: Mapped[uuid.UUID] = coluna_id()
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    usado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    criado_em: Mapped[datetime] = coluna_criado_em()


class TokenVerificacaoEmail(Base):
    __tablename__ = "tokens_verificacao_email"

    id: Mapped[uuid.UUID] = coluna_id()
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    usado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    criado_em: Mapped[datetime] = coluna_criado_em()
