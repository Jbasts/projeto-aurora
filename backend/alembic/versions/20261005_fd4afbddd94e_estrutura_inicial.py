"""estrutura inicial: extensões, tabelas, enums, busca sem acento (trigram)

Revision ID: fd4afbddd94e
Revises: 
Create Date: 2026-10-05 13:33:47.069619

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'fd4afbddd94e'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Texto de busca da PSDR: nome + sobrenome + apelido, sem acentos e em minúsculas.
# unaccent com dicionário explícito é estável, o que permite declarar a função IMMUTABLE
# e usá-la num índice. As consultas devem chamar exatamente esta função.
FUNCAO_TEXTO_BUSCA = """
CREATE FUNCTION texto_busca_pessoa(nome text, sobrenome text, apelido text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT lower(public.unaccent(
        'public.unaccent'::regdictionary,
        coalesce(nome, '') || ' ' || coalesce(sobrenome, '') || ' ' || coalesce(apelido, '')
    ))
$$
"""


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(FUNCAO_TEXTO_BUSCA)

    op.create_table('usuarios',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('nome', sa.String(length=150), nullable=False),
    sa.Column('email', postgresql.CITEXT(), nullable=False),
    sa.Column('telefone', sa.String(length=20), nullable=True),
    sa.Column('senha_hash', sa.String(length=255), nullable=False),
    sa.Column('perfil', sa.Enum('ADMIN', 'COLABORADOR', 'PADRAO', name='perfil_usuario'), server_default='PADRAO', nullable=False),
    sa.Column('status', sa.Enum('PENDENTE', 'ATIVO', 'INATIVO', name='status_usuario'), server_default='PENDENTE', nullable=False),
    sa.Column('tentativas_falhas', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.Column('bloqueado_ate', sa.DateTime(timezone=True), nullable=True),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_usuarios')),
    sa.UniqueConstraint('email', name=op.f('uq_usuarios_email'))
    )
    op.create_index(op.f('ix_usuarios_status'), 'usuarios', ['status'], unique=False)
    op.create_table('logs_auditoria',
    sa.Column('id', sa.BigInteger(), sa.Identity(always=False), nullable=False),
    sa.Column('usuario_id', sa.UUID(), nullable=True),
    sa.Column('acao', sa.String(length=60), nullable=False),
    sa.Column('entidade', sa.String(length=60), nullable=True),
    sa.Column('entidade_id', sa.String(length=64), nullable=True),
    sa.Column('detalhes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('ip', postgresql.INET(), nullable=True),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], name=op.f('fk_logs_auditoria_usuario_id_usuarios')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_logs_auditoria'))
    )
    op.create_index('ix_logs_auditoria_criado_em', 'logs_auditoria', ['criado_em'], unique=False)
    op.create_index(op.f('ix_logs_auditoria_acao'), 'logs_auditoria', ['acao'], unique=False)
    op.create_index(op.f('ix_logs_auditoria_usuario_id'), 'logs_auditoria', ['usuario_id'], unique=False)
    op.create_table('pessoas',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('nome', sa.String(length=100), nullable=False),
    sa.Column('sobrenome', sa.String(length=150), nullable=False),
    sa.Column('apelido', sa.String(length=100), nullable=True),
    sa.Column('idade_aproximada', sa.SmallInteger(), nullable=True),
    sa.Column('email', sa.String(length=254), nullable=True),
    sa.Column('telefone', sa.String(length=20), nullable=True),
    sa.Column('nome_contato', sa.String(length=150), nullable=True),
    sa.Column('telefone_contato', sa.String(length=20), nullable=True),
    sa.Column('observacoes', sa.Text(), nullable=True),
    sa.Column('consentimento', sa.Boolean(), nullable=False),
    sa.Column('consentimento_em', sa.DateTime(timezone=True), nullable=True),
    sa.Column('foto_perfil_id', sa.UUID(), nullable=True),
    sa.Column('status', sa.Enum('ATIVA', 'INATIVA', name='status_pessoa'), server_default='ATIVA', nullable=False),
    sa.Column('motivo_inativacao', sa.Text(), nullable=True),
    sa.Column('inativada_em', sa.DateTime(timezone=True), nullable=True),
    sa.Column('inativada_por_id', sa.UUID(), nullable=True),
    sa.Column('cadastrada_por_id', sa.UUID(), nullable=False),
    sa.Column('ultima_vez_visto', sa.DateTime(timezone=True), nullable=True),
    sa.Column('ultima_latitude', sa.Numeric(precision=9, scale=6), nullable=True),
    sa.Column('ultima_longitude', sa.Numeric(precision=9, scale=6), nullable=True),
    sa.Column('ultimo_endereco', sa.Text(), nullable=True),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('idade_aproximada IS NULL OR idade_aproximada BETWEEN 0 AND 130', name=op.f('ck_pessoas_idade_valida')),
    sa.CheckConstraint('ultima_latitude IS NULL OR ultima_latitude BETWEEN -90 AND 90', name=op.f('ck_pessoas_ultima_latitude_valida')),
    sa.CheckConstraint('ultima_longitude IS NULL OR ultima_longitude BETWEEN -180 AND 180', name=op.f('ck_pessoas_ultima_longitude_valida')),
    sa.ForeignKeyConstraint(['cadastrada_por_id'], ['usuarios.id'], name=op.f('fk_pessoas_cadastrada_por_id_usuarios')),
    sa.ForeignKeyConstraint(['inativada_por_id'], ['usuarios.id'], name=op.f('fk_pessoas_inativada_por_id_usuarios')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_pessoas'))
    )
    op.create_index(op.f('ix_pessoas_status'), 'pessoas', ['status'], unique=False)
    op.create_index(op.f('ix_pessoas_ultima_vez_visto'), 'pessoas', ['ultima_vez_visto'], unique=False)
    op.execute(
        "CREATE INDEX ix_pessoas_busca_trgm ON pessoas "
        "USING gin (texto_busca_pessoa(nome, sobrenome, apelido) gin_trgm_ops)"
    )
    op.create_table('tokens_redefinicao_senha',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('usuario_id', sa.UUID(), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('expira_em', sa.DateTime(timezone=True), nullable=False),
    sa.Column('usado_em', sa.DateTime(timezone=True), nullable=True),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], name=op.f('fk_tokens_redefinicao_senha_usuario_id_usuarios'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_tokens_redefinicao_senha')),
    sa.UniqueConstraint('token_hash', name=op.f('uq_tokens_redefinicao_senha_token_hash'))
    )
    op.create_index(op.f('ix_tokens_redefinicao_senha_usuario_id'), 'tokens_redefinicao_senha', ['usuario_id'], unique=False)
    op.create_table('avistamentos',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('pessoa_id', sa.UUID(), nullable=False),
    sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=False),
    sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=False),
    sa.Column('endereco', sa.Text(), nullable=True),
    sa.Column('visto_em', sa.DateTime(timezone=True), nullable=False),
    sa.Column('observacao', sa.Text(), nullable=True),
    sa.Column('registrado_por_id', sa.UUID(), nullable=False),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('latitude BETWEEN -90 AND 90', name=op.f('ck_avistamentos_latitude_valida')),
    sa.CheckConstraint('longitude BETWEEN -180 AND 180', name=op.f('ck_avistamentos_longitude_valida')),
    sa.ForeignKeyConstraint(['pessoa_id'], ['pessoas.id'], name=op.f('fk_avistamentos_pessoa_id_pessoas')),
    sa.ForeignKeyConstraint(['registrado_por_id'], ['usuarios.id'], name=op.f('fk_avistamentos_registrado_por_id_usuarios')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_avistamentos'))
    )
    op.create_index('ix_avistamentos_pessoa_id_visto_em', 'avistamentos', ['pessoa_id', sa.text('visto_em DESC')], unique=False)
    op.create_index(op.f('ix_avistamentos_visto_em'), 'avistamentos', ['visto_em'], unique=False)
    op.create_table('fotos',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('pessoa_id', sa.UUID(), nullable=False),
    sa.Column('tipo', sa.Enum('PERFIL', 'ALBUM', name='tipo_foto'), nullable=False),
    sa.Column('caminho', sa.String(length=255), nullable=False),
    sa.Column('caminho_miniatura', sa.String(length=255), nullable=False),
    sa.Column('mime', sa.String(length=50), nullable=False),
    sa.Column('tamanho_bytes', sa.Integer(), nullable=False),
    sa.Column('legenda', sa.String(length=255), nullable=True),
    sa.Column('enviada_por_id', sa.UUID(), nullable=False),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['enviada_por_id'], ['usuarios.id'], name=op.f('fk_fotos_enviada_por_id_usuarios')),
    sa.ForeignKeyConstraint(['pessoa_id'], ['pessoas.id'], name=op.f('fk_fotos_pessoa_id_pessoas')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_fotos'))
    )
    op.create_index(op.f('ix_fotos_pessoa_id'), 'fotos', ['pessoa_id'], unique=False)
    # fotos e pessoas se referenciam: esta FK só pode ser criada depois das duas tabelas.
    op.create_foreign_key(
        op.f('fk_pessoas_foto_perfil_id_fotos'), 'pessoas', 'fotos',
        ['foto_perfil_id'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint(op.f('fk_pessoas_foto_perfil_id_fotos'), 'pessoas', type_='foreignkey')
    op.drop_index(op.f('ix_fotos_pessoa_id'), table_name='fotos')
    op.drop_table('fotos')
    op.drop_index(op.f('ix_avistamentos_visto_em'), table_name='avistamentos')
    op.drop_index('ix_avistamentos_pessoa_id_visto_em', table_name='avistamentos')
    op.drop_table('avistamentos')
    op.drop_index(op.f('ix_tokens_redefinicao_senha_usuario_id'), table_name='tokens_redefinicao_senha')
    op.drop_table('tokens_redefinicao_senha')
    op.drop_index(op.f('ix_pessoas_ultima_vez_visto'), table_name='pessoas')
    op.drop_index(op.f('ix_pessoas_status'), table_name='pessoas')
    op.drop_index('ix_pessoas_busca_trgm', table_name='pessoas')
    op.drop_table('pessoas')
    op.drop_index(op.f('ix_logs_auditoria_usuario_id'), table_name='logs_auditoria')
    op.drop_index(op.f('ix_logs_auditoria_acao'), table_name='logs_auditoria')
    op.drop_index('ix_logs_auditoria_criado_em', table_name='logs_auditoria')
    op.drop_table('logs_auditoria')
    op.drop_index(op.f('ix_usuarios_status'), table_name='usuarios')
    op.drop_table('usuarios')
    for nome_enum in ('tipo_foto', 'status_pessoa', 'status_usuario', 'perfil_usuario'):
        op.execute(f'DROP TYPE IF EXISTS {nome_enum}')
    op.execute('DROP FUNCTION IF EXISTS texto_busca_pessoa(text, text, text)')
    # As extensões ficam: podem ser usadas por outros objetos do banco.
