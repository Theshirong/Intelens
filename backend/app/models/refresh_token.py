from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import DateTime, func, ForeignKey
from app.core.database import Base
from app.models.users_model import User

from datetime import datetime


class RefreshToken(Base):
    """refresh token 表"""

    __tablename__ = "refresh_token"

    id: Mapped[int] = mapped_column(primary_key=True)
    # 关联用户表
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # token唯一身份证, 用于查找与吊销
    jti: Mapped[str] = mapped_column(unique=True, index=True)
    # 过期时间
    expire_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # 吊销时间, 当 revoked_at 不为 None 的时候就判断 token 无效
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="refresh_token")
