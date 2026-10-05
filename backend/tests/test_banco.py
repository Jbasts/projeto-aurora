import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Connection, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.seguranca import gerar_hash_senha
from app.db.base import Base
from app.entities import PerfilUsuario, Pessoa, StatusPessoa, StatusUsuario, Usuario
from app.entities.pessoa import INDICE_BUSCA_TRGM
from tests.conftest import config_alembic


def _usuario(sessao: Session, email: str = "teste@exemplo.com") -> Usuario:
    usuario = Usuario(nome="Pessoa Teste", email=email, senha_hash=gerar_hash_senha("abc12345"))
    sessao.add(usuario)
    sessao.flush()
    return usuario


def test_extensoes_instaladas(conexao: Connection):
    extensoes = set(conexao.scalars(text("SELECT extname FROM pg_extension")))
    assert {"citext", "unaccent", "pg_trgm"} <= extensoes


def test_modelos_e_migracoes_estao_sincronizados(conexao: Connection):
    contexto = MigrationContext.configure(
        conexao,
        opts={"include_object": lambda _o, nome, tipo, *_: nome != INDICE_BUSCA_TRGM},
    )
    assert compare_metadata(contexto, Base.metadata) == []


def test_migracao_desfaz_e_refaz(engine_teste):
    config = config_alembic()
    command.downgrade(config, "base")
    with engine_teste.connect() as conexao:
        tabelas = set(
            conexao.scalars(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
        )
        assert tabelas <= {"alembic_version"}
    command.upgrade(config, "head")


def test_usuario_nasce_padrao_e_pendente(sessao: Session):
    usuario = _usuario(sessao)
    sessao.refresh(usuario)
    assert usuario.perfil == PerfilUsuario.PADRAO
    assert usuario.status == StatusUsuario.PENDENTE
    assert usuario.tentativas_falhas == 0
    assert usuario.criado_em is not None


def test_email_de_usuario_e_unico_sem_diferenciar_maiusculas(sessao: Session):
    _usuario(sessao, "Maria@Exemplo.com")
    assert sessao.scalar(select(Usuario).where(Usuario.email == "maria@exemplo.com")) is not None
    with pytest.raises(IntegrityError):
        _usuario(sessao, "MARIA@exemplo.com")


def test_pessoa_nasce_ativa(sessao: Session):
    usuario = _usuario(sessao)
    pessoa = Pessoa(
        nome="Ana", sobrenome="Souza", consentimento=False, cadastrada_por_id=usuario.id
    )
    sessao.add(pessoa)
    sessao.flush()
    sessao.refresh(pessoa)
    assert pessoa.status == StatusPessoa.ATIVA


def test_idade_aproximada_fora_do_intervalo_e_recusada(sessao: Session):
    usuario = _usuario(sessao)
    sessao.add(
        Pessoa(
            nome="Ana",
            sobrenome="Souza",
            idade_aproximada=200,
            consentimento=False,
            cadastrada_por_id=usuario.id,
        )
    )
    with pytest.raises(IntegrityError):
        sessao.flush()


def test_busca_ignora_acentos_e_maiusculas(sessao: Session):
    usuario = _usuario(sessao)
    sessao.add_all(
        [
            Pessoa(
                nome="José",
                sobrenome="Conceição",
                apelido="Tião",
                consentimento=False,
                cadastrada_por_id=usuario.id,
            ),
            Pessoa(
                nome="Maria", sobrenome="Lima", consentimento=False, cadastrada_por_id=usuario.id
            ),
        ]
    )
    sessao.flush()

    texto = func.texto_busca_pessoa(Pessoa.nome, Pessoa.sobrenome, Pessoa.apelido)

    def buscar(termo: str) -> list[str]:
        normalizado = func.lower(func.unaccent(termo))
        consulta = select(Pessoa.nome).where(texto.contains(normalizado))
        return list(sessao.scalars(consulta))

    assert buscar("jose") == ["José"]
    assert buscar("TIAO") == ["José"]
    assert buscar("conceicao") == ["José"]
    assert buscar("josé conceição") == ["José"]
    assert buscar("LIMA") == ["Maria"]


def test_indice_trigram_existe(conexao: Connection):
    definicao = conexao.scalar(
        text("SELECT indexdef FROM pg_indexes WHERE indexname = :nome"),
        {"nome": INDICE_BUSCA_TRGM},
    )
    assert "gin" in definicao
    assert "texto_busca_pessoa" in definicao
    assert "gin_trgm_ops" in definicao
