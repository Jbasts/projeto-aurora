import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.controllers import mapa as controller
from app.core.permissoes import exigir_perfil, ip_da_requisicao, obter_usuario_atual
from app.db.sessao import obter_sessao
from app.entities import PerfilUsuario, Usuario
from app.schemas.comum import TAMANHO_PAGINA_MAXIMO, TAMANHO_PAGINA_PADRAO
from app.schemas.mapa import (
    AvistamentoEntrada,
    AvistamentoSaida,
    EnderecoSaida,
    MarcadorSaida,
    PaginaAvistamentos,
    PontoCalor,
)
from app.services.geocodificacao import Geocodificador, obter_geocodificador

SessaoBanco = Annotated[Session, Depends(obter_sessao)]
UsuarioLogado = Annotated[Usuario, Depends(obter_usuario_atual)]
# Registrar avistamento: ADMIN e COLABORADOR (seção 2).
Gestor = Annotated[Usuario, Depends(exigir_perfil(PerfilUsuario.ADMIN, PerfilUsuario.COLABORADOR))]
GeocodificadorDep = Annotated[Geocodificador, Depends(obter_geocodificador)]

router = APIRouter(tags=["mapa"])


@router.get("/mapa/marcadores", response_model=list[MarcadorSaida])
def marcadores(_: UsuarioLogado, sessao: SessaoBanco) -> list[MarcadorSaida]:
    return controller.marcadores(sessao)


@router.get("/mapa/calor", response_model=list[PontoCalor])
def calor(
    usuario: UsuarioLogado,
    sessao: SessaoBanco,
    pessoa_id: uuid.UUID | None = None,
    de: datetime | None = None,
    ate: datetime | None = None,
) -> list[PontoCalor]:
    """Mapa de calor (seção 3.10). Sem pessoa, usa os avistamentos das PSDR ativas."""
    return controller.calor(sessao, usuario, pessoa_id, de, ate)


@router.get("/pessoas/{pessoa_id}/avistamentos", response_model=PaginaAvistamentos)
def historico(
    pessoa_id: uuid.UUID,
    usuario: UsuarioLogado,
    sessao: SessaoBanco,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanho: Annotated[int, Query(ge=1, le=TAMANHO_PAGINA_MAXIMO)] = TAMANHO_PAGINA_PADRAO,
) -> PaginaAvistamentos:
    """Histórico de avistamentos no perfil da pessoa, do mais recente para o mais antigo."""
    return controller.historico(sessao, pessoa_id, usuario, pagina, tamanho)


@router.post("/avistamentos", response_model=AvistamentoSaida, status_code=status.HTTP_201_CREATED)
def registrar_avistamento(
    request: Request,
    dados: AvistamentoEntrada,
    usuario: Gestor,
    sessao: SessaoBanco,
    geocodificador: GeocodificadorDep,
) -> AvistamentoSaida:
    return controller.registrar_avistamento(
        sessao, dados, usuario, ip_da_requisicao(request), geocodificador
    )


@router.get("/geocodificacao/reversa", response_model=EnderecoSaida)
def geocodificacao_reversa(
    _: Gestor,
    geocodificador: GeocodificadorDep,
    lat: Annotated[float, Query(ge=-90, le=90)],
    lng: Annotated[float, Query(ge=-180, le=180)],
) -> EnderecoSaida:
    """Endereço aproximado para mostrar antes de salvar o avistamento."""
    return controller.endereco(lat, lng, geocodificador)
