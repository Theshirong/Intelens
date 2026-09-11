from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ModelListItem(BaseModel):
    """模型列表项"""

    id: int
    api_name: str
    version: str | None = None
    company: str
    context_tokens: int | None = Field(default=None, description="上下文长度(tokens)")
    max_output_tokens: int | None = Field(default=None, description="最大输出长度(tokens)")
    price_input_miss_idle: float | None = Field(
        default=None, description="输入-缓存未命中-基准价(元/百万tokens)"
    )
    price_output_idle: float | None = Field(
        default=None, description="输出-基准价(元/百万tokens)"
    )
    fetched_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ModelDetail(ModelListItem):
    """模型详情 (全字段)"""

    base_url_openai: str | None = None
    base_url_anthropic: str | None = None
    thinking_mode: str | None = None
    concurrency_limit: int | None = None
    support_json_output: bool | None = None
    support_tool_calls: bool | None = None
    support_responses_api: bool | None = None
    support_anthropic_api: bool | None = None
    support_prefix_completion: bool | None = None
    support_fim: bool | None = None
    price_input_hit_idle: float | None = None
    price_input_hit_peak: float | None = None
    price_input_miss_peak: float | None = None
    price_output_peak: float | None = None
    description: str | None = None
