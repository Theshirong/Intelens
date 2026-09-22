from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PageParams


class NewsQueryParams(PageParams):
    """新闻列表查询参数"""

    source_id: int | None = Field(default=None, description="按新闻源过滤")
    q: str | None = Field(default=None, max_length=50, description="标题关键词")


class NewsListItem(BaseModel):
    """新闻列表项 (不含正文)"""

    id: int
    title: str
    url: str
    published_at: datetime | None = None
    source_id: int
    source_name: str

    # 用于从 orm 获取数据
    model_config = ConfigDict(from_attributes=True)


class NewsDetail(NewsListItem):
    """新闻详情 (含正文 markdown)"""

    content: str | None = None
    fetched_at: datetime
