from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PriceHistoryModel(Base):
    """模型价格快照 (美元/百万 tokens, 由 models.pricing 派生)

    每个模型每天最多一行: 采集任务当天重复运行只更新当天那一行, 不追加,
    否则开发期频繁重启会往同一天塞出好几行, 时间轴就没法看了。

    OpenRouter 的时段价在 pricing.overrides 里, 方向不固定 (DeepSeek 工作日高峰
    翻倍, 腾讯 hy3 深夜打折), 所以空闲取各项最低、高峰取最高, 取法见
    app/core/pricing.py; 站点没有分时定价时高峰三列为空。
    """

    __tablename__ = "price_history"
    __table_args__ = (
        UniqueConstraint("model_id", "captured_on", name="uq_price_history_model_day"),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True, autoincrement=True, comment="主键ID"
    )
    model_id: Mapped[int] = mapped_column(
        ForeignKey("models.id"), index=True, comment="模型外键"
    )
    captured_on: Mapped[date] = mapped_column(Date, comment="采集日期")

    price_input_hit_idle: Mapped[float | None] = mapped_column(
        Float, comment="输入-缓存命中-空闲价"
    )
    price_input_hit_peak: Mapped[float | None] = mapped_column(
        Float, comment="输入-缓存命中-高峰价"
    )
    price_input_miss_idle: Mapped[float | None] = mapped_column(
        Float, comment="输入-缓存未命中-空闲价"
    )
    price_input_miss_peak: Mapped[float | None] = mapped_column(
        Float, comment="输入-缓存未命中-高峰价"
    )
    price_output_idle: Mapped[float | None] = mapped_column(
        Float, comment="输出-空闲价"
    )
    price_output_peak: Mapped[float | None] = mapped_column(
        Float, comment="输出-高峰价"
    )

    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="入库时间"
    )
