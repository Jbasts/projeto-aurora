import uuid

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.entities import PerfilUsuario, StatusUsuario, Usuario


def buscar_por_id(sessao: Session, usuario_id: uuid.UUID) -> Usuario | None:
    return sessao.get(Usuario, usuario_id)


def buscar_por_id_para_alterar(sessao: Session, usuario_id: uuid.UUID) -> Usuario | None:
    """Busca travando a linha até o fim da transação (alterações simultâneas esperam)."""
    return sessao.get(Usuario, usuario_id, with_for_update=True, populate_existing=True)


def buscar_por_email(sessao: Session, email: str) -> Usuario | None:
    # email é citext: a comparação já ignora maiúsculas.
    return sessao.scalar(select(Usuario).where(Usuario.email == email))


def adicionar(sessao: Session, usuario: Usuario) -> Usuario:
    sessao.add(usuario)
    sessao.flush()
    return usuario


def _escapar_like(termo: str) -> str:
    return termo.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def listar(
    sessao: Session,
    *,
    busca: str | None,
    perfil: PerfilUsuario | None,
    status: StatusUsuario | None,
    pagina: int,
    tamanho: int,
) -> tuple[list[Usuario], int]:
    """Pendentes primeiro, depois por nome. Busca por nome (sem acento) ou email."""
    filtros = []
    if busca:
        padrao = f"%{_escapar_like(busca)}%"
        filtros.append(
            or_(
                func.unaccent(Usuario.nome).ilike(func.unaccent(padrao), escape="\\"),
                Usuario.email.ilike(padrao, escape="\\"),
            )
        )
    if perfil is not None:
        filtros.append(Usuario.perfil == perfil)
    if status is not None:
        filtros.append(Usuario.status == status)

    total = sessao.scalar(select(func.count()).select_from(Usuario).where(*filtros)) or 0
    itens = sessao.scalars(
        select(Usuario)
        .where(*filtros)
        .order_by(
            case((Usuario.status == StatusUsuario.PENDENTE, 0), else_=1),
            func.lower(func.unaccent(Usuario.nome)),
            Usuario.id,
        )
        .offset((pagina - 1) * tamanho)
        .limit(tamanho)
    ).all()
    return list(itens), total


def travar_admins_ativos(sessao: Session) -> list[uuid.UUID]:
    """IDs dos ADMIN ativos, com as linhas travadas até o fim da transação.

    A trava impede que duas alterações simultâneas deixem o sistema sem ADMIN.
    """
    return list(
        sessao.scalars(
            select(Usuario.id)
            .where(Usuario.perfil == PerfilUsuario.ADMIN, Usuario.status == StatusUsuario.ATIVO)
            .with_for_update()
        )
    )


def nomes_por_id(sessao: Session, ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not ids:
        return {}
    return dict(sessao.execute(select(Usuario.id, Usuario.nome).where(Usuario.id.in_(ids))).all())
