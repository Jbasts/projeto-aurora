import uuid
from datetime import datetime
from typing import Any

from fastapi import status
from sqlalchemy.orm import Session

from app.core.erros import ErroApi
from app.entities import LogAuditoria, Usuario
from app.repositories import auditoria as repositorio


class AcaoAuditoria:
    LOGIN_SUCESSO = "LOGIN_SUCESSO"
    LOGIN_FALHA = "LOGIN_FALHA"
    LOGIN_BLOQUEIO = "LOGIN_BLOQUEIO"
    EMAIL_VERIFICADO = "EMAIL_VERIFICADO"
    # Gestão de usuários (ADMIN)
    USUARIO_APROVADO = "USUARIO_APROVADO"
    USUARIO_RECUSADO = "USUARIO_RECUSADO"
    USUARIO_INATIVADO = "USUARIO_INATIVADO"
    USUARIO_REATIVADO = "USUARIO_REATIVADO"
    USUARIO_PERFIL_ALTERADO = "USUARIO_PERFIL_ALTERADO"
    # Meu perfil
    MEUS_DADOS_ALTERADOS = "MEUS_DADOS_ALTERADOS"
    SENHA_ALTERADA = "SENHA_ALTERADA"
    # Pessoas em situação de rua (detalhes só com IDs e nomes de campos, nunca valores)
    PESSOA_CADASTRADA = "PESSOA_CADASTRADA"
    PESSOA_EDITADA = "PESSOA_EDITADA"
    PESSOA_INATIVADA = "PESSOA_INATIVADA"
    PESSOA_REATIVADA = "PESSOA_REATIVADA"
    PESSOA_VISUALIZADA = "PESSOA_VISUALIZADA"
    FOTO_ENVIADA = "FOTO_ENVIADA"
    FOTO_REMOVIDA = "FOTO_REMOVIDA"
    AVISTAMENTO_REGISTRADO = "AVISTAMENTO_REGISTRADO"


def registrar(
    sessao: Session,
    acao: str,
    *,
    usuario_id: uuid.UUID | None = None,
    entidade: str | None = None,
    entidade_id: uuid.UUID | str | None = None,
    detalhes: dict[str, Any] | None = None,
    ip: str | None = None,
) -> None:
    """Grava um registro de auditoria. `detalhes` nunca pode ter dados pessoais de PSDR."""
    repositorio.adicionar(
        sessao,
        LogAuditoria(
            usuario_id=usuario_id,
            acao=acao,
            entidade=entidade,
            entidade_id=str(entidade_id) if entidade_id is not None else None,
            detalhes=detalhes,
            ip=ip,
        ),
    )


ACOES = tuple(valor for nome, valor in vars(AcaoAuditoria).items() if nome.isupper())


def listar(
    sessao: Session,
    *,
    usuario_id: uuid.UUID | None,
    acao: str | None,
    de: datetime | None,
    ate: datetime | None,
    pagina: int,
    tamanho: int,
) -> tuple[list[tuple[LogAuditoria, Usuario | None]], int]:
    """Consulta da tela Logs de auditoria (somente ADMIN), do mais recente para o mais antigo."""
    if de is not None and ate is not None and de > ate:
        raise ErroApi(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "VALIDACAO",
            "A data inicial do período não pode ser depois da data final.",
        )
    return repositorio.listar(
        sessao,
        usuario_id=usuario_id,
        acao=acao,
        de=de,
        ate=ate,
        pagina=pagina,
        tamanho=tamanho,
    )
