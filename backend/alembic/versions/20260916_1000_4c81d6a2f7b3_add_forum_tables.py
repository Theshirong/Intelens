"""add forum tables

Revision ID: 4c81d6a2f7b3
Revises: 7f4c2e91a8d3
Create Date: 2026-09-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c81d6a2f7b3'
down_revision: Union[str, Sequence[str], None] = '7f4c2e91a8d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'forum_posts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='主键ID'),
        sa.Column('title', sa.String(), nullable=False, comment='标题'),
        sa.Column('content', sa.Text(), nullable=False, comment='正文 (markdown)'),
        sa.Column('author_id', sa.Integer(), nullable=False, comment='作者外键'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
            comment='发布时间',
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
            comment='最后编辑时间',
        ),
        sa.ForeignKeyConstraint(['author_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_forum_posts_author_id'), 'forum_posts', ['author_id'], unique=False
    )
    op.create_index(
        op.f('ix_forum_posts_created_at'), 'forum_posts', ['created_at'], unique=False
    )

    op.create_table(
        'forum_comments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='主键ID'),
        sa.Column('post_id', sa.Integer(), nullable=False, comment='帖子外键'),
        sa.Column('author_id', sa.Integer(), nullable=False, comment='作者外键'),
        sa.Column('content', sa.Text(), nullable=False, comment='评论内容'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
            comment='评论时间',
        ),
        sa.ForeignKeyConstraint(['author_id'], ['users.id']),
        sa.ForeignKeyConstraint(['post_id'], ['forum_posts.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_forum_comments_post_id'), 'forum_comments', ['post_id'], unique=False
    )
    op.create_index(
        op.f('ix_forum_comments_author_id'),
        'forum_comments',
        ['author_id'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_forum_comments_author_id'), table_name='forum_comments')
    op.drop_index(op.f('ix_forum_comments_post_id'), table_name='forum_comments')
    op.drop_table('forum_comments')
    op.drop_index(op.f('ix_forum_posts_created_at'), table_name='forum_posts')
    op.drop_index(op.f('ix_forum_posts_author_id'), table_name='forum_posts')
    op.drop_table('forum_posts')
