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


def url_assinada(foto_id: uuid.UUID, variante: Variante, agora: datetime | None = None) -> str:
    """URL de /arquivos/{id} válida por 1 h (até 1 h 10 min), para usar direto em <img>."""
    agora = agora or datetime.now(UTC)
    expira = math.ceil((agora.timestamp() + VALIDADE_SEGUNDOS) / JANELA_SEGUNDOS) * JANELA_SEGUNDOS
    assinatura = assinatura_arquivo(str(foto_id), variante, expira)
    return (
        f"{PREFIXO_API}/arquivos/{foto_id}"
        f"?variante={variante}&exp={expira}&assinatura={assinatura}"
    )


def exigir_assinatura_valida(
    foto_id: uuid.UUID, variante: Variante, expira: int, assinatura: str
) -> None:
    if not assinatura_arquivo_valida(str(foto_id), variante, expira, assinatura):
        raise ErroApi(
            status.HTTP_403_FORBIDDEN,
            "SEM_PERMISSAO",
            "Link de arquivo inválido ou expirado. Recarregue a página.",
        )
