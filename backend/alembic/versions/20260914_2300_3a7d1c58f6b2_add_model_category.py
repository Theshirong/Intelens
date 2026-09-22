"""add model category

Revision ID: 3a7d1c58f6b2
Revises: 5e2b8d4a71c9
Create Date: 2026-09-14 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a7d1c58f6b2'
down_revision: Union[str, Sequence[str], None] = '5e2b8d4a71c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'models',
        sa.Column('category', sa.String(), nullable=True, comment='官网模型分类'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('models', 'category')
