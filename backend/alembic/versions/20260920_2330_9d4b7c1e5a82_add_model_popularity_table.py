"""add model_popularity table

Revision ID: 9d4b7c1e5a82
Revises: 6fb966bf01f7
Create Date: 2026-09-20 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d4b7c1e5a82'
down_revision: Union[str, Sequence[str], None] = '6fb966bf01f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'model_popularity',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='主键ID'),
        sa.Column('model_id', sa.Integer(), nullable=False, comment='模型外键'),
        sa.Column('source', sa.String(), nullable=False, comment='榜单来源, 目前只有 openrouter'),
        sa.Column('rank', sa.Integer(), nullable=False, comment='周榜位次, 越小越热'),
        sa.Column('captured_on', sa.Date(), nullable=False, comment='采集日期'),
        sa.Column(
            'captured_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
            comment='入库时间',
        ),
        sa.ForeignKeyConstraint(['model_id'], ['models.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'model_id', 'source', 'captured_on', name='uq_model_popularity_model_day'
        ),
    )
    op.create_index(
        op.f('ix_model_popularity_model_id'), 'model_popularity', ['model_id'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_model_popularity_model_id'), table_name='model_popularity')
    op.drop_table('model_popularity')
