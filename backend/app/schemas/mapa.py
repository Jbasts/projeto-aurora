import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field

from app.entities import PerfilUsuario
from app.schemas.pessoas import nao_no_futuro, texto_opcional


class RegistradorRef(BaseModel):
    """Quem registrou um avistamento, com o perfil de acesso."""

    id: uuid.UUID
    nome: str
    perfil: PerfilUsuario


class MarcadorSaida(BaseModel):
    """PSDR ativa na última localização (mapa e "Ver como lista")."""

    id: uuid.UUID
    nome: str
    sobrenome: str
    apelido: str | None
    idade_aproximada: int | None
    url_miniatura: str | None
    latitude: float
    longitude: float
    ultimo_endereco: str | None
    ultima_vez_visto: datetime
    # Quem registrou o avistamento mais recente.
    registrado_por: RegistradorRef | None


class AvistamentoEntrada(BaseModel):
    pessoa_id: uuid.UUID
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    visto_em: Annotated[datetime, AfterValidator(nao_no_futuro)]
    observacao: texto_opcional(1000) = None


class AvistamentoSaida(BaseModel):
    id: uuid.UUID
    pessoa_id: uuid.UUID
    latitude: float
    longitude: float
    endereco: str | None
    visto_em: datetime
    observacao: str | None
    registrado_por: RegistradorRef | None
    criado_em: datetime
    # True se este passou a ser o avistamento mais recente da pessoa.
    mais_recente: bool


class EnderecoSaida(BaseModel):
    endereco: str | None
