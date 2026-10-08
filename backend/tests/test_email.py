from app.core.config import obter_configuracoes
from app.services import email as servico_email
from app.services.email import Email

EMAIL = Email(destinatario="ana@gmail.com", assunto="Assunto", html="<p>Oi</p>", texto="Oi")


class SmtpFalso:
    """Registra as chamadas no lugar do smtplib.SMTP."""

    chamadas: list[tuple] = []

    def __init__(self, host, porta, timeout):
        SmtpFalso.chamadas = [("conectar", host, porta)]

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def starttls(self, context):
        SmtpFalso.chamadas.append(("starttls",))

    def login(self, usuario, senha):
        SmtpFalso.chamadas.append(("login", usuario, senha))

    def send_message(self, mensagem):
        SmtpFalso.chamadas.append(("enviar", mensagem["From"], mensagem["To"]))


def test_mailpit_sem_tls_nem_login(monkeypatch):
    configuracoes = obter_configuracoes()
    monkeypatch.setattr(configuracoes, "SMTP_STARTTLS", False)
    monkeypatch.setattr(configuracoes, "SMTP_USUARIO", "")
    monkeypatch.setattr(servico_email.smtplib, "SMTP", SmtpFalso)
    servico_email.enviar_smtp(EMAIL)
    assert [c[0] for c in SmtpFalso.chamadas] == ["conectar", "enviar"]


def test_gmail_com_starttls_e_login(monkeypatch):
    configuracoes = obter_configuracoes()
    for chave, valor in {
        "SMTP_HOST": "smtp.gmail.com",
        "SMTP_PORT": 587,
        "SMTP_STARTTLS": True,
        "SMTP_USUARIO": "aurora@gmail.com",
        "SMTP_SENHA": "senha-de-app",
        "SMTP_REMETENTE": "Projeto Aurora <aurora@gmail.com>",
    }.items():
        monkeypatch.setattr(configuracoes, chave, valor)
    monkeypatch.setattr(servico_email.smtplib, "SMTP", SmtpFalso)

    servico_email.enviar_smtp(EMAIL)

    assert SmtpFalso.chamadas == [
        ("conectar", "smtp.gmail.com", 587),
        ("starttls",),
        ("login", "aurora@gmail.com", "senha-de-app"),
        ("enviar", "Projeto Aurora <aurora@gmail.com>", "ana@gmail.com"),
    ]
