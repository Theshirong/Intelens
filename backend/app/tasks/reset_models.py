"""一次性维护脚本: 清空模型信息 (models + price_history + model_popularity)

模型字段是按 OpenRouter 的模型对象重建的 (嵌套结构原样存 JSON), 旧行里的
价格与能力指标口径都变了, 逐列迁移没有意义, 所以换结构时整批清掉重新采集。

新闻、sources 与用户数据都不动。清空后跑一轮采集即可回填:

    python -m app.tasks.reset_models
    python -m app.tasks.crawl
"""

import asyncio

from loguru import logger
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.models.model_model import ModelModel
from app.models.popularity_model import ModelPopularityModel
from app.models.price_history_model import PriceHistoryModel


async def reset_models() -> None:
    """清空模型信息、价格快照与热度名次 (后两张表有外键, 先删)"""
    async with AsyncSession(engine) as db:
        models = await db.scalar(select(func.count()).select_from(ModelModel))
        history = await db.scalar(select(func.count()).select_from(PriceHistoryModel))
        popularity = await db.scalar(
            select(func.count()).select_from(ModelPopularityModel)
        )
        await db.execute(delete(ModelPopularityModel))
        await db.execute(delete(PriceHistoryModel))
        await db.execute(delete(ModelModel))
        await db.commit()
        logger.info(
            f"已清空模型信息: models {models} 条, price_history {history} 条, "
            f"model_popularity {popularity} 条"
        )


if __name__ == "__main__":
    asyncio.run(reset_models())
