from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErroApi(Exception):
    """Erro de negócio no formato {"detail": ..., "codigo": ...} (seção 8 da especificação)."""

    def __init__(self, status_code: int, codigo: str, detail: str, **extras: Any) -> None:
        self.status_code = status_code
        self.codigo = codigo
        self.detail = detail
        self.extras = extras


CODIGOS_POR_STATUS = {
    status.HTTP_401_UNAUTHORIZED: "CREDENCIAIS_INVALIDAS",
    status.HTTP_403_FORBIDDEN: "SEM_PERMISSAO",
    status.HTTP_404_NOT_FOUND: "NAO_ENCONTRADO",
}


def registrar_tratadores_de_erro(app: FastAPI) -> None:
    @app.exception_handler(ErroApi)
    async def tratar_erro_api(_: Request, erro: ErroApi) -> JSONResponse:
        return JSONResponse(
            status_code=erro.status_code,
            content={"detail": erro.detail, "codigo": erro.codigo, **erro.extras},
        )

    @app.exception_handler(StarletteHTTPException)
    async def tratar_http(_: Request, erro: StarletteHTTPException) -> JSONResponse:
        detalhe = erro.detail if erro.status_code != 404 else "Recurso não encontrado."
        return JSONResponse(
            status_code=erro.status_code,
            content={"detail": detalhe, "codigo": CODIGOS_POR_STATUS.get(erro.status_code, "ERRO")},
            headers=getattr(erro, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def tratar_validacao(_: Request, erro: RequestValidationError) -> JSONResponse:
        campos = [
            {"campo": ".".join(str(p) for p in e["loc"][1:]), "mensagem": e["msg"]}
            for e in erro.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Dados inválidos.", "codigo": "VALIDACAO", "campos": campos},
        )
