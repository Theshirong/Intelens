from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import DateTime, func, Text, ForeignKey
from typing import TYPE_CHECKING, Annotated

if TYPE_CHECKING:
    from app.models.source_model import SourceModel

from datetime import datetime

from app.core.database import Base


class NewsModel(Base):
    """新闻表"""

    __tablename__ = "news"

    id: Mapped[int] = mapped_column(
        primary_key=True, autoincrement=True, comment="主键ID"
    )
    title: Mapped[str] = mapped_column(comment="标题")
    url: Mapped[str] = mapped_column(unique=True, comment="原文链接")
    content: Mapped[str | None] = mapped_column(Text, comment="内容")
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True, comment="发布时间"
    )
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="入库时间"
    )
    source_id: Mapped[int] = mapped_column(
        ForeignKey("sources.id"), index=True, comment="外键"
    )

    source: Mapped["SourceModel"] = relationship(back_populates="news")

    @property
    def source_name(self) -> str:
        """源名称, 供响应序列化; 查询方需 selectinload(source)"""
        return self.source.name
