from fastapi import status
from sqlalchemy.orm import Session

from app.core.erros import ErroApi
from app.core.seguranca import gerar_hash_senha, verificar_senha
from app.entities import Usuario
from app.schemas.comum import CAMPOS_ENDERECO
from app.schemas.usuarios import MeuPerfilEntrada, TrocarSenhaEntrada
from app.services import auditoria
from app.services.auditoria import AcaoAuditoria

MENSAGEM_SENHA_ATUAL_INCORRETA = "Senha atual incorreta."


def atualizar_dados(
    sessao: Session, usuario: Usuario, dados: MeuPerfilEntrada, ip: str | None
) -> Usuario:
    """Nome, telefone e endereço. Email e perfil de acesso não mudam por aqui (seção 3.6)."""
    alterados = [
        campo
        for campo in ("nome", "telefone", *CAMPOS_ENDERECO)
        if getattr(dados, campo) != getattr(usuario, campo)
    ]
    if not alterados:
        return usuario

    for campo in alterados:
        setattr(usuario, campo, getattr(dados, campo))
    # Só os nomes dos campos: os valores já ficam na própria tabela.
    auditoria.registrar(
        sessao,
        AcaoAuditoria.MEUS_DADOS_ALTERADOS,
        usuario_id=usuario.id,
        entidade="usuario",
        entidade_id=usuario.id,
        detalhes={"campos": alterados},
        ip=ip,
    )
    sessao.commit()
    return usuario


def trocar_senha(
    sessao: Session, usuario: Usuario, dados: TrocarSenhaEntrada, ip: str | None
) -> None:
    if not verificar_senha(dados.senha_atual, usuario.senha_hash):
        raise ErroApi(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "VALIDACAO",
            "Dados inválidos.",
            campos=[{"campo": "senha_atual", "mensagem": MENSAGEM_SENHA_ATUAL_INCORRETA}],
        )
    usuario.senha_hash = gerar_hash_senha(dados.senha)
    auditoria.registrar(
        sessao,
        AcaoAuditoria.SENHA_ALTERADA,
        usuario_id=usuario.id,
        entidade="usuario",
        entidade_id=usuario.id,
        ip=ip,
    )
    sessao.commit()
