"""rebuild models to raw openrouter fields, drop lmarena rankings

Revision ID: b8f31c0d7a24
Revises: 9d4b7c1e5a82
Create Date: 2026-09-22 21:00:00.000000

models 表按 OpenRouter 的模型对象重建: 嵌套结构 (architecture / pricing /
top_provider / benchmarks 等) 原样存 JSON, 派生列 (能力标签、思考模式、
空闲/高峰价、备注) 全部去掉; 价格只在 price_history 里留派生快照。
能力指标改用 OpenRouter 目录里的 benchmarks.artificial_analysis, LMArena 的
model_rankings 表随之删除。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8f31c0d7a24'
down_revision: Union[str, Sequence[str], None] = '9d4b7c1e5a82'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 被 OpenRouter 原样字段取代的旧列
DROPPED_MODEL_COLUMNS = (
    'version',
    'category',
    'base_url_openai',
    'base_url_anthropic',
    'context_tokens',
    'max_output_tokens',
    'thinking_mode',
    'concurrency_limit',
    'support_json_output',
    'support_tool_calls',
    'support_responses_api',
    'support_anthropic_api',
    'support_prefix_completion',
    'support_fim',
    'price_input_hit_idle',
    'price_input_hit_peak',
    'price_input_miss_idle',
    'price_input_miss_peak',
    'price_output_idle',
    'price_output_peak',
    'price_note',
    'capabilities',
    'description',
)


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('models', schema=None) as batch_op:
        batch_op.add_column(sa.Column('canonical_slug', sa.String(), nullable=True, comment='规范化模型 Slug'))
        batch_op.add_column(sa.Column('name', sa.String(), nullable=True, comment='模型名称'))
        batch_op.add_column(sa.Column('created', sa.DateTime(timezone=True), nullable=True, comment='创建时间'))
        batch_op.add_column(sa.Column('context_length', sa.Integer(), nullable=True, comment='上下文长度(tokens)'))
        batch_op.add_column(sa.Column('architecture', sa.JSON(), nullable=True, comment='模型架构(原样)'))
        batch_op.add_column(sa.Column('pricing', sa.JSON(), nullable=True, comment='定价(原样, 美元/token)'))
        batch_op.add_column(sa.Column('top_provider', sa.JSON(), nullable=True, comment='主要服务商(原样)'))
        batch_op.add_column(sa.Column('per_request_limits', sa.JSON(), nullable=True, comment='单请求限制(原样)'))
        batch_op.add_column(sa.Column('supported_parameters', sa.JSON(), nullable=True, comment='支持的 API 参数(原样)'))
        batch_op.add_column(sa.Column('default_parameters', sa.JSON(), nullable=True, comment='默认参数(原样)'))
        batch_op.add_column(sa.Column('supported_voices', sa.JSON(), nullable=True, comment='支持的语音(原样)'))
        batch_op.add_column(sa.Column('knowledge_cutoff', sa.Date(), nullable=True, comment='知识截止日期'))
        batch_op.add_column(sa.Column('expiration_date', sa.Date(), nullable=True, comment='过期日期'))
        batch_op.add_column(sa.Column('benchmarks', sa.JSON(), nullable=True, comment='基准测试(原样)'))
        for column in DROPPED_MODEL_COLUMNS:
            batch_op.drop_column(column)

    with op.batch_alter_table('price_history', schema=None) as batch_op:
        batch_op.drop_column('price_note')

    op.drop_table('model_rankings')


def downgrade() -> None:
    """Downgrade schema."""
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
        sa.Column('captured_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False, comment='入库时间'),
        sa.ForeignKeyConstraint(['model_id'], ['models.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('model_id', 'source', 'category', 'published_on', name='uq_model_rankings_row'),
    )
    with op.batch_alter_table('model_rankings', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_model_rankings_model_id'), ['model_id'], unique=False)

    with op.batch_alter_table('price_history', schema=None) as batch_op:
        batch_op.add_column(sa.Column('price_note', sa.String(), nullable=True, comment='非 token 计费单价'))

    with op.batch_alter_table('models', schema=None) as batch_op:
        batch_op.add_column(sa.Column('version', sa.String(), nullable=True, comment='模型版本'))
        batch_op.add_column(sa.Column('category', sa.String(), nullable=True, comment='官网模型分类'))
        batch_op.add_column(sa.Column('base_url_openai', sa.String(), nullable=True, comment='BASE URL (OpenAI 格式)'))
        batch_op.add_column(sa.Column('base_url_anthropic', sa.String(), nullable=True, comment='BASE URL (Anthropic 格式)'))
        batch_op.add_column(sa.Column('context_tokens', sa.Integer(), nullable=True, comment='上下文长度(tokens)'))
        batch_op.add_column(sa.Column('max_output_tokens', sa.Integer(), nullable=True, comment='最大输出长度(tokens)'))
        batch_op.add_column(sa.Column('thinking_mode', sa.String(), nullable=True, comment='思考模式说明'))
        batch_op.add_column(sa.Column('concurrency_limit', sa.Integer(), nullable=True, comment='并发限制'))
        batch_op.add_column(sa.Column('support_json_output', sa.Boolean(), nullable=True, comment='Json Output'))
        batch_op.add_column(sa.Column('support_tool_calls', sa.Boolean(), nullable=True, comment='Tool Calls'))
        batch_op.add_column(sa.Column('support_responses_api', sa.Boolean(), nullable=True, comment='Responses API'))
        batch_op.add_column(sa.Column('support_anthropic_api', sa.Boolean(), nullable=True, comment='Anthropic API'))
        batch_op.add_column(sa.Column('support_prefix_completion', sa.Boolean(), nullable=True, comment='对话前缀续写(Beta)'))
        batch_op.add_column(sa.Column('support_fim', sa.Boolean(), nullable=True, comment='FIM 补全(Beta)'))
        batch_op.add_column(sa.Column('price_input_hit_idle', sa.Float(), nullable=True, comment='输入-缓存命中价(美元/百万tokens)'))
        batch_op.add_column(sa.Column('price_input_hit_peak', sa.Float(), nullable=True, comment='输入-缓存命中-高峰价(美元/百万tokens)'))
        batch_op.add_column(sa.Column('price_input_miss_idle', sa.Float(), nullable=True, comment='输入-缓存未命中价(美元/百万tokens)'))
        batch_op.add_column(sa.Column('price_input_miss_peak', sa.Float(), nullable=True, comment='输入-缓存未命中-高峰价(美元/百万tokens)'))
        batch_op.add_column(sa.Column('price_output_idle', sa.Float(), nullable=True, comment='输出价(美元/百万tokens)'))
        batch_op.add_column(sa.Column('price_output_peak', sa.Float(), nullable=True, comment='输出-高峰价(美元/百万tokens)'))
        batch_op.add_column(sa.Column('price_note', sa.String(), nullable=True, comment='非 token 计费单价'))
        batch_op.add_column(sa.Column('capabilities', sa.String(), nullable=True, comment='能力标签原文'))
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True, comment='备注说明'))
        for column in (
            'canonical_slug',
            'name',
            'created',
            'context_length',
            'architecture',
            'pricing',
            'top_provider',
            'per_request_limits',
            'supported_parameters',
            'default_parameters',
            'supported_voices',
            'knowledge_cutoff',
            'expiration_date',
            'benchmarks',
        ):
            batch_op.drop_column(column)
