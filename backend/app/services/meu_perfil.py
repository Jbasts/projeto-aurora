from fastapi import status
from sqlalchemy.orm import Session

from app.core.erros import ErroApi
from app.core.seguranca import gerar_hash_senha, verificar_senha
from app.entities import Usuario
from app.schemas.comum import CAMPOS_ENDERECO
from app.schemas.usuarios import MeuPerfilEntrada, PedidoAlteracaoEntrada, TrocarSenhaEntrada
from app.services import auditoria, solicitacoes
from app.services.auditoria import AcaoAuditoria
from app.services.email import Email

MENSAGEM_SENHA_ATUAL_INCORRETA = "Senha atual incorreta."
MENSAGEM_SENHA_INCORRETA = "Senha incorreta."


def pedir_alteracao(
    sessao: Session, usuario: Usuario, dados: PedidoAlteracaoEntrada, ip: str | None
) -> Email | None:
    """Solicitações de troca de email e/ou CPF, com a senha da conta.

    Só valem com aprovação de ADMIN (app/services/solicitacoes.py).

    Devolve o email com o link para o endereço novo, se houver troca de email.
    """
    if not verificar_senha(dados.senha, usuario.senha_hash):
        raise ErroApi(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "VALIDACAO",
            "Dados inválidos.",
            campos=[{"campo": "senha", "mensagem": MENSAGEM_SENHA_INCORRETA}],
        )
    # Se uma das trocas for recusada, nada é gravado: a sessão da requisição é descartada.
    email = solicitacoes.pedir_email(sessao, usuario, dados.email, ip) if dados.email else None
    if dados.cpf:
        solicitacoes.pedir_cpf(sessao, usuario, dados.cpf, ip)
    sessao.commit()
    return email


def atualizar_dados(
    sessao: Session, usuario: Usuario, dados: MeuPerfilEntrada, ip: str | None
) -> Usuario:
    """Nome, sobrenome, celular e endereço. CPF, email e perfil não mudam por aqui (seção 3.6)."""
    alterados = [
        campo
        for campo in ("nome", "sobrenome", "data_nascimento", "telefone", *CAMPOS_ENDERECO)
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
