"""采集任务: 并发抓取新闻与模型信息, 串行入库

新闻来自各厂官网, 模型信息统一来自 OpenRouter (各厂官网「模型 & 价格」页的
采集已作废, 见 app/crawlers/openrouter_models.py)。模型的能力指标直接用
OpenRouter 目录里的 benchmarks.artificial_analysis, 不再依赖外部榜单。

手动运行: python -m app.tasks.crawl
定时运行: 由 main.py 的 lifespan 启动 APScheduler 周期调用 run_crawl
"""

import asyncio
from typing import Literal, TypedDict

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.core.logging import setup_logging
from app.crawlers.base import BaseCrawler, CrawlerError, RawNewsItem
from app.crawlers.deepseek import DeepSeekCrawler
from app.crawlers.kimi import KimiCrawler
from app.crawlers.mimo import MimoCrawler
from app.crawlers.openrouter_models import OpenRouterModelsCrawler
from app.crawlers.zhipu import ZhipuCrawler
from app.crud.model_crud import save_models
from app.crud.news_crud import get_active_sources, get_or_create_source, save_news
from app.crud.popularity_crud import save_popularity
from app.models.source_model import SourceModel

# 源名称 -> 新闻爬虫实现, 新增站点在此注册
CRAWLER_REGISTRY: dict[str, type[BaseCrawler]] = {
    "deepseek": DeepSeekCrawler,
    "kimi": KimiCrawler,
    "mimo": MimoCrawler,
    "zhipu": ZhipuCrawler,
}

# 模型信息的采集源
#
# 它不是「新闻源」, 但 models.source_id 需要一个 sources 记录, 所以建一条
# is_active=False 的: 既不参与新闻抓取, 又满足外键。
MODEL_SOURCE = {"name": "openrouter", "url": "https://openrouter.ai", "type": "web"}


class SourceConfig(TypedDict):
    """内置源配置项, 与 sources 表字段对齐"""

    name: str
    url: str
    type: Literal["rss", "web"]


# 内置新闻源, 首次运行时自动创建 (已存在则跳过)
BUILTIN_SOURCES: list[SourceConfig] = [
    {"name": "deepseek", "url": "https://api-docs.deepseek.com", "type": "web"},
    # 资讯站与开放平台不同域, 源地址存资讯站, 模型信息页用爬虫里的常量
    {"name": "kimi", "url": "https://www.kimi.com", "type": "web"},
    {"name": "mimo", "url": "https://mimo.mi.com", "type": "web"},
    {"name": "zhipu", "url": "https://docs.bigmodel.cn", "type": "web"},
]


async def _fetch_one(source: SourceModel) -> tuple[SourceModel, list[RawNewsItem] | None]:
    """抓单个源的新闻, 失败记日志后返回 None (不中断其他源)"""
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


async def _fetch_models() -> list[dict] | None:
    """抓各厂旗舰模型信息, 失败记日志后返回 None (不影响新闻采集)"""
    try:
        async with OpenRouterModelsCrawler() as crawler:
            return await crawler.fetch_models()
    except CrawlerError as e:
        logger.error(f"OpenRouter 模型信息抓取失败: {e}")
        return None


async def _fetch_popularity() -> list[dict] | None:
    """抓 OpenRouter 周榜的位次, 失败记日志后返回 None (不影响其他采集)

    只抓不存: 名次要落到 models.id 上, 得等本轮模型先入库 (新收录的型号否则
    匹配不到), 所以入库放在写库阶段、save_models 之后。
    """
    try:
        async with OpenRouterModelsCrawler() as crawler:
            return await crawler.fetch_popularity()
    except CrawlerError as e:
        logger.error(f"OpenRouter 热度榜抓取失败: {e}")
        return None


async def run_crawl() -> None:
    """采集所有启用的新闻源与模型信息并入库

    网络抓取和入库严格分开: 先把新闻、模型、榜单全部抓完, 再开写事务一次性落库。
    抓取期间夹着写事务会一直占着 SQLite 的写锁 (整轮几十秒), 同一台机器上别的
    进程想写就会撞 "database is locked" —— 采集自己也容易被卡住。

    网络抓取用 gather 并发 (新闻与模型同时抓); 入库共享同一个 AsyncSession,
    必须串行。
    """
    # 只读一轮: 拿到启用源
    async with AsyncSession(engine) as db:
        for source in BUILTIN_SOURCES:
            await get_or_create_source(db, **source)
        await db.commit()
        active_sources = await get_active_sources(db)

    # 抓取阶段: 不持有任何数据库连接
    news_task = asyncio.gather(*(_fetch_one(source) for source in active_sources))
    news_results, model_items, popularity_items = await asyncio.gather(
        news_task, _fetch_models(), _fetch_popularity()
    )

    # 写库阶段: 只有入库, 不再有网络请求
    async with AsyncSession(engine) as db:
        total_new = 0
        for source, items in news_results:
            if items is None:
                continue
            added = await save_news(db, source.id, items)
            total_new += added
            logger.info(f"源 {source.name}: 抓取 {len(items)} 条, 新增 {added} 条")

        if model_items is not None:
            model_source = await get_or_create_source(db, is_active=False, **MODEL_SOURCE)
            added, updated, retired = await save_models(
                db, model_source.id, model_items
            )
            logger.info(
                f"OpenRouter: 模型新增 {added} 条, 更新 {updated} 条, "
                f"下架 {retired} 条"
            )

        # 名次要落到本轮刚入库的模型上, 顺序不能反 (save_models 里已 flush,
        # 新模型此时拿得到 id)
        if popularity_items is not None:
            ranked = await save_popularity(db, popularity_items)
            logger.info(f"OpenRouter 热度榜: 名次写入 {ranked} 条")

        await db.commit()
        logger.info(f"本轮采集完成, 共新增 {total_new} 条新闻")


if __name__ == "__main__":
    setup_logging()
    asyncio.run(run_crawl())
