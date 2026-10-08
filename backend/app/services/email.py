import logging
import smtplib
import ssl
from collections.abc import Callable
from dataclasses import dataclass
from email.message import EmailMessage

from app.core.config import obter_configuracoes

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Email:
    destinatario: str
    assunto: str
    html: str
    texto: str


EnviadorEmail = Callable[[Email], None]


def enviar_smtp(email: Email) -> None:
    configuracoes = obter_configuracoes()
    mensagem = EmailMessage()
    mensagem["From"] = configuracoes.SMTP_REMETENTE
    mensagem["To"] = email.destinatario
    mensagem["Subject"] = email.assunto
    mensagem.set_content(email.texto)
    mensagem.add_alternative(email.html, subtype="html")

    with smtplib.SMTP(configuracoes.SMTP_HOST, configuracoes.SMTP_PORT, timeout=10) as smtp:
        if configuracoes.SMTP_STARTTLS:
            smtp.starttls(context=ssl.create_default_context())
        if configuracoes.SMTP_USUARIO:
            smtp.login(configuracoes.SMTP_USUARIO, configuracoes.SMTP_SENHA)
        smtp.send_message(mensagem)


def obter_enviador_email() -> EnviadorEmail:
    """Dependência do FastAPI; os testes a substituem para capturar os emails."""
    return enviar_smtp


def enviar_sem_falhar(enviador: EnviadorEmail, email: Email) -> None:
    """Usado em segundo plano: uma falha de SMTP não pode derrubar a requisição."""
    try:
        enviador(email)
    except Exception:
        # Sem o endereço no log: só o assunto, para diagnóstico.
        logger.exception("Falha ao enviar email (%s).", email.assunto)
