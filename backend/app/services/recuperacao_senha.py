from datetime import UTC, datetime, timedelta

from fastapi import status
from sqlalchemy.orm import Session

from app.core.config import obter_configuracoes
from app.core.erros import ErroApi
from app.core.seguranca import gerar_hash_senha, gerar_token_redefinicao, hash_token_redefinicao
from app.emails import montar_email_redefinicao
from app.entities import TokenRedefinicaoSenha
from app.repositories import tokens_redefinicao as repositorio_tokens
from app.repositories import usuarios as repositorio_usuarios
from app.services.email import Email

MENSAGEM_PEDIDO_RECEBIDO = (
    "Se este email estiver cadastrado, você vai receber um link para criar uma nova senha."
)
MENSAGEM_SENHA_ATUALIZADA = "Senha atualizada. Faça login com a nova senha."


def solicitar(sessao: Session, email: str, agora: datetime | None = None) -> Email | None:
    """Cria um token e devolve o email a enviar, ou None (email desconhecido ou limite atingido).

    A resposta da API é sempre a mesma, para não revelar se o email está cadastrado.
    """
    configuracoes = obter_configuracoes()
    agora = agora or datetime.now(UTC)

    usuario = repositorio_usuarios.buscar_por_email(sessao, email)
    if usuario is None:
        return None

    pedidos_na_ultima_hora = repositorio_tokens.contar_criados_desde(
        sessao, usuario.id, agora - timedelta(hours=1)
    )
    if pedidos_na_ultima_hora >= configuracoes.MAX_PEDIDOS_RECUPERACAO_POR_HORA:
        return None

    # Um novo pedido invalida os anteriores.
    repositorio_tokens.invalidar_pendentes(sessao, usuario.id, agora)
    token, token_hash = gerar_token_redefinicao()
    repositorio_tokens.adicionar(
        sessao,
        TokenRedefinicaoSenha(
            usuario_id=usuario.id,
            token_hash=token_hash,
            expira_em=agora + timedelta(minutes=configuracoes.MINUTOS_VALIDADE_TOKEN_SENHA),
            criado_em=agora,
        ),
    )
    sessao.commit()

    return montar_email_redefinicao(
        destinatario=usuario.email,
        nome=usuario.nome,
        link=f"{configuracoes.FRONTEND_URL}/redefinir-senha?token={token}",
        minutos_validade=configuracoes.MINUTOS_VALIDADE_TOKEN_SENHA,
    )


def _token_valido(sessao: Session, token: str, agora: datetime) -> TokenRedefinicaoSenha:
    registro = repositorio_tokens.buscar_por_hash(sessao, hash_token_redefinicao(token))
    if registro is None or registro.usado_em is not None or registro.expira_em <= agora:
        raise ErroApi(
            status.HTTP_400_BAD_REQUEST,
            "TOKEN_INVALIDO",
            "Este link não é mais válido. Solicite um novo link para redefinir sua senha.",
        )
    return registro


def validar(sessao: Session, token: str, agora: datetime | None = None) -> None:
    _token_valido(sessao, token, agora or datetime.now(UTC))


def redefinir(sessao: Session, token: str, nova_senha: str, agora: datetime | None = None) -> None:
    agora = agora or datetime.now(UTC)
    registro = _token_valido(sessao, token, agora)
    usuario = repositorio_usuarios.buscar_por_id(sessao, registro.usuario_id)
    assert usuario is not None  # FK garante

    usuario.senha_hash = gerar_hash_senha(nova_senha)
    usuario.tentativas_falhas = 0
    usuario.bloqueado_ate = None
    # O link chegou na caixa de entrada da pessoa: isso também confirma o email.
    if usuario.email_verificado_em is None:
        usuario.email_verificado_em = agora
    # Uso único: este e qualquer outro token pendente deixam de valer.
    repositorio_tokens.invalidar_pendentes(sessao, usuario.id, agora)
    sessao.commit()
