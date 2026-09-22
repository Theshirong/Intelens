from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ModelModel(Base):
    """大模型信息表

    数据源: OpenRouter 的公开模型目录, 只收录各厂热门型号。表的字段就是
    OpenRouter 模型对象的字段, 嵌套结构 (architecture / pricing / top_provider /
    benchmarks 等) 原样存 JSON, 不做派生落库 —— 这样上游加字段不用改表。

    价格是 **美元/token** 的字符串, 与 OpenRouter 一致; 界面上要的
    「美元/百万 tokens、空闲/高峰」由 app/core/pricing.py 在响应时算出,
    只有 price_history 快照落库。
    """

    __tablename__ = "models"

    id: Mapped[int] = mapped_column(
        primary_key=True, autoincrement=True, comment="主键ID"
    )
    # OpenRouter id 的作者段之后部分, 如 "deepseek-v4.1-flash"; 也是本表的唯一键
    api_name: Mapped[str] = mapped_column(unique=True, comment="API 模型名")
    company: Mapped[str] = mapped_column(comment="所属公司")
    source_id: Mapped[int] = mapped_column(
        ForeignKey("sources.id"), index=True, comment="信息来源外键"
    )
    # 本轮采集是否收录; 掉出收录范围的型号置 False, 列表接口不再返回
    is_active: Mapped[bool] = mapped_column(default=True, comment="是否在售/主推")

    # ---- OpenRouter 模型对象 (原样) ----
    canonical_slug: Mapped[str | None] = mapped_column(comment="规范化模型 Slug")
    name: Mapped[str | None] = mapped_column(comment="模型名称")
    created: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="创建时间"
    )
    context_length: Mapped[int | None] = mapped_column(
        Integer, comment="上下文长度(tokens)"
    )
    architecture: Mapped[dict | None] = mapped_column(JSON, comment="模型架构(原样)")
    pricing: Mapped[dict | None] = mapped_column(JSON, comment="定价(原样, 美元/token)")
    top_provider: Mapped[dict | None] = mapped_column(
        JSON, comment="主要服务商(原样)"
    )
    per_request_limits: Mapped[dict | None] = mapped_column(
        JSON, comment="单请求限制(原样)"
    )
    supported_parameters: Mapped[list | None] = mapped_column(
        JSON, comment="支持的 API 参数(原样)"
    )
    default_parameters: Mapped[dict | None] = mapped_column(
        JSON, comment="默认参数(原样)"
    )
    supported_voices: Mapped[list | None] = mapped_column(
        JSON, comment="支持的语音(原样)"
    )
    knowledge_cutoff: Mapped[date | None] = mapped_column(Date, comment="知识截止日期")
    expiration_date: Mapped[date | None] = mapped_column(Date, comment="过期日期")
    benchmarks: Mapped[dict | None] = mapped_column(JSON, comment="基准测试(原样)")

    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        comment="最近采集时间",
    )
