from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ModelPopularityModel(Base):
    """模型热度名次快照 (OpenRouter 周榜)

    OpenRouter 的公开接口只给排序、不给热度数值 (``sort=top-weekly`` 与
    ``most-popular`` 是同一个口径, 详见 app/crawlers/openrouter_models.py),
    所以这里存的是 **名次**: ``rank`` 是该型号在当周 token 量榜上的位次,
    数字越小越热。

    名次是相对量, 只能同期比; 跨期能看的是位次涨落 (爬榜 / 掉榜), 不换算成
    热度分 —— 那会是一个编出来的数。

    和 price_history 一样按天快照: 同一天重复采集只更新那一行, 不追加。
    掉出榜外 (或榜深不够) 的型号当天没有行, 时间轴上表现为断点。
    """

    __tablename__ = "model_popularity"
    __table_args__ = (
        UniqueConstraint(
            "model_id", "source", "captured_on", name="uq_model_popularity_model_day"
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True, autoincrement=True, comment="主键ID"
    )
    model_id: Mapped[int] = mapped_column(
        ForeignKey("models.id"), index=True, comment="模型外键"
    )
    source: Mapped[str] = mapped_column(comment="榜单来源, 目前只有 openrouter")
    rank: Mapped[int] = mapped_column(Integer, comment="周榜位次, 越小越热")
    captured_on: Mapped[date] = mapped_column(Date, comment="采集日期")

    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="入库时间"
    )
