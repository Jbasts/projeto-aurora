"""Testes com banco usam um banco separado: o de desenvolvimento com o sufixo "_teste".

Ele é criado (se não existir) e migrado até a última versão no início da sessão de testes.
Cada teste roda dentro de uma transação desfeita ao final, então os dados não vazam entre testes.
"""

from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, Engine, create_engine, make_url, text
from sqlalchemy.orm import Session

from app.core.config import obter_configuracoes

URL_TESTE = make_url(obter_configuracoes().DATABASE_URL)
URL_TESTE = URL_TESTE.set(database=f"{URL_TESTE.database}_teste")


def _criar_banco_de_teste() -> None:
    with create_engine(
        URL_TESTE.set(database="postgres"), isolation_level="AUTOCOMMIT"
    ).connect() as conexao:
        existe = conexao.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :nome"), {"nome": URL_TESTE.database}
        )
        if not existe:
            conexao.execute(text(f'CREATE DATABASE "{URL_TESTE.database}"'))


def config_alembic() -> Config:
    config = Config("alembic.ini")
    config.attributes["url_banco"] = URL_TESTE.render_as_string(hide_password=False)
    return config


@pytest.fixture(scope="session")
def engine_teste() -> Iterator[Engine]:
    _criar_banco_de_teste()
    command.upgrade(config_alembic(), "head")
    engine = create_engine(URL_TESTE)
    yield engine
    engine.dispose()


@pytest.fixture
def conexao(engine_teste: Engine) -> Iterator[Connection]:
    with engine_teste.connect() as conexao:
        transacao = conexao.begin()
        yield conexao
        transacao.rollback()


@pytest.fixture
def sessao(conexao: Connection) -> Iterator[Session]:
    # commit() dentro do código testado só libera um savepoint; o rollback final desfaz tudo.
    with Session(bind=conexao, join_transaction_mode="create_savepoint") as sessao:
        yield sessao
