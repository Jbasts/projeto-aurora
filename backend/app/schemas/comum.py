import re
from typing import Annotated

from email_validator import EmailNotValidError, validate_email
from pydantic import AfterValidator, BaseModel, BeforeValidator, Field

from app.core.config import obter_configuracoes
from app.core.seguranca import normalizar_email, senha_atende_requisitos

# Paginação de todas as listagens: 5 por página, ajustável até 100.
TAMANHO_PAGINA_PADRAO = 5
TAMANHO_PAGINA_MAXIMO = 100

MENSAGEM_REQUISITOS_SENHA = (
    "A senha precisa ter pelo menos 8 caracteres, com pelo menos uma letra e um número."
)


_EMAIL_LOCAL = re.compile(r"[^@\s]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.local")


def _email_local_de_desenvolvimento(email: str) -> bool:
    # A validação recusa ".local" (domínio reservado), mas é o domínio do admin padrão e das
    # contas de teste do seed, e o Mailpit recebe qualquer endereço. Só fora de produção.
    return not obter_configuracoes().em_producao and _EMAIL_LOCAL.fullmatch(email) is not None


def validar_email(valor: str) -> str:
    valor = normalizar_email(valor)
    try:
        validate_email(valor, check_deliverability=False)
    except EmailNotValidError as erro:
        if not _email_local_de_desenvolvimento(valor):
            raise ValueError("Informe um email válido.") from erro
    return valor


def validar_senha(valor: str) -> str:
    if not senha_atende_requisitos(valor):
        raise ValueError(MENSAGEM_REQUISITOS_SENHA)
    return valor


def formatar_telefone(valor: str | None) -> str | None:
    """Aceita qualquer formatação e devolve (00) 00000-0000 ou (00) 0000-0000."""
    if valor is None or not valor.strip():
        return None
    digitos = re.sub(r"\D", "", valor)
    if len(digitos) == 11:
        return f"({digitos[:2]}) {digitos[2:7]}-{digitos[7:]}"
    if len(digitos) == 10:
        return f"({digitos[:2]}) {digitos[2:6]}-{digitos[6:]}"
    raise ValueError("Informe o telefone com DDD, no formato (00) 00000-0000.")


def formatar_cep(valor: str) -> str:
    """Aceita com ou sem traço e devolve 00000-000."""
    digitos = re.sub(r"\D", "", valor)
    if len(digitos) != 8:
        raise ValueError("Informe o CEP com 8 dígitos, no formato 00000-000.")
    return f"{digitos[:5]}-{digitos[5:]}"


UFS = frozenset(
    "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split()
)


def validar_uf(valor: str) -> str:
    valor = valor.upper()
    if valor not in UFS:
        raise ValueError("Escolha o estado (UF).")
    return valor


def _aparar(valor: object) -> object:
    return valor.strip() if isinstance(valor, str) else valor


def _vazio_para_nulo(valor: object) -> object:
    valor = _aparar(valor)
    return valor or None


TextoAparado = Annotated[str, BeforeValidator(_aparar)]
EmailValido = Annotated[str, Field(max_length=254), AfterValidator(validar_email)]
SenhaForte = Annotated[str, Field(max_length=128), AfterValidator(validar_senha)]
Telefone = Annotated[str | None, Field(max_length=20), AfterValidator(formatar_telefone)]
Cep = Annotated[str, BeforeValidator(_aparar), Field(max_length=9), AfterValidator(formatar_cep)]
Uf = Annotated[str, BeforeValidator(_aparar), Field(max_length=2), AfterValidator(validar_uf)]
TextoOpcional = Annotated[str | None, BeforeValidator(_vazio_para_nulo)]


class ComEndereco(BaseModel):
    """Endereço da conta. O frontend preenche logradouro, bairro, cidade e UF pelo ViaCEP."""

    cep: Cep
    logradouro: TextoAparado = Field(min_length=2, max_length=200)
    numero: TextoAparado = Field(min_length=1, max_length=20)
    complemento: TextoOpcional = Field(default=None, max_length=100)
    bairro: TextoOpcional = Field(default=None, max_length=100)
    cidade: TextoAparado = Field(min_length=2, max_length=100)
    uf: Uf


CAMPOS_ENDERECO = tuple(ComEndereco.model_fields)
