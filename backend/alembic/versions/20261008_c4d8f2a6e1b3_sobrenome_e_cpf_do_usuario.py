"""sobrenome e CPF do usuário

Revision ID: c4d8f2a6e1b3
Revises: b7c3e9a1d2f4
Create Date: 2026-10-08 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c4d8f2a6e1b3'
down_revision: Union[str, None] = 'b7c3e9a1d2f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nulos no banco: contas antigas e as criadas por script não têm. O cadastro exige os dois.
    op.add_column('usuarios', sa.Column('sobrenome', sa.String(length=150), nullable=True))
    # Só os 11 dígitos; a interface formata.
    op.add_column('usuarios', sa.Column('cpf', sa.String(length=11), nullable=True))
    op.create_unique_constraint(op.f('uq_usuarios_cpf'), 'usuarios', ['cpf'])


def downgrade() -> None:
    op.drop_constraint(op.f('uq_usuarios_cpf'), 'usuarios', type_='unique')
    op.drop_column('usuarios', 'cpf')
    op.drop_column('usuarios', 'sobrenome')
