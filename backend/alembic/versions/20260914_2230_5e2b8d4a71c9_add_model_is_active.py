"""add model is_active

Revision ID: 5e2b8d4a71c9
Revises: 9c1a7f0b4e21
Create Date: 2026-09-14 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5e2b8d4a71c9'
down_revision: Union[str, Sequence[str], None] = '9c1a7f0b4e21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 已有数据默认在售, 由下一轮采集按官网现状改写
    op.add_column(
        'models',
        sa.Column(
            'is_active',
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
            comment='是否在售/主推',
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('models', 'is_active')
