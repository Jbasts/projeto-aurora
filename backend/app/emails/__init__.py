from html import escape
from pathlib import Path
from string import Template

from app.services.email import Email

_PASTA = Path(__file__).parent


def _carregar(nome: str) -> Template:
    return Template((_PASTA / nome).read_text(encoding="utf-8"))


def montar_email_redefinicao(
    destinatario: str, nome: str, link: str, minutos_validade: int
) -> Email:
    valores = {"nome": nome, "link": link, "minutos": str(minutos_validade)}
    return Email(
        destinatario=destinatario,
        assunto="Projeto Aurora — redefinição de senha",
        html=_carregar("redefinir_senha.html").substitute(
            {chave: escape(valor) for chave, valor in valores.items()}
        ),
        texto=_carregar("redefinir_senha.txt").substitute(valores),
    )


def montar_email_verificacao(destinatario: str, nome: str, link: str, horas_validade: int) -> Email:
    valores = {"nome": nome, "link": link, "horas": str(horas_validade)}
    return Email(
        destinatario=destinatario,
        assunto="Projeto Aurora — confirme seu email",
        html=_carregar("verificar_email.html").substitute(
            {chave: escape(valor) for chave, valor in valores.items()}
        ),
        texto=_carregar("verificar_email.txt").substitute(valores),
    )


def montar_email_troca(destinatario: str, nome: str, link: str, horas_validade: int) -> Email:
    valores = {"nome": nome, "link": link, "horas": str(horas_validade)}
    return Email(
        destinatario=destinatario,
        assunto="Projeto Aurora — confirme seu novo email",
        html=_carregar("confirmar_novo_email.html").substitute(
            {chave: escape(valor) for chave, valor in valores.items()}
        ),
        texto=_carregar("confirmar_novo_email.txt").substitute(valores),
    )
