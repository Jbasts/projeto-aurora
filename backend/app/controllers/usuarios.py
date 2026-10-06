import uuid

from sqlalchemy.orm import Session

from app.entities import PerfilUsuario, StatusUsuario, Usuario
from app.repositories import usuarios as repositorio_usuarios
from app.schemas.autenticacao import MensagemSaida, UsuarioSaida
from app.schemas.usuarios import (
    AlterarUsuarioEntrada,
    MeuPerfilEntrada,
    PaginaUsuarios,
    TrocarSenhaEntrada,
    UsuarioGestaoSaida,
)
from app.services import meu_perfil as servico_meu_perfil
from app.services import usuarios as servico_usuarios

MENSAGEM_SENHA_ALTERADA = "Senha alterada."


def listar(
    sessao: Session,
    busca: str | None,
    perfil: PerfilUsuario | None,
    status: StatusUsuario | None,
    pagina: int,
    tamanho: int,
) -> PaginaUsuarios:
    itens, total = repositorio_usuarios.listar(
        sessao,
        busca=busca.strip() if busca else None,
        perfil=perfil,
        status=status,
        pagina=pagina,
        tamanho=tamanho,
    )
    return PaginaUsuarios(
        itens=[UsuarioGestaoSaida.model_validate(u) for u in itens],
        total=total,
        pagina=pagina,
        tamanho=tamanho,
    )


def alterar(
    sessao: Session,
    admin: Usuario,
    usuario_id: uuid.UUID,
    dados: AlterarUsuarioEntrada,
    ip: str | None,
) -> UsuarioGestaoSaida:
    usuario = servico_usuarios.alterar(sessao, admin, usuario_id, dados, ip)
    return UsuarioGestaoSaida.model_validate(usuario)


def atualizar_meus_dados(
    sessao: Session, usuario: Usuario, dados: MeuPerfilEntrada, ip: str | None
) -> UsuarioSaida:
    return UsuarioSaida.model_validate(
        servico_meu_perfil.atualizar_dados(sessao, usuario, dados, ip)
    )


def trocar_senha(
    sessao: Session, usuario: Usuario, dados: TrocarSenhaEntrada, ip: str | None
) -> MensagemSaida:
    servico_meu_perfil.trocar_senha(sessao, usuario, dados, ip)
    return MensagemSaida(mensagem=MENSAGEM_SENHA_ALTERADA)
