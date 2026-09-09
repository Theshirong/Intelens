from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.crawlers.base import RawNewsItem
from app.models.news_model import NewsModel
from app.models.source_model import SourceModel


async def get_or_create_source(
    db: AsyncSession,
    name: str,
    url: str,
    type: Literal["rss", "web"] = "web",
) -> SourceModel:
    """
    按名称查找新闻源, 不存在则创建;
    采集任务启动时兜底调用, 保证源记录存在
    """
    source = await db.scalar(select(SourceModel).where(SourceModel.name == name))
    if source is None:
        source = SourceModel(name=name, url=url, type=type)
        db.add(source)
        await db.flush()
    return source


async def get_active_sources(db: AsyncSession) -> list[SourceModel]:
    """查询所有启用的新闻源"""
    result = await db.execute(select(SourceModel).where(SourceModel.is_active))
    return list(result.scalars().all())


async def save_news(
    db: AsyncSession, source_id: int, items: list[RawNewsItem]
) -> int:
    """
    批量入库, 按 url 去重 (url 已存在则跳过, 新闻基本不可变);
    return: 新增条数
    """
    if not items:
        return 0

    result = await db.execute(
        select(NewsModel.url).where(NewsModel.url.in_([item.url for item in items]))
    )
    existing_urls = set(result.scalars().all())

    new_items = [item for item in items if item.url not in existing_urls]
    if new_items:
        db.add_all(
            NewsModel(
                source_id=source_id,
                title=item.title,
                url=item.url,
                content=item.content,
                published_at=item.published_at,
            )
            for item in new_items
        )
        await db.flush()
    return len(new_items)


async def get_news_list(
    db: AsyncSession,
    page: int,
    page_size: int,
    source_id: int | None = None,
) -> tuple[list[NewsModel], int]:
    """
    分页查询新闻, 按发布时间倒序;
    source_id 不为 None 时按源过滤;
    return: (新闻列表, 总数)
    """
    query = select(NewsModel)
    if source_id is not None:
        query = query.where(NewsModel.source_id == source_id)

    # count 复用同一组 where 条件
    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar_one()

    result = await db.execute(
        query.options(selectinload(NewsModel.source))
        .order_by(NewsModel.published_at.desc().nulls_last(), NewsModel.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all()), total


async def get_news(db: AsyncSession, news_id: int) -> NewsModel | None:
    """按 id 查询单篇新闻 (带源)"""
    result = await db.execute(
        select(NewsModel)
        .options(selectinload(NewsModel.source))
        .where(NewsModel.id == news_id)
    )
    return result.scalar_one_or_none()
