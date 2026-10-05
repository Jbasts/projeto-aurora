from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

# app.entities registra os modelos em Base.metadata para o autogenerate.
import app.entities  # noqa: F401
from app.core.config import obter_configuracoes
from app.db.base import Base
from app.entities.pessoa import INDICE_BUSCA_TRGM

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
URL_BANCO = config.attributes.get("url_banco") or obter_configuracoes().DATABASE_URL

# Objetos criados à mão nas migrações, que o autogenerate não deve tentar remover.
OBJETOS_MANUAIS = {INDICE_BUSCA_TRGM}


def incluir_objeto(objeto, nome, tipo, refletido, comparado_com) -> bool:
    return not (tipo == "index" and nome in OBJETOS_MANUAIS)


def run_migrations_offline() -> None:
    context.configure(
        url=URL_BANCO,
        target_metadata=target_metadata,
        literal_binds=True,
        include_object=incluir_objeto,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(URL_BANCO, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=incluir_objeto,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
