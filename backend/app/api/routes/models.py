from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import model_service
from app.schemas.model_schema import ModelDetail, ModelListItem
from app.core.database import get_db
from app.api.deps import get_current_user

router = APIRouter(
    prefix="/models",
    tags=["models"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", summary="查询全部模型列表", response_model=list[ModelListItem])
async def get_models(db: AsyncSession = Depends(get_db)):
    return await model_service.read_model_list(db)


@router.get("/{model_id}", summary="查询模型详情", response_model=ModelDetail)
async def get_model_detail(
    model_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await model_service.read_model(db, model_id)
