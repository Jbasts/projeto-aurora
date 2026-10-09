import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.entities.comum import (
    PerfilUsuario,
    StatusSolicitacao,
    StatusUsuario,
    TipoSolicitacao,
    coluna_atualizado_em,
    coluna_criado_em,
    coluna_id,
    enum_pg,
)


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = coluna_id()
    nome: Mapped[str] = mapped_column(String(150))
    # sobrenome e cpf: obrigatórios no cadastro; nulos nas contas antigas e nas criadas por script
    sobrenome: Mapped[str | None] = mapped_column(String(150))
    cpf: Mapped[str | None] = mapped_column(String(11), unique=True)  # só os dígitos
    email: Mapped[str] = mapped_column(CITEXT, unique=True)
    # Foto da conta: arquivos {foto_id}.webp e {foto_id}_miniatura.webp em UPLOAD_DIR.
    # Obrigatória no cadastro; nula nas contas antigas e nas criadas por script.
    foto_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), unique=True)
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

    # Solicitações de troca de email e CPF, da mais recente para a mais antiga.
    solicitacoes: Mapped[list["SolicitacaoAlteracao"]] = relationship(
        foreign_keys="SolicitacaoAlteracao.usuario_id",
        order_by="(SolicitacaoAlteracao.criado_em.desc(), SolicitacaoAlteracao.id)",
        viewonly=True,
    )

    @property
    def nome_completo(self) -> str:
        return f"{self.nome} {self.sobrenome}" if self.sobrenome else self.nome

    def _solicitacao_recente(self, tipo: TipoSolicitacao) -> "SolicitacaoAlteracao | None":
        return next((s for s in self.solicitacoes if s.tipo == tipo), None)

    @property
    def solicitacao_email(self) -> "SolicitacaoAlteracao | None":
        return self._solicitacao_recente(TipoSolicitacao.EMAIL)

    @property
    def solicitacao_cpf(self) -> "SolicitacaoAlteracao | None":
        return self._solicitacao_recente(TipoSolicitacao.CPF)

    @property
    def solicitacoes_abertas(self) -> list["SolicitacaoAlteracao"]:
        return [s for s in self.solicitacoes if s.aberta]


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


class TokenTrocaEmail(Base):
    """Link enviado ao email novo de uma solicitação. Aberto, a solicitação vai para ADMIN."""

    __tablename__ = "tokens_troca_email"

    id: Mapped[uuid.UUID] = coluna_id()
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    solicitacao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solicitacoes_alteracao.id", ondelete="CASCADE")
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    usado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    criado_em: Mapped[datetime] = coluna_criado_em()


class SolicitacaoAlteracao(Base):
    """Pedido da própria pessoa para trocar o email ou o CPF. Só vale com aprovação de ADMIN.

    Email: AGUARDANDO_EMAIL (link no email novo) → PENDENTE → APROVADA/RECUSADA.
    CPF: PENDENTE → APROVADA/RECUSADA. Em aberto, a pessoa pode cancelar (CANCELADA).
    """

    __tablename__ = "solicitacoes_alteracao"
    __table_args__ = (
        # No máximo uma solicitação em aberto de cada tipo por conta.
        Index(
            "uq_solicitacoes_alteracao_aberta",
            "usuario_id",
            "tipo",
            unique=True,
            postgresql_where=text("status IN ('AGUARDANDO_EMAIL', 'PENDENTE')"),
        ),
    )

    id: Mapped[uuid.UUID] = coluna_id()
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    tipo: Mapped[TipoSolicitacao] = mapped_column(enum_pg(TipoSolicitacao, "tipo_solicitacao"))
    # Email (minúsculas) ou CPF (só os 11 dígitos).
    valor_novo: Mapped[str] = mapped_column(String(254))
    status: Mapped[StatusSolicitacao] = mapped_column(
        enum_pg(StatusSolicitacao, "status_solicitacao"), index=True
    )
    email_confirmado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decidido_por_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL")
    )
    decidido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    criado_em: Mapped[datetime] = coluna_criado_em()

    usuario: Mapped[Usuario] = relationship(foreign_keys=[usuario_id], viewonly=True)

    @property
    def aberta(self) -> bool:
        return self.status in (StatusSolicitacao.AGUARDANDO_EMAIL, StatusSolicitacao.PENDENTE)
