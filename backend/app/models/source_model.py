from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import DateTime, func
from typing import TYPE_CHECKING, Literal, Annotated

if TYPE_CHECKING:
    from app.models.news_model import NewsModel

from datetime import datetime

from app.core.database import Base


class SourceModel(Base):
    """新闻源表"""

    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(primary_key=True, comment="主键ID")
    name: Mapped[str] = mapped_column(unique=True, comment="源名称")
    url: Mapped[str] = mapped_column(comment="RSS/Web")
    type: Mapped[Literal["rss", "web"]] = mapped_column(comment="采集方式")

    is_active: Mapped[bool] = mapped_column(default=True, comment="是否启用")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="创建时间"
    )

    news: Mapped[list["NewsModel"]] = relationship(back_populates="source")
