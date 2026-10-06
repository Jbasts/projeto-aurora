import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.entities import PerfilUsuario, StatusUsuario
from app.schemas.autenticacao import ComConfirmacaoDeSenha
from app.schemas.comum import Telefone, TextoAparado


class UsuarioGestaoSaida(BaseModel):
    """Linha da tela Gerenciar usuários."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nome: str
    email: str
    telefone: str | None
    perfil: PerfilUsuario
    status: StatusUsuario
    criado_em: datetime


class PaginaUsuarios(BaseModel):
    itens: list[UsuarioGestaoSaida]
    total: int
    pagina: int
    tamanho: int


class AlterarUsuarioEntrada(BaseModel):
    """Aprovar, recusar, inativar e reativar mudam o status; o perfil pode mudar junto."""

    perfil: PerfilUsuario | None = None
    status: StatusUsuario | None = None

    @model_validator(mode="after")
    def _algo_para_alterar(self) -> "AlterarUsuarioEntrada":
        if self.perfil is None and self.status is None:
            raise ValueError("Informe o perfil ou o status.")
        if self.status == StatusUsuario.PENDENTE:
            raise ValueError("Uma conta não pode voltar para pendente.")
        return self


class MeuPerfilEntrada(BaseModel):
    nome: TextoAparado = Field(min_length=2, max_length=150)
    telefone: Telefone = None


class TrocarSenhaEntrada(ComConfirmacaoDeSenha):
    senha_atual: str = Field(max_length=128)
    # senha (nova) e confirmar_senha vêm de ComConfirmacaoDeSenha
