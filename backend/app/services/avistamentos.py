from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.entities import Avistamento, Pessoa, Usuario
from app.repositories import avistamentos as repositorio_avistamentos
from app.services import auditoria
from app.services.auditoria import AcaoAuditoria


def _coordenada(valor: float) -> Decimal:
    return Decimal(str(round(valor, 6)))


def registrar(
    sessao: Session,
    pessoa: Pessoa,
    *,
    latitude: float,
    longitude: float,
    visto_em: datetime,
    observacao: str | None,
    usuario: Usuario,
    ip: str | None,
    endereco: str | None = None,
) -> Avistamento:
    """Cria o avistamento e, se for o mais recente, atualiza a última localização da pessoa.

    Não faz commit: quem chama decide a transação (ex.: cadastro da pessoa + 1º avistamento).
    """
    avistamento = repositorio_avistamentos.adicionar(
        sessao,
        Avistamento(
            pessoa_id=pessoa.id,
            latitude=_coordenada(latitude),
            longitude=_coordenada(longitude),
            endereco=endereco,
            visto_em=visto_em,
            observacao=observacao,
            registrado_por_id=usuario.id,
        ),
    )
    if pessoa.ultima_vez_visto is None or visto_em >= pessoa.ultima_vez_visto:
        pessoa.ultima_vez_visto = visto_em
        pessoa.ultima_latitude = avistamento.latitude
        pessoa.ultima_longitude = avistamento.longitude
        pessoa.ultimo_endereco = endereco

    auditoria.registrar(
        sessao,
        AcaoAuditoria.AVISTAMENTO_REGISTRADO,
        usuario_id=usuario.id,
        entidade="avistamento",
        entidade_id=avistamento.id,
        detalhes={"pessoa_id": str(pessoa.id)},
        ip=ip,
    )
    return avistamento
