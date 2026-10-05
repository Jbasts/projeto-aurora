from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from app.core.config import obter_configuracoes
from app.core.erros import registrar_tratadores_de_erro
from app.core.limite import limiter, tratar_limite_excedido
from app.routes import autenticacao, saude

PREFIXO_API = "/api/v1"


def criar_app() -> FastAPI:
    configuracoes = obter_configuracoes()
    app = FastAPI(title="Projeto Aurora — API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[configuracoes.FRONTEND_URL],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    registrar_tratadores_de_erro(app)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, tratar_limite_excedido)

    app.include_router(saude.router, prefix=PREFIXO_API)
    app.include_router(autenticacao.router, prefix=PREFIXO_API)
    return app


app = criar_app()
