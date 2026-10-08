"""Confirmação do email da conta: link com token de uso único, enviado no cadastro.

Sem o email confirmado, a conta não entra e não aparece para a pessoa administradora aprovar.
"""

from datetime import UTC, datetime, timedelta

from fastapi import status
from sqlalchemy.orm import Session

from app.core.config import obter_configuracoes
from app.core.erros import ErroApi
from app.core.seguranca import gerar_token_redefinicao, hash_token_redefinicao
from app.emails import montar_email_verificacao
from app.entities import TokenVerificacaoEmail, Usuario
from app.repositories import tokens_verificacao_email as repositorio_tokens
from app.repositories import usuarios as repositorio_usuarios
from app.services import auditoria
from app.services.auditoria import AcaoAuditoria
from app.services.email import Email

MENSAGEM_REENVIO = (
    "Se este email estiver cadastrado e ainda não tiver sido confirmado, "
    "você vai receber um novo link de confirmação."
)
MENSAGEM_EMAIL_CONFIRMADO = (
    "Email confirmado. Uma pessoa administradora vai analisar seu cadastro e liberar seu acesso."
)


def gerar_email(sessao: Session, usuario: Usuario, agora: datetime | None = None) -> Email:
    """Cria um token (invalidando os anteriores) e monta o email com o link. Não faz commit."""
    configuracoes = obter_configuracoes()
    agora = agora or datetime.now(UTC)

    repositorio_tokens.invalidar_pendentes(sessao, usuario.id, agora)
    token, token_hash = gerar_token_redefinicao()
    repositorio_tokens.adicionar(
        sessao,
        TokenVerificacaoEmail(
            usuario_id=usuario.id,
            token_hash=token_hash,
            expira_em=agora + timedelta(hours=configuracoes.HORAS_VALIDADE_TOKEN_EMAIL),
            criado_em=agora,
        ),
    )
    return montar_email_verificacao(
        destinatario=usuario.email,
        nome=usuario.nome,
        link=f"{configuracoes.FRONTEND_URL}/verificar-email?token={token}",
        horas_validade=configuracoes.HORAS_VALIDADE_TOKEN_EMAIL,
    )


def reenviar(sessao: Session, email: str, agora: datetime | None = None) -> Email | None:
    """Novo link, ou None (email desconhecido, já confirmado ou limite atingido).

    A resposta da API é sempre a mesma, para não revelar se o email está cadastrado.
    """
    configuracoes = obter_configuracoes()
    agora = agora or datetime.now(UTC)

    usuario = repositorio_usuarios.buscar_por_email(sessao, email)
    if usuario is None or usuario.email_verificado_em is not None:
        return None
    pedidos_na_ultima_hora = repositorio_tokens.contar_criados_desde(
        sessao, usuario.id, agora - timedelta(hours=1)
    )
    if pedidos_na_ultima_hora >= configuracoes.MAX_REENVIOS_VERIFICACAO_POR_HORA:
        return None

    mensagem = gerar_email(sessao, usuario, agora)
    sessao.commit()
    return mensagem


def confirmar(sessao: Session, token: str, ip: str | None, agora: datetime | None = None) -> None:
    agora = agora or datetime.now(UTC)
    registro = repositorio_tokens.buscar_por_hash(sessao, hash_token_redefinicao(token))
    if registro is None or registro.usado_em is not None or registro.expira_em <= agora:
        raise ErroApi(
            status.HTTP_400_BAD_REQUEST,
            "TOKEN_INVALIDO",
            "Este link de confirmação não é mais válido. Ele expirou ou já foi usado.",
        )
    usuario = repositorio_usuarios.buscar_por_id(sessao, registro.usuario_id)
    assert usuario is not None  # FK garante

    usuario.email_verificado_em = agora
    repositorio_tokens.invalidar_pendentes(sessao, usuario.id, agora)
    auditoria.registrar(
        sessao,
        AcaoAuditoria.EMAIL_VERIFICADO,
        usuario_id=usuario.id,
        entidade="usuario",
        entidade_id=usuario.id,
        ip=ip,
    )
    sessao.commit()
