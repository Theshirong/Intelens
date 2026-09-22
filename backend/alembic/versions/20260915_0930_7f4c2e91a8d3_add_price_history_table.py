"""add price_history table

Revision ID: 7f4c2e91a8d3
Revises: 3a7d1c58f6b2
Create Date: 2026-09-15 09:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f4c2e91a8d3'
down_revision: Union[str, Sequence[str], None] = '3a7d1c58f6b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'price_history',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='主键ID'),
        sa.Column('model_id', sa.Integer(), nullable=False, comment='模型外键'),
        sa.Column('captured_on', sa.Date(), nullable=False, comment='采集日期'),
        sa.Column('price_input_hit_idle', sa.Float(), nullable=True, comment='输入-缓存命中-基准价'),
        sa.Column('price_input_hit_peak', sa.Float(), nullable=True, comment='输入-缓存命中-峰谷价'),
        sa.Column('price_input_miss_idle', sa.Float(), nullable=True, comment='输入-缓存未命中-基准价'),
        sa.Column('price_input_miss_peak', sa.Float(), nullable=True, comment='输入-缓存未命中-峰谷价'),
        sa.Column('price_output_idle', sa.Float(), nullable=True, comment='输出-基准价'),
        sa.Column('price_output_peak', sa.Float(), nullable=True, comment='输出-峰谷价'),
        sa.Column('price_note', sa.String(), nullable=True, comment='非 token 计费单价'),
        sa.Column(
            'captured_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
            comment='入库时间',
        ),
        sa.ForeignKeyConstraint(['model_id'], ['models.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('model_id', 'captured_on', name='uq_price_history_model_day'),
    )
    op.create_index(
        op.f('ix_price_history_model_id'), 'price_history', ['model_id'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_price_history_model_id'), table_name='price_history')
    op.drop_table('price_history')
