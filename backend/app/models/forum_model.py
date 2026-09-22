import re

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import DateTime, ForeignKey, Text, func
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.users_model import User

from datetime import datetime

from app.core.database import Base


class ForumPostModel(Base):
    """论坛帖子"""

    __tablename__ = "forum_posts"

    id: Mapped[int] = mapped_column(
        primary_key=True, autoincrement=True, comment="主键ID"
    )
    title: Mapped[str] = mapped_column(comment="标题")
    content: Mapped[str] = mapped_column(Text, comment="正文 (markdown)")
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, comment="作者外键"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
        comment="发布时间",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        comment="最后编辑时间",
    )

    author: Mapped["User"] = relationship()
    comments: Mapped[list["ForumCommentModel"]] = relationship(
        back_populates="post",
        cascade="all, delete-orphan",
        order_by="ForumCommentModel.id",
    )

    @property
    def author_name(self) -> str:
        """作者名称, 供响应序列化; 查询方需 selectinload(author)"""
        return self.author.username

    @property
    def excerpt(self) -> str:
        """列表摘要: 压掉 markdown 记号后截断, 避免列表页铺满正文"""
        text = re.sub(r"[#>*_`~!\[\]()|-]+", " ", self.content)
        text = re.sub(r"\s+", " ", text).strip()
        return f"{text[:120]}…" if len(text) > 120 else text


class ForumCommentModel(Base):
    """论坛评论"""

    __tablename__ = "forum_comments"

    id: Mapped[int] = mapped_column(
        primary_key=True, autoincrement=True, comment="主键ID"
    )
    post_id: Mapped[int] = mapped_column(
        ForeignKey("forum_posts.id"), index=True, comment="帖子外键"
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, comment="作者外键"
    )
    content: Mapped[str] = mapped_column(Text, comment="评论内容")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="评论时间"
    )

    post: Mapped["ForumPostModel"] = relationship(back_populates="comments")
    author: Mapped["User"] = relationship()

    @property
    def author_name(self) -> str:
        """作者名称, 供响应序列化; 查询方需 selectinload(author)"""
        return self.author.username
