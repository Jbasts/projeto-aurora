import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

from app.entities import PerfilUsuario, StatusUsuario
from app.schemas.comum import ComEndereco, EmailValido, SenhaForte, Telefone, TextoAparado


class UsuarioSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nome: str
    email: str
    telefone: str | None
    cep: str | None
    logradouro: str | None
    numero: str | None
    complemento: str | None
    bairro: str | None
    cidade: str | None
    uf: str | None
    perfil: PerfilUsuario
    status: StatusUsuario


class LoginEntrada(BaseModel):
    # Sem validar formato: qualquer erro de login responde "Email ou senha incorretos."
    email: str = Field(max_length=254)
    senha: str = Field(max_length=128)


class SessaoSaida(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    usuario: UsuarioSaida


class ComConfirmacaoDeSenha(BaseModel):
    senha: SenhaForte
    confirmar_senha: str = Field(max_length=128)

    @field_validator("confirmar_senha")
    @classmethod
    def _senhas_iguais(cls, valor: str, info: ValidationInfo) -> str:
        if "senha" in info.data and valor != info.data["senha"]:
            raise ValueError("As senhas não são iguais.")
        return valor


class CadastroEntrada(ComConfirmacaoDeSenha, ComEndereco):
    """Cadastro aberto. Não existe campo de perfil: a conta nasce PADRAO e PENDENTE."""

    nome: TextoAparado = Field(min_length=2, max_length=150)
    email: EmailValido
    telefone: Telefone = None
    # senha e confirmar_senha vêm de ComConfirmacaoDeSenha; o endereço, de ComEndereco


class EmailEntrada(BaseModel):
    email: EmailValido


class RedefinirSenhaEntrada(ComConfirmacaoDeSenha):
    token: str = Field(max_length=128)


class TokenEntrada(BaseModel):
    token: str = Field(max_length=128)


class MensagemSaida(BaseModel):
    mensagem: str


class ValidacaoTokenSaida(BaseModel):
    valido: bool
