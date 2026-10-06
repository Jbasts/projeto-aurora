import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.entities import LogAuditoria
from app.repositories import auditoria as repositorio


class AcaoAuditoria:
    LOGIN_SUCESSO = "LOGIN_SUCESSO"
    LOGIN_FALHA = "LOGIN_FALHA"
    LOGIN_BLOQUEIO = "LOGIN_BLOQUEIO"
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
