import pytest

from app.core.config import obter_configuracoes
from app.schemas.comum import formatar_telefone, validar_email


@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [
        (" Ana@Exemplo.COM ", "ana@exemplo.com"),
        ("admin@projetoaurora.local", "admin@projetoaurora.local"),
    ],
)
def test_emails_aceitos(entrada, esperado):
    assert validar_email(entrada) == esperado


@pytest.mark.parametrize("entrada", ["sem-arroba", "a@", "@exemplo.com", "a b@exemplo.com"])
def test_emails_recusados(entrada):
    with pytest.raises(ValueError, match="Informe um email válido."):
        validar_email(entrada)


def test_email_local_e_recusado_em_producao(monkeypatch):
    monkeypatch.setattr(obter_configuracoes(), "AMBIENTE", "producao")
    with pytest.raises(ValueError):
        validar_email("admin@projetoaurora.local")


@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [
        ("24988887777", "(24) 98888-7777"),
        ("(24) 98888-7777", "(24) 98888-7777"),
        ("24 2222-3333", "(24) 2222-3333"),
        ("", None),
        (None, None),
    ],
)
def test_formatar_telefone(entrada, esperado):
    assert formatar_telefone(entrada) == esperado


@pytest.mark.parametrize("entrada", ["123", "249888877771"])
def test_telefone_invalido(entrada):
    with pytest.raises(ValueError):
        formatar_telefone(entrada)
