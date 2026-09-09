from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from typing import Annotated

from app.services import news_service
from app.schemas.common import Page
from app.schemas.news_schema import NewsDetail, NewsListItem, NewsQueryParams
from app.core.database import get_db
from app.api.deps import get_current_user

router = APIRouter(
    prefix="/news",
    tags=["news"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", summary="分页查询新闻列表", response_model=Page[NewsListItem])
async def get_news(
    params: Annotated[NewsQueryParams, Query()],
    db: AsyncSession = Depends(get_db),
):
    news_list, total = await news_service.read_news_list(
        db,
        page=params.page,
        page_size=params.page_size,
        source_id=params.source_id,
    )
    return Page.create(items=news_list, total=total, params=params)


@router.get("/{news_id}", summary="查询新闻详情", response_model=NewsDetail)
async def get_news_detail(
    news_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await news_service.read_news(db, news_id)
