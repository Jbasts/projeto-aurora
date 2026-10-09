import math
import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import status

from app.core.config import PREFIXO_API
from app.core.erros import ErroApi
from app.core.seguranca import assinatura_arquivo, assinatura_arquivo_valida

Variante = Literal["original", "miniatura"]

VALIDADE_SEGUNDOS = 60 * 60
# A expiração é arredondada para cima em janelas de 10 min: a mesma foto gera a mesma URL
# por alguns minutos, e o navegador consegue aproveitar o cache.
JANELA_SEGUNDOS = 10 * 60


# Fotos das contas são assinadas com um prefixo: a assinatura de uma não serve para a outra rota.
PREFIXO_CONTA = "conta:"


def _assinar(caminho: str, chave: str, variante: Variante, agora: datetime | None) -> str:
    agora = agora or datetime.now(UTC)
    expira = math.ceil((agora.timestamp() + VALIDADE_SEGUNDOS) / JANELA_SEGUNDOS) * JANELA_SEGUNDOS
    assinatura = assinatura_arquivo(chave, variante, expira)
    return f"{PREFIXO_API}{caminho}?variante={variante}&exp={expira}&assinatura={assinatura}"


def url_assinada(foto_id: uuid.UUID, variante: Variante, agora: datetime | None = None) -> str:
    """URL de /arquivos/{id} válida por 1 h (até 1 h 10 min), para usar direto em <img>."""
    return _assinar(f"/arquivos/{foto_id}", str(foto_id), variante, agora)


def url_assinada_conta(
    foto_id: uuid.UUID, variante: Variante, agora: datetime | None = None
) -> str:
    """Foto de uma conta: /arquivos/contas/{id}, com a mesma validade."""
    return _assinar(f"/arquivos/contas/{foto_id}", PREFIXO_CONTA + str(foto_id), variante, agora)


def exigir_assinatura_valida(
    foto_id: uuid.UUID, variante: Variante, expira: int, assinatura: str, conta: bool = False
) -> None:
    chave = (PREFIXO_CONTA if conta else "") + str(foto_id)
    if not assinatura_arquivo_valida(chave, variante, expira, assinatura):
        raise ErroApi(
            status.HTTP_403_FORBIDDEN,
            "SEM_PERMISSAO",
            "Link de arquivo inválido ou expirado. Recarregue a página.",
        )
