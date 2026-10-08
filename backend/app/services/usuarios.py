import uuid

from fastapi import status
from sqlalchemy.orm import Session

from app.core.erros import ErroApi
from app.entities import PerfilUsuario, StatusUsuario, Usuario
from app.repositories import usuarios as repositorio_usuarios
from app.schemas.usuarios import AlterarUsuarioEntrada
from app.services import auditoria
from app.services.auditoria import AcaoAuditoria

# Mudanças de status permitidas (seção 3.5) e a ação de auditoria de cada uma.
TRANSICOES_STATUS: dict[tuple[StatusUsuario, StatusUsuario], str] = {
    (StatusUsuario.PENDENTE, StatusUsuario.ATIVO): AcaoAuditoria.USUARIO_APROVADO,
    (StatusUsuario.PENDENTE, StatusUsuario.INATIVO): AcaoAuditoria.USUARIO_RECUSADO,
    (StatusUsuario.ATIVO, StatusUsuario.INATIVO): AcaoAuditoria.USUARIO_INATIVADO,
    (StatusUsuario.INATIVO, StatusUsuario.ATIVO): AcaoAuditoria.USUARIO_REATIVADO,
}

MENSAGEM_ULTIMO_ADMIN = (
    "O sistema precisa de pelo menos uma pessoa administradora ativa. "
    "Dê o perfil de administradora a outra pessoa antes."
)


def _admin_ativo(perfil: PerfilUsuario, status_usuario: StatusUsuario) -> bool:
    return perfil == PerfilUsuario.ADMIN and status_usuario == StatusUsuario.ATIVO


def alterar(
    sessao: Session,
    admin: Usuario,
    usuario_id: uuid.UUID,
    dados: AlterarUsuarioEntrada,
    ip: str | None,
) -> Usuario:
    """Aprova, recusa, inativa, reativa ou altera o perfil. Toda mudança gera auditoria."""
    usuario = repositorio_usuarios.buscar_por_id_para_alterar(sessao, usuario_id)
    if usuario is None:
        raise ErroApi(status.HTTP_404_NOT_FOUND, "NAO_ENCONTRADO", "Usuário não encontrado.")
    if usuario.email_verificado_em is None:
        raise ErroApi(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "EMAIL_NAO_VERIFICADO",
            "Esta conta ainda não confirmou o email.",
        )

    novo_perfil = dados.perfil or usuario.perfil
    novo_status = dados.status or usuario.status

    acoes: list[tuple[str, dict[str, str]]] = []
    if novo_status != usuario.status:
        acao = TRANSICOES_STATUS.get((usuario.status, novo_status))
        if acao is None:
            raise ErroApi(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "VALIDACAO",
                "Esta mudança de status não é permitida.",
            )
        acoes.append((acao, {"de": usuario.status.value, "para": novo_status.value}))
    if novo_perfil != usuario.perfil:
        acoes.append(
            (
                AcaoAuditoria.USUARIO_PERFIL_ALTERADO,
                {"de": usuario.perfil.value, "para": novo_perfil.value},
            )
        )
    if not acoes:
        return usuario

    if _admin_ativo(usuario.perfil, usuario.status) and not _admin_ativo(novo_perfil, novo_status):
        outros_admins = [
            i for i in repositorio_usuarios.travar_admins_ativos(sessao) if i != usuario.id
        ]
        if not outros_admins:
            raise ErroApi(status.HTTP_409_CONFLICT, "ULTIMO_ADMIN", MENSAGEM_ULTIMO_ADMIN)

    usuario.perfil = novo_perfil
    usuario.status = novo_status
    for acao, detalhes in acoes:
        auditoria.registrar(
            sessao,
            acao,
            usuario_id=admin.id,
            entidade="usuario",
            entidade_id=usuario.id,
            detalhes=detalhes,
            ip=ip,
        )
    sessao.commit()
    return usuario
