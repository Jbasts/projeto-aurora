import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import status
from sqlalchemy.orm import Session

from app.core.erros import ErroApi
from app.entities import Avistamento, Pessoa, StatusPessoa, Usuario
from app.repositories import avistamentos as repositorio_avistamentos
from app.repositories import pessoas as repositorio_pessoas
from app.services import auditoria
from app.services.auditoria import AcaoAuditoria


def historico(
    sessao: Session, pessoa: Pessoa, *, pagina: int, tamanho: int
) -> tuple[list[tuple[Avistamento, Usuario | None]], int]:
    return repositorio_avistamentos.historico(sessao, pessoa.id, pagina=pagina, tamanho=tamanho)


def calor(
    sessao: Session, *, pessoa: Pessoa | None, de: datetime | None, ate: datetime | None
) -> list[tuple[float, float, int]]:
    """Mapa de calor geral (PSDR ativas) ou de uma pessoa, no período pedido."""
    if de is not None and ate is not None and de > ate:
        raise ErroApi(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "VALIDACAO",
            "A data inicial do período não pode ser depois da data final.",
        )
    return repositorio_avistamentos.calor(
        sessao, pessoa_id=pessoa.id if pessoa else None, de=de, ate=ate
    )


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


def registrar_para_pessoa(
    sessao: Session,
    pessoa_id: uuid.UUID,
    *,
    latitude: float,
    longitude: float,
    visto_em: datetime,
    observacao: str | None,
    endereco: str | None,
    usuario: Usuario,
    ip: str | None,
) -> tuple[Avistamento, bool]:
    """Avistamento pelo mapa ou pelo perfil. Devolve (avistamento, se virou o mais recente)."""
    pessoa = repositorio_pessoas.buscar_para_alterar(sessao, pessoa_id)
    if pessoa is None:
        raise ErroApi(status.HTTP_404_NOT_FOUND, "NAO_ENCONTRADO", "Pessoa não encontrada.")
    if pessoa.status != StatusPessoa.ATIVA:
        raise ErroApi(
            status.HTTP_409_CONFLICT,
            "VALIDACAO",
            "Esta pessoa está inativa. Reative o cadastro antes de registrar um avistamento.",
        )
    avistamento = registrar(
        sessao,
        pessoa,
        latitude=latitude,
        longitude=longitude,
        visto_em=visto_em,
        observacao=observacao,
        usuario=usuario,
        ip=ip,
        endereco=endereco,
    )
    mais_recente = pessoa.ultima_vez_visto == avistamento.visto_em
    sessao.commit()
    return avistamento, mais_recente
