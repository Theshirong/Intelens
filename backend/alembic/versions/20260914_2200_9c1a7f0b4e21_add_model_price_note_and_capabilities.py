"""add model price_note and capabilities

Revision ID: 9c1a7f0b4e21
Revises: 41c153632a6e
Create Date: 2026-09-14 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c1a7f0b4e21'
down_revision: Union[str, Sequence[str], None] = '41c153632a6e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 非 token 计费的单价, 如 ASR 的「¥0.5 /小时」; 与 token 单价字段互斥
    op.add_column(
        'models',
        sa.Column('price_note', sa.String(), nullable=True, comment='非 token 计费单价'),
    )
    # 官网「能力支持」原文, 各项以 ' / ' 分隔
    op.add_column(
        'models',
        sa.Column('capabilities', sa.String(), nullable=True, comment='能力标签原文'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('models', 'capabilities')
    op.drop_column('models', 'price_note')
