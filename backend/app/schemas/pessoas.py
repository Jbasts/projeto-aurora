import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from pydantic import AfterValidator, BaseModel, BeforeValidator, Field

from app.entities import StatusPessoa, TipoFoto
from app.schemas.comum import Telefone, TextoAparado, validar_email

# Tolerância para relógios levemente adiantados no celular.
TOLERANCIA_FUTURO = timedelta(minutes=2)


def _aparar_ou_none(valor: object) -> object:
    """Apara espaços; texto vazio vira None (campo opcional não preenchido)."""
    if isinstance(valor, str):
        return valor.strip() or None
    return valor


def texto_opcional(maximo: int):
    return Annotated[
        Annotated[str, Field(max_length=maximo)] | None, BeforeValidator(_aparar_ou_none)
    ]


def _email_opcional(valor: str | None) -> str | None:
    return validar_email(valor) if valor else None


EmailOpcional = Annotated[texto_opcional(254), AfterValidator(_email_opcional)]


def nao_no_futuro(valor: datetime) -> datetime:
    if valor.tzinfo is None:
        raise ValueError("Informe a data e a hora com fuso horário.")
    if valor > datetime.now(UTC) + TOLERANCIA_FUTURO:
        raise ValueError("A data e a hora não podem estar no futuro.")
    return valor


class PessoaEntrada(BaseModel):
    """Campos da seção 3.7, usados no cadastro e na edição."""

    nome: TextoAparado = Field(min_length=1, max_length=100)
    sobrenome: TextoAparado = Field(min_length=1, max_length=150)
    apelido: texto_opcional(100) = None
    idade_aproximada: int | None = Field(default=None, ge=0, le=130)
    email: EmailOpcional = None
    telefone: Telefone = None
    nome_contato: texto_opcional(150) = None
    telefone_contato: Telefone = None
    observacoes: texto_opcional(2000) = None
    consentimento: bool


class AvistamentoInicialEntrada(BaseModel):
    """Etapa 3 do cadastro: onde a pessoa foi vista (opcional)."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    visto_em: Annotated[datetime, AfterValidator(nao_no_futuro)]
    observacao: texto_opcional(1000) = None


class PessoaCriacaoEntrada(PessoaEntrada):
    avistamento: AvistamentoInicialEntrada | None = None


class InativarPessoaEntrada(BaseModel):
    motivo: texto_opcional(500) = None


class UsuarioRef(BaseModel):
    id: uuid.UUID
    nome: str


class FotoSaida(BaseModel):
    id: uuid.UUID
    tipo: TipoFoto
    legenda: str | None
    url: str
    url_miniatura: str
    enviada_por: UsuarioRef | None
    criado_em: datetime


class PessoaSaida(BaseModel):
    id: uuid.UUID
    nome: str
    sobrenome: str
    apelido: str | None
    idade_aproximada: int | None
    email: str | None
    telefone: str | None
    nome_contato: str | None
    telefone_contato: str | None
    observacoes: str | None
    consentimento: bool
    consentimento_em: datetime | None
    status: StatusPessoa
    motivo_inativacao: str | None
    inativada_em: datetime | None
    inativada_por: UsuarioRef | None
    cadastrada_por: UsuarioRef | None
    foto_perfil: FotoSaida | None
    album: list[FotoSaida]
    ultima_vez_visto: datetime | None
    ultima_latitude: float | None
    ultima_longitude: float | None
    ultimo_endereco: str | None
    criado_em: datetime
    atualizado_em: datetime


class SugestaoPessoaSaida(BaseModel):
    """Autocomplete e aviso de duplicidade."""

    id: uuid.UUID
    nome: str
    sobrenome: str
    apelido: str | None
    status: StatusPessoa
    url_miniatura: str | None


class PessoaResumoSaida(BaseModel):
    """Linha da tela Buscar (seção 4.3)."""

    id: uuid.UUID
    nome: str
    sobrenome: str
    apelido: str | None
    status: StatusPessoa
    url_miniatura: str | None
    ultima_vez_visto: datetime | None
    ultimo_endereco: str | None
    ultima_latitude: float | None
    ultima_longitude: float | None
    cadastrada_por: UsuarioRef | None


class PaginaPessoas(BaseModel):
    itens: list[PessoaResumoSaida]
    total: int
    pagina: int
    tamanho: int
