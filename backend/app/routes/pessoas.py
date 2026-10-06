import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.controllers import pessoas as controller
from app.core.permissoes import exigir_perfil, ip_da_requisicao, obter_usuario_atual
from app.db.sessao import obter_sessao
from app.entities import PerfilUsuario, StatusPessoa, TipoFoto, Usuario
from app.repositories.pessoas import OrdemPessoas
from app.schemas.comum import TAMANHO_PAGINA_MAXIMO, TAMANHO_PAGINA_PADRAO
from app.schemas.pessoas import (
    FotoSaida,
    InativarPessoaEntrada,
    PaginaPessoas,
    PessoaCriacaoEntrada,
    PessoaEntrada,
    PessoaSaida,
    SugestaoPessoaSaida,
)
from app.services.arquivos import Variante
from app.services.geocodificacao import Geocodificador, obter_geocodificador

SessaoBanco = Annotated[Session, Depends(obter_sessao)]
UsuarioLogado = Annotated[Usuario, Depends(obter_usuario_atual)]
# Cadastrar, editar, inativar, reativar e fotos: ADMIN e COLABORADOR (seção 2).
Gestor = Annotated[Usuario, Depends(exigir_perfil(PerfilUsuario.ADMIN, PerfilUsuario.COLABORADOR))]
Legenda = Annotated[str | None, Form(max_length=255)]

router = APIRouter(prefix="/pessoas", tags=["pessoas"])


@router.get("", response_model=PaginaPessoas)
def listar(
    usuario: UsuarioLogado,
    sessao: SessaoBanco,
    busca: Annotated[str | None, Query(max_length=100)] = None,
    status: StatusPessoa | None = None,
    visto_desde: datetime | None = None,
    ordem: OrdemPessoas = "nome",
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanho: Annotated[int, Query(ge=1, le=TAMANHO_PAGINA_MAXIMO)] = TAMANHO_PAGINA_PADRAO,
) -> PaginaPessoas:
    """Busca (seção 4.3). Sem status, lista ativas e inativas (PADRAO: só ativas)."""
    return controller.listar(sessao, usuario, busca, status, visto_desde, ordem, pagina, tamanho)


@router.get("/sugestoes", response_model=list[SugestaoPessoaSaida])
def sugestoes(
    usuario: UsuarioLogado,
    sessao: SessaoBanco,
    q: Annotated[str, Query(min_length=2, max_length=100)],
) -> list[SugestaoPessoaSaida]:
    return controller.sugestoes(sessao, q, usuario)


@router.post("", response_model=PessoaSaida, status_code=status.HTTP_201_CREATED)
def cadastrar(
    request: Request,
    dados: PessoaCriacaoEntrada,
    usuario: Gestor,
    sessao: SessaoBanco,
    geocodificador: Annotated[Geocodificador, Depends(obter_geocodificador)],
) -> PessoaSaida:
    return controller.cadastrar(sessao, dados, usuario, ip_da_requisicao(request), geocodificador)


@router.get("/{pessoa_id}", response_model=PessoaSaida)
def visualizar(
    request: Request, pessoa_id: uuid.UUID, usuario: UsuarioLogado, sessao: SessaoBanco
) -> PessoaSaida:
    return controller.visualizar(sessao, pessoa_id, usuario, ip_da_requisicao(request))


@router.put("/{pessoa_id}", response_model=PessoaSaida)
def atualizar(
    request: Request,
    pessoa_id: uuid.UUID,
    dados: PessoaEntrada,
    usuario: Gestor,
    sessao: SessaoBanco,
) -> PessoaSaida:
    return controller.atualizar(sessao, pessoa_id, dados, usuario, ip_da_requisicao(request))


@router.post("/{pessoa_id}/inativar", response_model=PessoaSaida)
def inativar(
    request: Request,
    pessoa_id: uuid.UUID,
    usuario: Gestor,
    sessao: SessaoBanco,
    dados: InativarPessoaEntrada | None = None,
) -> PessoaSaida:
    return controller.inativar(
        sessao, pessoa_id, dados or InativarPessoaEntrada(), usuario, ip_da_requisicao(request)
    )


@router.post("/{pessoa_id}/reativar", response_model=PessoaSaida)
def reativar(
    request: Request, pessoa_id: uuid.UUID, usuario: Gestor, sessao: SessaoBanco
) -> PessoaSaida:
    return controller.reativar(sessao, pessoa_id, usuario, ip_da_requisicao(request))


@router.post(
    "/{pessoa_id}/foto-perfil", response_model=FotoSaida, status_code=status.HTTP_201_CREATED
)
async def enviar_foto_perfil(
    request: Request,
    pessoa_id: uuid.UUID,
    arquivo: Annotated[UploadFile, File()],
    usuario: Gestor,
    sessao: SessaoBanco,
) -> FotoSaida:
    return await controller.enviar_foto(
        sessao, pessoa_id, TipoFoto.PERFIL, arquivo, None, usuario, ip_da_requisicao(request)
    )


@router.post("/{pessoa_id}/fotos", response_model=FotoSaida, status_code=status.HTTP_201_CREATED)
async def enviar_foto_album(
    request: Request,
    pessoa_id: uuid.UUID,
    arquivo: Annotated[UploadFile, File()],
    usuario: Gestor,
    sessao: SessaoBanco,
    legenda: Legenda = None,
) -> FotoSaida:
    legenda = (legenda or "").strip() or None
    return await controller.enviar_foto(
        sessao, pessoa_id, TipoFoto.ALBUM, arquivo, legenda, usuario, ip_da_requisicao(request)
    )


@router.delete("/{pessoa_id}/fotos/{foto_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_foto(
    request: Request,
    pessoa_id: uuid.UUID,
    foto_id: uuid.UUID,
    usuario: Gestor,
    sessao: SessaoBanco,
) -> None:
    controller.remover_foto(sessao, pessoa_id, foto_id, usuario, ip_da_requisicao(request))


# --- Arquivos (URL assinada; sem Bearer, para funcionar em <img>) ---

router_arquivos = APIRouter(prefix="/arquivos", tags=["arquivos"])


@router_arquivos.get("/{foto_id}", response_class=FileResponse)
def arquivo(
    foto_id: uuid.UUID,
    sessao: SessaoBanco,
    exp: int,
    assinatura: Annotated[str, Query(max_length=128)],
    variante: Variante = "original",
) -> FileResponse:
    return controller.arquivo(sessao, foto_id, variante, exp, assinatura)
