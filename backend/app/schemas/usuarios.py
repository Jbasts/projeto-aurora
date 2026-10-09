import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_serializer, model_validator

from app.entities import PerfilUsuario, StatusSolicitacao, StatusUsuario, TipoSolicitacao
from app.schemas.autenticacao import ComConfirmacaoDeSenha, ComDataNascimento, ComFotoDaConta
from app.schemas.comum import (
    Celular,
    ComEndereco,
    CpfOpcional,
    DataNascimento,
    EmailOpcional,
    TextoAparado,
    TextoOpcional,
    formatar_cpf,
)


class SolicitacaoResumoSaida(BaseModel):
    """Solicitação em aberto de uma conta (tela Dados do usuário)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tipo: TipoSolicitacao
    status: StatusSolicitacao
    valor_novo: str
    criado_em: datetime

    @field_serializer("valor_novo")
    def _formatar(self, valor: str) -> str:
        return formatar_cpf(valor) if self.tipo == TipoSolicitacao.CPF else valor


class UsuarioGestaoSaida(ComFotoDaConta):
    """Linha da tela Gerenciar usuários."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nome: str
    sobrenome: str | None
    cpf: str | None  # completo: esta saída é só para ADMIN
    email: str
    telefone: str | None
    perfil: PerfilUsuario
    status: StatusUsuario
    criado_em: datetime

    @field_serializer("cpf")
    def _formatar_cpf(self, cpf: str | None) -> str | None:
        return formatar_cpf(cpf) if cpf else None


class UsuarioDetalheSaida(UsuarioGestaoSaida, ComDataNascimento):
    """Tela Dados do usuário (somente ADMIN): todos os dados da conta, exceto a senha."""

    cep: str | None
    logradouro: str | None
    numero: str | None
    complemento: str | None
    bairro: str | None
    cidade: str | None
    uf: str | None
    email_verificado_em: datetime | None
    atualizado_em: datetime
    solicitacoes_abertas: list[SolicitacaoResumoSaida]


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


class MeuPerfilEntrada(ComEndereco):
    """CPF e email não mudam por aqui."""

    nome: TextoAparado = Field(min_length=2, max_length=150)
    sobrenome: TextoAparado = Field(min_length=2, max_length=150)
    data_nascimento: DataNascimento
    telefone: Celular


class PedidoAlteracaoEntrada(BaseModel):
    """Meu perfil: trocar o email (confirmado por link), o CPF (aprovado por ADMIN) ou os dois."""

    email: EmailOpcional = None
    cpf: CpfOpcional = None
    senha: str = Field(max_length=128)

    @model_validator(mode="after")
    def _algo_para_alterar(self) -> "PedidoAlteracaoEntrada":
        if self.email is None and self.cpf is None:
            raise ValueError("Informe o novo email, o novo CPF ou os dois.")
        return self


class CompletarDadosEntrada(BaseModel):
    """ADMIN preenche sobrenome e CPF de contas antigas, só quando estão vazios."""

    sobrenome: TextoOpcional = Field(default=None, min_length=2, max_length=150)
    cpf: CpfOpcional = None

    @model_validator(mode="after")
    def _algo_para_completar(self) -> "CompletarDadosEntrada":
        if self.sobrenome is None and self.cpf is None:
            raise ValueError("Informe o sobrenome, o CPF ou os dois.")
        return self


class TrocarSenhaEntrada(ComConfirmacaoDeSenha):
    senha_atual: str = Field(max_length=128)
    # senha (nova) e confirmar_senha vêm de ComConfirmacaoDeSenha
