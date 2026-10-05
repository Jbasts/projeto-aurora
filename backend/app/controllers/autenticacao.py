from typing import Any

from fastapi import BackgroundTasks, Response
from sqlalchemy.orm import Session

from app.core.config import obter_configuracoes
from app.core.seguranca import criar_token
from app.entities import Usuario
from app.schemas.autenticacao import (
    CadastroEntrada,
    EmailEntrada,
    LoginEntrada,
    MensagemSaida,
    RedefinirSenhaEntrada,
    SessaoSaida,
    UsuarioSaida,
    ValidacaoTokenSaida,
)
from app.services import autenticacao as servico_autenticacao
from app.services import recuperacao_senha as servico_recuperacao
from app.services.email import EnviadorEmail, enviar_sem_falhar

COOKIE_REFRESH = "aurora_refresh"
CAMINHO_COOKIE = "/api/v1/auth"

MENSAGEM_CADASTRO_ENVIADO = (
    "Cadastro enviado. Uma pessoa administradora vai analisar e liberar seu acesso."
)


def _parametros_cookie() -> dict[str, Any]:
    return {
        "httponly": True,
        "samesite": "strict",
        "secure": obter_configuracoes().em_producao,
        "path": CAMINHO_COOKIE,
    }


def _abrir_sessao(resposta: Response, usuario: Usuario) -> SessaoSaida:
    resposta.set_cookie(
        COOKIE_REFRESH,
        criar_token(usuario.id, "refresh"),
        max_age=obter_configuracoes().REFRESH_TOKEN_DIAS * 24 * 60 * 60,
        **_parametros_cookie(),
    )
    return SessaoSaida(
        access_token=criar_token(usuario.id, "access"),
        usuario=UsuarioSaida.model_validate(usuario),
    )


def entrar(sessao: Session, dados: LoginEntrada, ip: str | None, resposta: Response) -> SessaoSaida:
    usuario = servico_autenticacao.autenticar(sessao, dados.email, dados.senha, ip)
    return _abrir_sessao(resposta, usuario)


def renovar(sessao: Session, refresh_token: str | None, resposta: Response) -> SessaoSaida:
    usuario = servico_autenticacao.usuario_do_refresh(sessao, refresh_token)
    return _abrir_sessao(resposta, usuario)


def sair(resposta: Response) -> None:
    resposta.delete_cookie(COOKIE_REFRESH, **_parametros_cookie())


def cadastrar(sessao: Session, dados: CadastroEntrada) -> MensagemSaida:
    servico_autenticacao.cadastrar(sessao, dados)
    return MensagemSaida(mensagem=MENSAGEM_CADASTRO_ENVIADO)


def solicitar_recuperacao(
    sessao: Session,
    dados: EmailEntrada,
    tarefas: BackgroundTasks,
    enviador: EnviadorEmail,
) -> MensagemSaida:
    email = servico_recuperacao.solicitar(sessao, dados.email)
    if email is not None:
        # Envio em segundo plano: o tempo de resposta não revela se o email existe.
        tarefas.add_task(enviar_sem_falhar, enviador, email)
    return MensagemSaida(mensagem=servico_recuperacao.MENSAGEM_PEDIDO_RECEBIDO)


def validar_token(sessao: Session, token: str) -> ValidacaoTokenSaida:
    servico_recuperacao.validar(sessao, token)
    return ValidacaoTokenSaida(valido=True)


def redefinir_senha(sessao: Session, dados: RedefinirSenhaEntrada) -> MensagemSaida:
    servico_recuperacao.redefinir(sessao, dados.token, dados.senha)
    return MensagemSaida(mensagem=servico_recuperacao.MENSAGEM_SENHA_ATUALIZADA)
