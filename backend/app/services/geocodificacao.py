"""Endereço aproximado por geocodificação reversa (Nominatim / OpenStreetMap), seção 3.9.

Regras de uso do Nominatim: User-Agent próprio, no máximo 1 requisição por segundo e cache.
Qualquer falha devolve None: o avistamento é salvo só com as coordenadas.
"""

import logging
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Protocol

import httpx

from app.core.config import obter_configuracoes

logger = logging.getLogger(__name__)

URL_NOMINATIM = "https://nominatim.openstreetmap.org/reverse"
INTERVALO_MINIMO_SEGUNDOS = 1.0
TEMPO_LIMITE_SEGUNDOS = 4.0
TAMANHO_CACHE = 2000
# 4 casas decimais ≈ 11 m: pontos vizinhos reaproveitam o mesmo endereço.
CASAS_DECIMAIS_CACHE = 4


class Geocodificador(Protocol):
    def endereco(self, latitude: float, longitude: float) -> str | None: ...


def formatar_endereco(resposta: dict) -> str | None:
    """Ex.: "Rua do Imperador, 288 – Centro, Petrópolis". Cai para display_name se faltar."""
    partes = resposta.get("address") or {}
    via = partes.get("road") or partes.get("pedestrian") or partes.get("footway")
    if via and partes.get("house_number"):
        via = f"{via}, {partes['house_number']}"
    bairro = partes.get("suburb") or partes.get("neighbourhood") or partes.get("quarter")
    cidade = partes.get("city") or partes.get("town") or partes.get("village")

    if via:
        regiao = ", ".join(p for p in (bairro, cidade) if p)
        return f"{via} – {regiao}" if regiao else via
    nome_completo = resposta.get("display_name")
    return str(nome_completo)[:300] if nome_completo else None


class GeocodificadorNominatim:
    def __init__(
        self,
        cliente: httpx.Client | None = None,
        relogio: Callable[[], float] = time.monotonic,
        dormir: Callable[[float], None] = time.sleep,
    ) -> None:
        self._cliente = cliente
        self._relogio = relogio
        self._dormir = dormir
        self._cache: OrderedDict[tuple[float, float], str | None] = OrderedDict()
        self._trava = threading.Lock()
        self._ultima_requisicao: float | None = None

    def _http(self) -> httpx.Client:
        if self._cliente is None:
            self._cliente = httpx.Client(
                timeout=TEMPO_LIMITE_SEGUNDOS,
                headers={"User-Agent": obter_configuracoes().NOMINATIM_USER_AGENT},
            )
        return self._cliente

    def endereco(self, latitude: float, longitude: float) -> str | None:
        chave = (round(latitude, CASAS_DECIMAIS_CACHE), round(longitude, CASAS_DECIMAIS_CACHE))
        # A trava serializa as consultas: garante o intervalo de 1 s entre elas.
        with self._trava:
            if chave in self._cache:
                self._cache.move_to_end(chave)
                return self._cache[chave]

            if self._ultima_requisicao is not None:
                espera = INTERVALO_MINIMO_SEGUNDOS - (self._relogio() - self._ultima_requisicao)
                if espera > 0:
                    self._dormir(espera)
            try:
                resposta = self._http().get(
                    URL_NOMINATIM,
                    params={
                        "format": "jsonv2",
                        "lat": chave[0],
                        "lon": chave[1],
                        "zoom": 18,
                        "addressdetails": 1,
                        "accept-language": "pt-BR",
                    },
                )
                resposta.raise_for_status()
                endereco = formatar_endereco(resposta.json())
            except (httpx.HTTPError, ValueError):
                # Sem coordenadas no log: são dados de localização de PSDR.
                logger.warning("Geocodificação reversa indisponível; salvando só as coordenadas.")
                self._ultima_requisicao = self._relogio()
                return None  # falhas não vão para o cache: a próxima tentativa pode funcionar
            self._ultima_requisicao = self._relogio()

            self._cache[chave] = endereco
            if len(self._cache) > TAMANHO_CACHE:
                self._cache.popitem(last=False)
            return endereco


_geocodificador = GeocodificadorNominatim()


def obter_geocodificador() -> Geocodificador:
    """Dependência do FastAPI; os testes a substituem para não acessar a internet."""
    return _geocodificador
