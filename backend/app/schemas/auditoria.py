import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.entities import PerfilUsuario


class UsuarioAuditoriaRef(BaseModel):
    id: uuid.UUID
    nome: str
    email: str
    perfil: PerfilUsuario


class LogAuditoriaSaida(BaseModel):
    id: int
    criado_em: datetime
    # Nulo em tentativas de login com email desconhecido.
    usuario: UsuarioAuditoriaRef | None
    acao: str
    entidade: str | None
    # Quando o registro é sobre um usuário (aprovação, perfil etc.), quem foi afetado.
    usuario_afetado: UsuarioAuditoriaRef | None
    entidade_id: str | None
    detalhes: dict[str, Any] | None
    ip: str | None


class PaginaLogsAuditoria(BaseModel):
    itens: list[LogAuditoriaSaida]
    total: int
    pagina: int
    tamanho: int
