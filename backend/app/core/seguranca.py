import re

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()

TAMANHO_MINIMO_SENHA = 8


def gerar_hash_senha(senha: str) -> str:
    return _hasher.hash(senha)


def verificar_senha(senha: str, senha_hash: str) -> bool:
    try:
        return _hasher.verify(senha_hash, senha)
    except (VerificationError, InvalidHashError):
        return False


def senha_atende_requisitos(senha: str) -> bool:
    """Mínimo de 8 caracteres, com pelo menos uma letra e um número (seção 3.3)."""
    return (
        len(senha) >= TAMANHO_MINIMO_SENHA
        and re.search(r"[^\W\d_]", senha) is not None
        and re.search(r"\d", senha) is not None
    )


def normalizar_email(email: str) -> str:
    return email.strip().lower()
