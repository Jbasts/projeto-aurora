import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.entities import Foto, Pessoa, StatusPessoa


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


def sugestoes(
    sessao: Session, termo: str, *, somente_ativas: bool, limite: int = 8
) -> list[tuple[Pessoa, Foto | None]]:
    """Nomes parecidos (pg_trgm + unaccent): trecho contido ou semelhança por palavra."""
    texto = _texto_busca()
    termo_normalizado = func.lower(func.unaccent(termo))
    semelhanca = func.word_similarity(termo_normalizado, texto)
    padrao = func.concat("%", termo_normalizado, "%")

    consulta = (
        select(Pessoa, Foto)
        .outerjoin(Foto, Foto.id == Pessoa.foto_perfil_id)
        .where(or_(texto.like(padrao), semelhanca >= 0.45))
        .order_by(semelhanca.desc(), Pessoa.nome, Pessoa.sobrenome)
        .limit(limite)
    )
    if somente_ativas:
        consulta = consulta.where(Pessoa.status == StatusPessoa.ATIVA)
    return [(pessoa, foto) for pessoa, foto in sessao.execute(consulta).all()]
