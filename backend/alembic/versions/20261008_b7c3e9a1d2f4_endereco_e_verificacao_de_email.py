"""endereço do usuário e verificação de email

Revision ID: b7c3e9a1d2f4
Revises: fd4afbddd94e
Create Date: 2026-10-08 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b7c3e9a1d2f4'
down_revision: Union[str, None] = 'fd4afbddd94e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('usuarios', sa.Column('cep', sa.String(length=9), nullable=True))
    op.add_column('usuarios', sa.Column('logradouro', sa.String(length=200), nullable=True))
    op.add_column('usuarios', sa.Column('numero', sa.String(length=20), nullable=True))
    op.add_column('usuarios', sa.Column('complemento', sa.String(length=100), nullable=True))
    op.add_column('usuarios', sa.Column('bairro', sa.String(length=100), nullable=True))
    op.add_column('usuarios', sa.Column('cidade', sa.String(length=100), nullable=True))
    op.add_column('usuarios', sa.Column('uf', sa.String(length=2), nullable=True))
    op.add_column(
        'usuarios', sa.Column('email_verificado_em', sa.DateTime(timezone=True), nullable=True)
    )
    # Contas que já existiam continuam entrando normalmente.
    op.execute('UPDATE usuarios SET email_verificado_em = criado_em')

    op.create_table(
        'tokens_verificacao_email',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('usuario_id', sa.UUID(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expira_em', sa.DateTime(timezone=True), nullable=False),
        sa.Column('usado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ['usuario_id'],
            ['usuarios.id'],
            name=op.f('fk_tokens_verificacao_email_usuario_id_usuarios'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_tokens_verificacao_email')),
        sa.UniqueConstraint('token_hash', name=op.f('uq_tokens_verificacao_email_token_hash')),
    )
    op.create_index(
        op.f('ix_tokens_verificacao_email_usuario_id'),
        'tokens_verificacao_email',
        ['usuario_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_tokens_verificacao_email_usuario_id'), table_name='tokens_verificacao_email'
    )
    op.drop_table('tokens_verificacao_email')
    for coluna in (
        'email_verificado_em', 'uf', 'cidade', 'bairro', 'complemento', 'numero', 'logradouro',
        'cep',
    ):
        op.drop_column('usuarios', coluna)
