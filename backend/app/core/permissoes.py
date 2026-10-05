import ipaddress
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.erros import ErroApi
from app.core.seguranca import ler_token
from app.db.sessao import obter_sessao
from app.entities import PerfilUsuario, StatusUsuario, Usuario
from app.repositories import usuarios as repositorio_usuarios

_bearer = HTTPBearer(auto_error=False)


def _nao_autenticado() -> ErroApi:
    return ErroApi(
        status.HTTP_401_UNAUTHORIZED,
        "TOKEN_INVALIDO",
        "Sua sessão expirou. Entre novamente.",
    )


def obter_usuario_atual(
    credenciais: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    sessao: Annotated[Session, Depends(obter_sessao)],
) -> Usuario:
    """Pessoa logada. Perfil e status são lidos do banco a cada requisição (seção 3.2)."""
    if credenciais is None:
        raise _nao_autenticado()
    usuario_id = ler_token(credenciais.credentials, "access")
    if usuario_id is None:
        raise _nao_autenticado()
    usuario = repositorio_usuarios.buscar_por_id(sessao, usuario_id)
    if usuario is None or usuario.status != StatusUsuario.ATIVO:
        raise _nao_autenticado()
    return usuario


def exigir_perfil(*perfis: PerfilUsuario) -> Callable[..., Usuario]:
    """Dependência que só deixa passar os perfis informados. Ex.: exigir_perfil(ADMIN)."""

    def verificar(usuario: Annotated[Usuario, Depends(obter_usuario_atual)]) -> Usuario:
        if usuario.perfil not in perfis:
            raise ErroApi(
                status.HTTP_403_FORBIDDEN,
                "SEM_PERMISSAO",
                "Você não tem permissão para fazer isso.",
            )
        return usuario

    return verificar


def ip_da_requisicao(request: Request) -> str | None:
    """IP de quem fez a requisição, ou None se não for um IP válido (ex.: cliente de testes)."""
    if request.client is None:
        return None
    try:
        return str(ipaddress.ip_address(request.client.host))
    except ValueError:
        return None
