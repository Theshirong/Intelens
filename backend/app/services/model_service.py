from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pricing import price_fields, price_notes
from app.crud.model_crud import get_model, get_model_list, get_price_history
from app.crud.popularity_crud import get_popularity_history
from app.models.model_model import ModelModel
from app.models.popularity_model import ModelPopularityModel
from app.models.price_history_model import PriceHistoryModel
from app.schemas.model_schema import ModelListItem


def _to_list_item(model: ModelModel) -> ModelListItem:
    """模型行 -> 响应对象, 顺手派生出界面要的价格口径

    库里存的是 OpenRouter 原样的 pricing (美元/token), 界面要「美元/百万 tokens
    的空闲/高峰价」与时段说明, 所以在这里算, 不落库。
    """
    item = ModelListItem.model_validate(model)
    return item.model_copy(
        update={
            **price_fields(model.pricing),
            "price_notes": price_notes(model.pricing),
        }
    )


async def read_model_list(
    db: AsyncSession, q: str | None = None
) -> list[ModelListItem]:
    """查询全部模型, 按公司、api_name 排序; q 供全站搜索使用"""
    return [_to_list_item(model) for model in await get_model_list(db, q)]


async def read_model(db: AsyncSession, model_id: int) -> ModelListItem:
    """
    按 id 查询模型详情;
    不存在时抛 404
    """
    model = await get_model(db, model_id)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模型不存在")
    return _to_list_item(model)


async def read_price_history(
    db: AsyncSession, model_id: int
) -> list[PriceHistoryModel]:
    """查询模型的价格快照; 模型不存在时抛 404"""
    if await get_model(db, model_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模型不存在")
    return await get_price_history(db, model_id)


async def read_popularity_history(
    db: AsyncSession, days: int
) -> list[ModelPopularityModel]:
    """查询近 days 天的热度名次快照 (OpenRouter 周榜)"""
    return await get_popularity_history(db, days)
