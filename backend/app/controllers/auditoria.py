import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.entities import Usuario
from app.repositories import usuarios as repositorio_usuarios
from app.schemas.auditoria import LogAuditoriaSaida, PaginaLogsAuditoria, UsuarioAuditoriaRef
from app.services import auditoria as servico_auditoria


def _ref(usuario: Usuario | None) -> UsuarioAuditoriaRef | None:
    if usuario is None:
        return None
    return UsuarioAuditoriaRef(
        id=usuario.id, nome=usuario.nome, email=usuario.email, perfil=usuario.perfil
    )


def _uuid(valor: str | None) -> uuid.UUID | None:
    try:
        return uuid.UUID(valor) if valor else None
    except ValueError:
        return None


def listar(
    sessao: Session,
    usuario_id: uuid.UUID | None,
    acao: str | None,
    de: datetime | None,
    ate: datetime | None,
    pagina: int,
    tamanho: int,
) -> PaginaLogsAuditoria:
    linhas, total = servico_auditoria.listar(
        sessao,
        usuario_id=usuario_id,
        acao=acao,
        de=de,
        ate=ate,
        pagina=pagina,
        tamanho=tamanho,
    )
    ids_afetados = {_uuid(log.entidade_id) for log, _ in linhas if log.entidade == "usuario"} - {
        None
    }
    afetados = repositorio_usuarios.buscar_varios(sessao, ids_afetados)
    return PaginaLogsAuditoria(
        itens=[
            LogAuditoriaSaida(
                id=log.id,
                criado_em=log.criado_em,
                usuario=_ref(usuario),
                acao=log.acao,
                entidade=log.entidade,
                usuario_afetado=_ref(afetados.get(_uuid(log.entidade_id)))
                if log.entidade == "usuario"
                else None,
                entidade_id=log.entidade_id,
                detalhes=log.detalhes,
                ip=str(log.ip) if log.ip is not None else None,
            )
            for log, usuario in linhas
        ],
        total=total,
        pagina=pagina,
        tamanho=tamanho,
    )
