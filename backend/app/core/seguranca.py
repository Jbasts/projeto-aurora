import hashlib
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import obter_configuracoes

_hasher = PasswordHasher()

TAMANHO_MINIMO_SENHA = 8
ALGORITMO_JWT = "HS256"

TipoToken = Literal["access", "refresh"]

# Hash de uma senha aleatória: quando o email não existe, verificamos a senha contra ele
# para o tempo de resposta ser parecido com o de um email cadastrado (seção 3.1).
_HASH_FALSO = _hasher.hash(secrets.token_urlsafe(16))


def gerar_hash_senha(senha: str) -> str:
    return _hasher.hash(senha)


def verificar_senha(senha: str, senha_hash: str) -> bool:
    try:
        return _hasher.verify(senha_hash, senha)
    except (VerificationError, InvalidHashError):
        return False


def verificar_senha_falsa(senha: str) -> None:
    verificar_senha(senha, _HASH_FALSO)


def senha_atende_requisitos(senha: str) -> bool:
    """Mínimo de 8 caracteres, com pelo menos uma letra e um número (seção 3.3)."""
    return (
        len(senha) >= TAMANHO_MINIMO_SENHA
        and re.search(r"[^\W\d_]", senha) is not None
        and re.search(r"\d", senha) is not None
    )


def normalizar_email(email: str) -> str:
    return email.strip().lower()


# --- Tokens JWT (sessão) ---


def criar_token(usuario_id: uuid.UUID, tipo: TipoToken, agora: datetime | None = None) -> str:
    configuracoes = obter_configuracoes()
    agora = agora or datetime.now(UTC)
    validade = (
        timedelta(minutes=configuracoes.ACCESS_TOKEN_MINUTOS)
        if tipo == "access"
        else timedelta(days=configuracoes.REFRESH_TOKEN_DIAS)
    )
    conteudo = {
        "sub": str(usuario_id),
        "tipo": tipo,
        "iat": agora,
        "exp": agora + validade,
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(conteudo, configuracoes.JWT_SECRET, algorithm=ALGORITMO_JWT)


def ler_token(token: str, tipo: TipoToken) -> uuid.UUID | None:
    """Devolve o id do usuário se o token for válido, não expirado e do tipo esperado."""
    try:
        conteudo = jwt.decode(
            token,
            obter_configuracoes().JWT_SECRET,
            algorithms=[ALGORITMO_JWT],
            options={"require": ["sub", "exp", "tipo"]},
        )
        if conteudo["tipo"] != tipo:
            return None
        return uuid.UUID(conteudo["sub"])
    except (jwt.PyJWTError, ValueError):
        return None


# --- Token de redefinição de senha ---


def gerar_token_redefinicao() -> tuple[str, str]:
    """Devolve (token para o link, hash SHA-256 para o banco). O banco nunca guarda o token."""
    token = secrets.token_urlsafe(32)
    return token, hash_token_redefinicao(token)


def hash_token_redefinicao(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
