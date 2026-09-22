from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ModelListItem(BaseModel):
    """模型 (OpenRouter 模型对象原样字段 + 响应时派生的价格)

    嵌套结构 (architecture / pricing / top_provider / benchmarks 等) 原样透传,
    字段含义见 OpenRouter 的 /api/v1/models 文档。价格原样是「美元/token」字符串,
    下面的 price_* 是后端按「美元/百万 tokens、空闲/高峰」派生出来的展示值。
    """

    id: int
    api_name: str = Field(description="API 模型名 (OpenRouter id 去掉作者段)")
    company: str
    canonical_slug: str | None = Field(default=None, description="规范化模型 Slug")
    name: str | None = Field(default=None, description="模型名称")
    created: datetime | None = Field(default=None, description="创建时间")
    context_length: int | None = Field(default=None, description="上下文长度(tokens)")
    architecture: dict[str, Any] | None = Field(default=None, description="模型架构")
    pricing: dict[str, Any] | None = Field(
        default=None, description="定价(原样, 美元/token)"
    )
    top_provider: dict[str, Any] | None = Field(
        default=None, description="主要服务商"
    )
    per_request_limits: dict[str, Any] | None = Field(
        default=None, description="单请求限制"
    )
    supported_parameters: list[str] | None = Field(
        default=None, description="支持的 API 参数"
    )
    default_parameters: dict[str, Any] | None = Field(
        default=None, description="默认参数"
    )
    supported_voices: list[str] | None = Field(default=None, description="支持的语音")
    knowledge_cutoff: date | None = Field(default=None, description="知识截止日期")
    expiration_date: date | None = Field(default=None, description="过期日期")
    benchmarks: dict[str, Any] | None = Field(default=None, description="基准测试")

    # ---- 响应时派生 (不落库) ----
    price_input_hit_idle: float | None = Field(
        default=None, description="输入-缓存命中-空闲价(美元/百万tokens)"
    )
    price_input_hit_peak: float | None = Field(
        default=None, description="输入-缓存命中-高峰价(美元/百万tokens)"
    )
    price_input_miss_idle: float | None = Field(
        default=None, description="输入-缓存未命中-空闲价(美元/百万tokens)"
    )
    price_input_miss_peak: float | None = Field(
        default=None, description="输入-缓存未命中-高峰价(美元/百万tokens)"
    )
    price_output_idle: float | None = Field(
        default=None, description="输出-空闲价(美元/百万tokens)"
    )
    price_output_peak: float | None = Field(
        default=None, description="输出-高峰价(美元/百万tokens)"
    )
    price_notes: list[str] = Field(
        default_factory=list, description="计价规则说明 (峰谷时段、长上下文加价)"
    )

    fetched_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ModelDetail(ModelListItem):
    """模型详情 (当前与列表项同字段, 保留独立 schema 便于以后收窄列表)"""


class PriceHistoryItem(BaseModel):
    """价格快照 (价格时间轴的单个数据点)"""

    captured_on: date
    price_input_hit_idle: float | None = None
    price_input_miss_idle: float | None = None
    price_output_idle: float | None = None

    model_config = ConfigDict(from_attributes=True)


class PopularityItem(BaseModel):
    """热度名次快照 (OpenRouter 周榜)

    OpenRouter 只给排序不给热度数值, 所以这里只有位次: rank 越小越热。
    名次是相对量, 只在同期内可比。
    """

    model_id: int
    source: str
    rank: int
    captured_on: date

    model_config = ConfigDict(from_attributes=True)
