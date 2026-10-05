from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import obter_configuracoes

# Rate limit por IP nas rotas /auth/* (seção 3.11).
limiter = Limiter(key_func=get_remote_address)
LIMITE_AUTH = obter_configuracoes().LIMITE_REQUISICOES_AUTH


async def tratar_limite_excedido(_: Request, __: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Muitas requisições. Aguarde um pouco e tente novamente.",
            "codigo": "MUITAS_REQUISICOES",
        },
    )
