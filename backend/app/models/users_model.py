from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func
from app.core.database import Base

from datetime import datetime

class User(Base):
    """用户表"""
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column()
    hash_password: Mapped[str] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
        )


