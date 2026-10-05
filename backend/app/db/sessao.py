from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import obter_configuracoes

engine = create_engine(obter_configuracoes().DATABASE_URL, pool_pre_ping=True)
SessaoLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def obter_sessao() -> Iterator[Session]:
    with SessaoLocal() as sessao:
        yield sessao
