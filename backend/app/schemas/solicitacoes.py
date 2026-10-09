import uuid
from datetime import datetime

from pydantic import BaseModel

from app.entities import StatusSolicitacao, TipoSolicitacao


class ContaDaSolicitacao(BaseModel):
    id: uuid.UUID
    nome_completo: str
    foto_miniatura_url: str | None


class SolicitacaoSaida(BaseModel):
    """Linha da tela Solicitações (somente ADMIN). CPF completo, formatado."""

    id: uuid.UUID
    tipo: TipoSolicitacao
    status: StatusSolicitacao
    usuario: ContaDaSolicitacao
    valor_atual: str | None  # email ou CPF da conta agora
    valor_novo: str
    criado_em: datetime
    email_confirmado_em: datetime | None
    decidido_em: datetime | None
    decidido_por: str | None  # nome de quem decidiu


class PaginaSolicitacoes(BaseModel):
    itens: list[SolicitacaoSaida]
    total: int
    pagina: int
    tamanho: int
