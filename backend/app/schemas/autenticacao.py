import uuid
from datetime import date, datetime
from typing import Literal

from fastapi import UploadFile
from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, computed_field, field_validator

from app.entities import PerfilUsuario, StatusSolicitacao, StatusUsuario, TipoSolicitacao
from app.schemas.comum import (
    Celular,
    ComEndereco,
    Cpf,
    DataNascimento,
    EmailValido,
    SenhaForte,
    TextoAparado,
    calcular_idade,
    mascarar_cpf,
)
from app.services.arquivos import url_assinada_conta


class SolicitacaoPropriaSaida(BaseModel):
    """Última solicitação de troca de um tipo, para a própria pessoa (CPF sempre mascarado)."""

    model_config = ConfigDict(from_attributes=True)

    tipo: TipoSolicitacao
    status: StatusSolicitacao
    valor_novo: str = Field(exclude=True)
    criado_em: datetime
    email_confirmado_em: datetime | None
    decidido_em: datetime | None

    @computed_field
    @property
    def valor_novo_exibicao(self) -> str:
        return (
            mascarar_cpf(self.valor_novo) if self.tipo == TipoSolicitacao.CPF else self.valor_novo
        )


class ComFotoDaConta(BaseModel):
    """URLs assinadas da foto da conta (nulas quando a conta ainda não tem foto)."""

    foto_id: uuid.UUID | None = Field(exclude=True)

    @computed_field
    @property
    def foto_url(self) -> str | None:
        return url_assinada_conta(self.foto_id, "original") if self.foto_id else None

    @computed_field
    @property
    def foto_miniatura_url(self) -> str | None:
        return url_assinada_conta(self.foto_id, "miniatura") if self.foto_id else None


class ComDataNascimento(BaseModel):
    """Data de nascimento e a idade calculada a partir dela (nulas em contas antigas)."""

    data_nascimento: date | None

    @computed_field
    @property
    def idade(self) -> int | None:
        return calcular_idade(self.data_nascimento) if self.data_nascimento else None


class UsuarioSaida(ComFotoDaConta, ComDataNascimento):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nome: str
    sobrenome: str | None
    email: str
    telefone: str | None
    # A própria pessoa vê o CPF mascarado (ver cpf_mascarado); nunca sai completo daqui.
    cpf: str | None = Field(exclude=True)
    cep: str | None
    logradouro: str | None
    numero: str | None
    complemento: str | None
    bairro: str | None
    cidade: str | None
    uf: str | None
    perfil: PerfilUsuario
    status: StatusUsuario
    # Última solicitação de cada tipo (o email e o CPF acima continuam valendo até a aprovação).
    solicitacao_email: SolicitacaoPropriaSaida | None
    solicitacao_cpf: SolicitacaoPropriaSaida | None

    @computed_field
    @property
    def cpf_mascarado(self) -> str | None:
        return mascarar_cpf(self.cpf) if self.cpf else None


class LoginEntrada(BaseModel):
    # Email ou CPF. Sem validar formato: qualquer erro responde "Email, CPF ou senha incorretos."
    login: str = Field(max_length=254)
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
    sobrenome: TextoAparado = Field(min_length=2, max_length=150)
    cpf: Cpf
    data_nascimento: DataNascimento
    email: EmailValido
    telefone: Celular
    # senha e confirmar_senha vêm de ComConfirmacaoDeSenha; o endereço, de ComEndereco


class CadastroFormulario(CadastroEntrada):
    """O cadastro chega como formulário multipart: os campos acima e a foto da conta."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    foto: UploadFile


class EmailEntrada(BaseModel):
    email: EmailValido


class RecuperarSenhaEntrada(BaseModel):
    # Email ou CPF. Sem validar formato: a resposta é sempre a mesma.
    login: TextoAparado = Field(min_length=1, max_length=254)


class RedefinirSenhaEntrada(ComConfirmacaoDeSenha):
    token: str = Field(max_length=128)


class TokenEntrada(BaseModel):
    token: str = Field(max_length=128)


class MensagemSaida(BaseModel):
    mensagem: str


class ValidacaoTokenSaida(BaseModel):
    valido: bool
