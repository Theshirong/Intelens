from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.news_crud import get_news, get_news_list
from app.models.news_model import NewsModel


async def read_news_list(
    db: AsyncSession, page: int, page_size: int, source_id: int | None = None
) -> tuple[list[NewsModel], int]:
    """分页查询新闻列表"""
    return await get_news_list(db, page, page_size, source_id)


async def read_news(db: AsyncSession, news_id: int) -> NewsModel:
    """
    按 id 查询新闻详情;
    不存在时抛 404
    """
    news = await get_news(db, news_id)
    if news is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="新闻不存在")
    return news
