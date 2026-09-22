from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PageParams


class ForumQueryParams(PageParams):
    """论坛列表查询参数"""

    q: str | None = Field(default=None, max_length=50, description="标题/正文关键词")


class ForumPostCreate(BaseModel):
    """发帖"""

    title: Annotated[str, Field(min_length=1, max_length=120, description="标题")]
    content: Annotated[
        str, Field(min_length=1, max_length=20000, description="正文 markdown")
    ]


class ForumCommentCreate(BaseModel):
    """评论"""

    content: Annotated[str, Field(min_length=1, max_length=2000, description="评论内容")]


class ForumCommentItem(BaseModel):
    """评论项"""

    id: int
    post_id: int
    author_id: int
    author_name: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ForumPostListItem(BaseModel):
    """帖子列表项 (不含正文)"""

    id: int
    title: str
    excerpt: str = ""
    author_id: int
    author_name: str
    created_at: datetime
    updated_at: datetime
    # 由 service 统计后写入实例属性, 见 forum_service.read_post_list
    comment_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ForumPostDetail(ForumPostListItem):
    """帖子详情 (含正文与全部评论)"""

    content: str
    comments: list[ForumCommentItem] = []
