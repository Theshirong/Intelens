from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import model_service
from app.schemas.model_schema import (
    ModelDetail,
    ModelListItem,
    PopularityItem,
    PriceHistoryItem,
)
from app.core.database import get_db

# 模型数据是公开内容, 不要求登录
router = APIRouter(
    prefix="/models",
    tags=["models"],
)


@router.get("", summary="查询全部模型列表", response_model=list[ModelListItem])
async def get_models(
    q: str | None = Query(
        default=None, max_length=50, description="厂商/模型名关键词"
    ),
    db: AsyncSession = Depends(get_db),
):
    return await model_service.read_model_list(db, q)


@router.get(
    "/popularity-history",
    summary="查询模型热度名次快照 (OpenRouter 周榜)",
    response_model=list[PopularityItem],
)
async def get_model_popularity_history(
    days: int = Query(default=30, ge=1, le=180, description="往回看的自然日数"),
    db: AsyncSession = Depends(get_db),
):
    # 必须排在 /{model_id} 之前, 否则 "popularity-history" 会被当成 model_id 解析
    return await model_service.read_popularity_history(db, days)


@router.get("/{model_id}", summary="查询模型详情", response_model=ModelDetail)
async def get_model_detail(
    model_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await model_service.read_model(db, model_id)


@router.get(
    "/{model_id}/price-history",
    summary="查询模型的历史价格快照",
    response_model=list[PriceHistoryItem],
)
async def get_model_price_history(
    model_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await model_service.read_price_history(db, model_id)
