"""Testes com banco usam um banco separado: o de desenvolvimento com o sufixo "_teste".

Ele é criado (se não existir) e migrado até a última versão no início da sessão de testes.
Cada teste roda dentro de uma transação desfeita ao final, então os dados não vazam entre testes.
"""

from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from io import BytesIO
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from httpx import Response
from PIL import Image
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

# Endereço válido para cadastro e Meu perfil.
ENDERECO = {
    "cep": "25651000",
    "logradouro": "Rua Afrânio de Melo Franco",
    "numero": "333",
    "complemento": "",
    "bairro": "Quitandinha",
    "cidade": "Petrópolis",
    "uf": "rj",
}

# CPF fictício com dígitos verificadores válidos.
CPF = "529.982.247-25"
# Campos obrigatórios do Meu perfil além do nome.
MEUS_DADOS = {
    "sobrenome": "Souza",
    "data_nascimento": "1990-05-20",
    "telefone": "24988887777",
    **ENDERECO,
}


def foto_png(largura: int = 120, altura: int = 120) -> bytes:
    """Imagem fictícia (um quadrado colorido) para a foto da conta."""
    saida = BytesIO()
    Image.new("RGB", (largura, altura), (30, 120, 100)).save(saida, "PNG")
    return saida.getvalue()


def postar_cadastro(
    cliente: TestClient, dados: dict[str, Any], foto: bytes | None = None
) -> Response:
    """POST /auth/cadastro em multipart: os campos do formulário e a foto."""
    campos = {chave: str(valor) for chave, valor in dados.items() if valor is not None}
    arquivos = {"foto": ("foto.png", foto if foto is not None else foto_png(), "image/png")}
    return cliente.post("/api/v1/auth/cadastro", data=campos, files=arquivos)


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


@pytest.fixture(autouse=True)
def pasta_de_uploads(tmp_path, monkeypatch):
    """Fotos gravadas pelos testes vão para uma pasta temporária."""
    monkeypatch.setattr(obter_configuracoes(), "UPLOAD_DIR", str(tmp_path))
    return tmp_path


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
        email_verificado: bool = True,
        cpf: str | None = None,
    ) -> Usuario:
        usuario = Usuario(
            nome=nome,
            email=email,
            senha_hash=gerar_hash_senha(senha),
            perfil=perfil,
            status=status,
            email_verificado_em=datetime.now(UTC) if email_verificado else None,
            cpf=cpf,
        )
        sessao.add(usuario)
        sessao.flush()
        return usuario

    return criar
