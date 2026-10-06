import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.controllers import usuarios as controller
from app.core.limite import LIMITE_AUTH, limiter
from app.core.permissoes import exigir_perfil, ip_da_requisicao, obter_usuario_atual
from app.db.sessao import obter_sessao
from app.entities import PerfilUsuario, StatusUsuario, Usuario
from app.schemas.autenticacao import MensagemSaida, UsuarioSaida
from app.schemas.comum import TAMANHO_PAGINA_MAXIMO, TAMANHO_PAGINA_PADRAO
from app.schemas.usuarios import (
    AlterarUsuarioEntrada,
    MeuPerfilEntrada,
    PaginaUsuarios,
    TrocarSenhaEntrada,
    UsuarioGestaoSaida,
)

SessaoBanco = Annotated[Session, Depends(obter_sessao)]
UsuarioLogado = Annotated[Usuario, Depends(obter_usuario_atual)]
Admin = Annotated[Usuario, Depends(exigir_perfil(PerfilUsuario.ADMIN))]

# --- Gestão de usuários (somente ADMIN, seção 3.5) ---

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("", response_model=PaginaUsuarios)
def listar(
    _: Admin,
    sessao: SessaoBanco,
    busca: Annotated[str | None, Query(max_length=150)] = None,
    perfil: PerfilUsuario | None = None,
    status: StatusUsuario | None = None,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanho: Annotated[int, Query(ge=1, le=TAMANHO_PAGINA_MAXIMO)] = TAMANHO_PAGINA_PADRAO,
) -> PaginaUsuarios:
    return controller.listar(sessao, busca, perfil, status, pagina, tamanho)


@router.patch("/{usuario_id}", response_model=UsuarioGestaoSaida)
def alterar(
    request: Request,
    usuario_id: uuid.UUID,
    dados: AlterarUsuarioEntrada,
    admin: Admin,
    sessao: SessaoBanco,
) -> UsuarioGestaoSaida:
    return controller.alterar(sessao, admin, usuario_id, dados, ip_da_requisicao(request))


# --- Meu perfil (todas as pessoas logadas, seção 3.6) ---

router_me = APIRouter(prefix="/me", tags=["meu perfil"])


@router_me.patch("", response_model=UsuarioSaida)
def atualizar_meus_dados(
    request: Request, dados: MeuPerfilEntrada, usuario: UsuarioLogado, sessao: SessaoBanco
) -> UsuarioSaida:
    return controller.atualizar_meus_dados(sessao, usuario, dados, ip_da_requisicao(request))


@router_me.patch("/senha", response_model=MensagemSaida)
@limiter.limit(LIMITE_AUTH)  # a senha atual não pode ser descoberta por tentativa e erro
def trocar_senha(
    request: Request, dados: TrocarSenhaEntrada, usuario: UsuarioLogado, sessao: SessaoBanco
) -> MensagemSaida:
    return controller.trocar_senha(sessao, usuario, dados, ip_da_requisicao(request))
