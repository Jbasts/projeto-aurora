from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

# app.entities registra os modelos em Base.metadata para o autogenerate.
import app.entities  # noqa: F401
from app.core.config import obter_configuracoes
from app.db.base import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
URL_BANCO = obter_configuracoes().DATABASE_URL


def run_migrations_offline() -> None:
    context.configure(
        url=URL_BANCO,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(URL_BANCO, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
