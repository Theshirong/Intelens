"""add model_ranking table

Revision ID: 6fb966bf01f7
Revises: 4c81d6a2f7b3
Create Date: 2026-09-20 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6fb966bf01f7'
down_revision: Union[str, Sequence[str], None] = '4c81d6a2f7b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'model_rankings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='主键ID'),
        sa.Column('model_id', sa.Integer(), nullable=False, comment='模型外键'),
        sa.Column('source', sa.String(), nullable=False, comment='榜单来源, 目前只有 lmarena'),
        sa.Column('category', sa.String(), nullable=False, comment='榜单分类'),
        sa.Column('arena_name', sa.String(), nullable=False, comment='榜单里的原始模型名'),
        sa.Column('rating', sa.Float(), nullable=False, comment='Arena 评分'),
        sa.Column('rating_lower', sa.Float(), nullable=True, comment='评分下界'),
        sa.Column('rating_upper', sa.Float(), nullable=True, comment='评分上界'),
        sa.Column('vote_count', sa.Integer(), nullable=True, comment='投票数'),
        sa.Column('rank', sa.Integer(), nullable=True, comment='榜单排名'),
        sa.Column('published_on', sa.Date(), nullable=False, comment='榜单发布日期'),
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
            'model_id', 'source', 'category', 'published_on', name='uq_model_rankings_row'
        ),
    )
    op.create_index(
        op.f('ix_model_rankings_model_id'), 'model_rankings', ['model_id'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_model_rankings_model_id'), table_name='model_rankings')
    op.drop_table('model_rankings')
