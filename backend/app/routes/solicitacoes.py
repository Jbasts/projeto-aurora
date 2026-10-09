import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.controllers import solicitacoes as controller
from app.core.permissoes import exigir_perfil, ip_da_requisicao
from app.db.sessao import obter_sessao
from app.entities import PerfilUsuario, StatusSolicitacao, TipoSolicitacao, Usuario
from app.schemas.comum import TAMANHO_PAGINA_MAXIMO, TAMANHO_PAGINA_PADRAO
from app.schemas.solicitacoes import PaginaSolicitacoes, SolicitacaoSaida

SessaoBanco = Annotated[Session, Depends(obter_sessao)]
Admin = Annotated[Usuario, Depends(exigir_perfil(PerfilUsuario.ADMIN))]

# Solicitações de troca de email e CPF (somente ADMIN).
router = APIRouter(prefix="/solicitacoes", tags=["solicitacoes"])


@router.get("", response_model=PaginaSolicitacoes)
def listar(
    _: Admin,
    sessao: SessaoBanco,
    status: StatusSolicitacao | None = None,
    tipo: TipoSolicitacao | None = None,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanho: Annotated[int, Query(ge=1, le=TAMANHO_PAGINA_MAXIMO)] = TAMANHO_PAGINA_PADRAO,
) -> PaginaSolicitacoes:
    return controller.listar(sessao, status, tipo, pagina, tamanho)


@router.post("/{solicitacao_id}/aprovar", response_model=SolicitacaoSaida)
def aprovar(
    request: Request, solicitacao_id: uuid.UUID, admin: Admin, sessao: SessaoBanco
) -> SolicitacaoSaida:
    return controller.decidir(sessao, admin, solicitacao_id, True, ip_da_requisicao(request))


@router.post("/{solicitacao_id}/recusar", response_model=SolicitacaoSaida)
def recusar(
    request: Request, solicitacao_id: uuid.UUID, admin: Admin, sessao: SessaoBanco
) -> SolicitacaoSaida:
    return controller.decidir(sessao, admin, solicitacao_id, False, ip_da_requisicao(request))
