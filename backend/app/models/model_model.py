from sqlalchemy import DateTime, Float, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from datetime import datetime

from app.core.database import Base


class ModelModel(Base):
    """大模型信息表

    数据源: 各公司官方「模型 & 价格」页, 以 DeepSeek 为首个基准源。
    公司维度暂用字符串存储, 后续如需公司级跟踪再拆关联表。
    """

    __tablename__ = "models"

    id: Mapped[int] = mapped_column(
        primary_key=True, autoincrement=True, comment="主键ID"
    )
    # API 调用所用的模型名, 如 deepseek-v4-flash, 官网表格第一行
    api_name: Mapped[str] = mapped_column(unique=True, comment="API 模型名")
    # 官网展示的版本号, 如 DeepSeek-V4-Flash-0731
    version: Mapped[str | None] = mapped_column(comment="模型版本")
    company: Mapped[str] = mapped_column(comment="所属公司")
    source_id: Mapped[int] = mapped_column(
        ForeignKey("sources.id"), index=True, comment="信息来源外键"
    )

    # ---- 官网「模型细节」字段 ----
    base_url_openai: Mapped[str | None] = mapped_column(comment="BASE URL (OpenAI 格式)")
    base_url_anthropic: Mapped[str | None] = mapped_column(
        comment="BASE URL (Anthropic 格式)"
    )
    # 上下文长度, 原始文本如 "1M" / "128K", 存 token 数
    context_tokens: Mapped[int | None] = mapped_column(Integer, comment="上下文长度(tokens)")
    # 输出长度, 原始文本如 "最大 384K"
    max_output_tokens: Mapped[int | None] = mapped_column(Integer, comment="最大输出长度(tokens)")
    # 思考模式说明原文
    thinking_mode: Mapped[str | None] = mapped_column(comment="思考模式说明")
    # 并发限制, 原始文本如 "2500"
    concurrency_limit: Mapped[int | None] = mapped_column(comment="并发限制")

    # ---- 功能支持, None = 未标注 ----
    support_json_output: Mapped[bool | None] = mapped_column(comment="Json Output")
    support_tool_calls: Mapped[bool | None] = mapped_column(comment="Tool Calls")
    support_responses_api: Mapped[bool | None] = mapped_column(comment="Responses API")
    support_anthropic_api: Mapped[bool | None] = mapped_column(comment="Anthropic API")
    support_prefix_completion: Mapped[bool | None] = mapped_column(comment="对话前缀续写(Beta)")
    support_fim: Mapped[bool | None] = mapped_column(comment="FIM 补全(Beta)")

    # ---- 定价 (元/百万tokens), 基准价 + 峰谷价 ----
    # 基准价各家通用; 峰谷价仅 DeepSeek 等采用峰谷定价的厂家填写, 其余为 NULL。
    # 缓存命中价仅提供缓存计费的厂家填写, 其余为 NULL。
    price_input_hit_idle: Mapped[float | None] = mapped_column(Float, comment="输入-缓存命中-基准价")
    price_input_hit_peak: Mapped[float | None] = mapped_column(Float, comment="输入-缓存命中-峰谷价")
    price_input_miss_idle: Mapped[float | None] = mapped_column(Float, comment="输入-缓存未命中-基准价")
    price_input_miss_peak: Mapped[float | None] = mapped_column(Float, comment="输入-缓存未命中-峰谷价")
    price_output_idle: Mapped[float | None] = mapped_column(Float, comment="输出-基准价")
    price_output_peak: Mapped[float | None] = mapped_column(Float, comment="输出-峰谷价")

    description: Mapped[str | None] = mapped_column(Text, comment="备注说明")
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="入库时间"
    )
