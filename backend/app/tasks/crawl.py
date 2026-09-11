"""采集任务: 并发抓取所有启用源, 串行入库

手动运行: python -m app.tasks.crawl
定时运行: 由 main.py 的 lifespan 启动 APScheduler 周期调用 run_crawl
"""

import asyncio
from typing import Literal, TypedDict

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.crawlers.base import BaseCrawler, CrawlerError, ModelsCrawlerBase, RawNewsItem
from app.crawlers.deepseek import DeepSeekCrawler
from app.crawlers.ds_models import DsModelsCrawler
from app.crud.model_crud import save_models
from app.crud.news_crud import get_active_sources, get_or_create_source, save_news
from app.models.source_model import SourceModel

# 源名称 -> 新闻爬虫实现, 新增站点在此注册
CRAWLER_REGISTRY: dict[str, type[BaseCrawler]] = {
    "deepseek": DeepSeekCrawler,
}

# 源名称 -> 模型信息爬虫实现 (官方「模型 & 价格」页)
MODEL_CRAWLER_REGISTRY: dict[str, type[ModelsCrawlerBase]] = {
    "deepseek": DsModelsCrawler,
}


class SourceConfig(TypedDict):
    """内置源配置项, 与 sources 表字段对齐"""

    name: str
    url: str
    type: Literal["rss", "web"]


# 内置新闻源, 首次运行时自动创建 (已存在则跳过)
BUILTIN_SOURCES: list[SourceConfig] = [
    {"name": "deepseek", "url": "https://api-docs.deepseek.com", "type": "web"},
]


async def _fetch_one(source: SourceModel) -> tuple[SourceModel, list[RawNewsItem] | None]:
    """抓单个源, 失败记日志后返回 None (不中断其他源)"""
    crawler_cls = CRAWLER_REGISTRY.get(source.name)
    if crawler_cls is None:
        logger.warning(f"源 {source.name} 没有对应的爬虫实现, 跳过")
        return source, None

    async with crawler_cls() as crawler:
        try:
            items = await crawler.fetch(source)
        except CrawlerError as e:
            logger.error(f"源 {source.name} 抓取失败: {e}")
            return source, None
    return source, items


async def _fetch_models_one(
    source: SourceModel,
) -> tuple[SourceModel, list[dict] | None]:
    """抓单个源的模型信息, 失败记日志后返回 None"""
    crawler_cls = MODEL_CRAWLER_REGISTRY.get(source.name)
    if crawler_cls is None:
        return source, None

    try:
        async with crawler_cls() as crawler:
            items = await crawler.fetch_models(source)
    except CrawlerError as e:
        logger.error(f"源 {source.name} 模型信息抓取失败: {e}")
        return source, None
    return source, items


async def run_crawl() -> None:
    """采集所有启用的新闻源与模型信息并入库

    网络抓取用 gather 并发; 入库共享同一个 AsyncSession, 必须串行。
    """
    async with AsyncSession(engine) as db:
        for source in BUILTIN_SOURCES:
            await get_or_create_source(db, **source)

        active_sources = await get_active_sources(db)

        news_task = asyncio.gather(
            *(_fetch_one(source) for source in active_sources)
        )
        models_task = asyncio.gather(
            *(_fetch_models_one(source) for source in active_sources)
        )
        # 新闻与模型信息同时并发抓取
        news_results, model_results = await asyncio.gather(news_task, models_task)

        total_new = 0
        for source, items in news_results:
            if items is None:
                continue
            added = await save_news(db, source.id, items)
            total_new += added
            logger.info(f"源 {source.name}: 抓取 {len(items)} 条, 新增 {added} 条")

        for source, items in model_results:
            if items is None:
                continue
            added, updated = await save_models(db, source.id, items)
            logger.info(
                f"源 {source.name}: 模型信息新增 {added} 条, 更新 {updated} 条"
            )

        await db.commit()
        logger.info(f"本轮采集完成, 共新增 {total_new} 条")


if __name__ == "__main__":
    asyncio.run(run_crawl())
