from app.core.database import Base
from app.models.refresh_token import RefreshToken

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import DateTime, func

from datetime import datetime


class User(Base):
    """用户表"""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, comment="主键ID")
    username: Mapped[str] = mapped_column(unique=True, index=True, comment="用户名称")
    hashed_password: Mapped[str] = mapped_column(comment="哈希密码")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="创建时间"
    )

    refresh_token: Mapped[list["RefreshToken"]] = relationship(back_populates="user")
