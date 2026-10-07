import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.controllers import auditoria as controller
from app.core.permissoes import exigir_perfil
from app.db.sessao import obter_sessao
from app.entities import PerfilUsuario, Usuario
from app.schemas.auditoria import PaginaLogsAuditoria
from app.schemas.comum import TAMANHO_PAGINA_MAXIMO, TAMANHO_PAGINA_PADRAO
from app.services.auditoria import ACOES

SessaoBanco = Annotated[Session, Depends(obter_sessao)]
# Ver logs de auditoria: somente ADMIN (seção 2).
Admin = Annotated[Usuario, Depends(exigir_perfil(PerfilUsuario.ADMIN))]
Acao = Literal[ACOES]  # type: ignore[valid-type]

router = APIRouter(prefix="/auditoria", tags=["auditoria"])


@router.get("", response_model=PaginaLogsAuditoria)
def listar(
    _: Admin,
    sessao: SessaoBanco,
    usuario_id: uuid.UUID | None = None,
    acao: Acao | None = None,
    de: datetime | None = None,
    ate: datetime | None = None,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanho: Annotated[int, Query(ge=1, le=TAMANHO_PAGINA_MAXIMO)] = TAMANHO_PAGINA_PADRAO,
) -> PaginaLogsAuditoria:
    """Logs de auditoria (seção 3.11), do mais recente para o mais antigo."""
    return controller.listar(sessao, usuario_id, acao, de, ate, pagina, tamanho)
