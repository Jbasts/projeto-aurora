import uuid
from datetime import datetime
from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.entities import Foto, Pessoa, StatusPessoa

OrdemPessoas = Literal["nome", "visto"]


def buscar_por_id(sessao: Session, pessoa_id: uuid.UUID) -> Pessoa | None:
    return sessao.get(Pessoa, pessoa_id)


def buscar_para_alterar(sessao: Session, pessoa_id: uuid.UUID) -> Pessoa | None:
    """Trava a linha até o fim da transação (ex.: dois envios de foto ao mesmo tempo)."""
    return sessao.get(Pessoa, pessoa_id, with_for_update=True, populate_existing=True)


def adicionar(sessao: Session, pessoa: Pessoa) -> Pessoa:
    sessao.add(pessoa)
    sessao.flush()
    return pessoa


def _texto_busca():
    # Mesma expressão do índice ix_pessoas_busca_trgm (sem acento e minúscula).
    return func.texto_busca_pessoa(Pessoa.nome, Pessoa.sobrenome, Pessoa.apelido)


def _condicao_busca(termo: str):
    """Trecho contido ou semelhança por palavra (pg_trgm + unaccent; tolera erro de digitação)."""
    texto = _texto_busca()
    termo_normalizado = func.lower(func.unaccent(termo))
    semelhanca = func.word_similarity(termo_normalizado, texto)
    padrao = func.concat("%", termo_normalizado, "%")
    return or_(texto.like(padrao), semelhanca >= 0.45), semelhanca


def sugestoes(
    sessao: Session, termo: str, *, somente_ativas: bool, limite: int = 8
) -> list[tuple[Pessoa, Foto | None]]:
    """Nomes parecidos, do mais semelhante para o menos (autocomplete e duplicidade)."""
    condicao, semelhanca = _condicao_busca(termo)
    consulta = (
        select(Pessoa, Foto)
        .outerjoin(Foto, Foto.id == Pessoa.foto_perfil_id)
        .where(condicao)
        .order_by(semelhanca.desc(), Pessoa.nome, Pessoa.sobrenome)
        .limit(limite)
    )
    if somente_ativas:
        consulta = consulta.where(Pessoa.status == StatusPessoa.ATIVA)
    return [(pessoa, foto) for pessoa, foto in sessao.execute(consulta).all()]


def listar(
    sessao: Session,
    *,
    busca: str | None,
    status: StatusPessoa | None,
    visto_desde: datetime | None,
    ordem: OrdemPessoas,
    pagina: int,
    tamanho: int,
) -> tuple[list[tuple[Pessoa, Foto | None]], int]:
    """Tela Buscar (seção 4.3): filtros, ordenação e paginação no servidor."""
    filtros = []
    if busca:
        filtros.append(_condicao_busca(busca)[0])
    if status is not None:
        filtros.append(Pessoa.status == status)
    if visto_desde is not None:
        filtros.append(Pessoa.ultima_vez_visto >= visto_desde)

    total = sessao.scalar(select(func.count()).select_from(Pessoa).where(*filtros)) or 0

    nome = func.lower(func.unaccent(Pessoa.nome))
    sobrenome = func.lower(func.unaccent(Pessoa.sobrenome))
    ordenacao = (
        [Pessoa.ultima_vez_visto.desc().nulls_last(), nome, sobrenome]
        if ordem == "visto"
        else [nome, sobrenome]
    )
    consulta = (
        select(Pessoa, Foto)
        .outerjoin(Foto, Foto.id == Pessoa.foto_perfil_id)
        .where(*filtros)
        .order_by(*ordenacao, Pessoa.id)
        .offset((pagina - 1) * tamanho)
        .limit(tamanho)
    )
    return [(pessoa, foto) for pessoa, foto in sessao.execute(consulta).all()], total


def marcadores(sessao: Session) -> list[tuple[Pessoa, Foto | None]]:
    """PSDR ativas que já têm última localização (seção 3.9)."""
    return [
        (pessoa, foto)
        for pessoa, foto in sessao.execute(
            select(Pessoa, Foto)
            .outerjoin(Foto, Foto.id == Pessoa.foto_perfil_id)
            .where(
                Pessoa.status == StatusPessoa.ATIVA,
                Pessoa.ultima_latitude.is_not(None),
                Pessoa.ultima_longitude.is_not(None),
                Pessoa.ultima_vez_visto.is_not(None),
            )
            .order_by(Pessoa.ultima_vez_visto.desc())
        ).all()
    ]
