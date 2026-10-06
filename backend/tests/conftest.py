"""Testes com banco usam um banco separado: o de desenvolvimento com o sufixo "_teste".

Ele é criado (se não existir) e migrado até a última versão no início da sessão de testes.
Cada teste roda dentro de uma transação desfeita ao final, então os dados não vazam entre testes.
"""

from collections.abc import Callable, Iterator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Connection, Engine, create_engine, make_url, text
from sqlalchemy.orm import Session

from app.core.config import obter_configuracoes
from app.core.limite import limiter
from app.core.seguranca import gerar_hash_senha
from app.db.sessao import obter_sessao
from app.entities import PerfilUsuario, StatusUsuario, Usuario
from app.main import app
from app.services.email import Email, obter_enviador_email
from app.services.geocodificacao import obter_geocodificador

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


# --- API ---


@pytest.fixture
def emails_enviados() -> list[Email]:
    return []


class GeocodificadorFalso:
    """Substitui o Nominatim: os testes nunca acessam a internet."""

    def __init__(self) -> None:
        self.resposta: str | None = "Rua do Imperador, 288 – Centro, Petrópolis"
        self.consultas: list[tuple[float, float]] = []

    def endereco(self, latitude: float, longitude: float) -> str | None:
        self.consultas.append((latitude, longitude))
        return self.resposta


@pytest.fixture
def geocodificador() -> GeocodificadorFalso:
    return GeocodificadorFalso()


@pytest.fixture
def cliente(
    sessao: Session, emails_enviados: list[Email], geocodificador: GeocodificadorFalso
) -> Iterator[TestClient]:
    """Cliente HTTP da API usando a sessão do teste, capturando emails e sem internet."""
    app.dependency_overrides[obter_sessao] = lambda: sessao
    app.dependency_overrides[obter_enviador_email] = lambda: emails_enviados.append
    app.dependency_overrides[obter_geocodificador] = lambda: geocodificador
    limiter.enabled = False
    with TestClient(app) as cliente:
        yield cliente
    limiter.enabled = True
    app.dependency_overrides.clear()


@pytest.fixture
def criar_usuario(sessao: Session) -> Callable[..., Usuario]:
    def criar(
        email: str = "pessoa@exemplo.com",
        senha: str = "SenhaBoa123",
        perfil: PerfilUsuario = PerfilUsuario.COLABORADOR,
        status: StatusUsuario = StatusUsuario.ATIVO,
        nome: str = "Pessoa de Teste",
    ) -> Usuario:
        usuario = Usuario(
            nome=nome,
            email=email,
            senha_hash=gerar_hash_senha(senha),
            perfil=perfil,
            status=status,
        )
        sessao.add(usuario)
        sessao.flush()
        return usuario

    return criar
