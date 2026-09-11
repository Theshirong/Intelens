from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.model_crud import get_model, get_model_list
from app.models.model_model import ModelModel


async def read_model_list(db: AsyncSession) -> list[ModelModel]:
    """查询全部模型, 按公司、api_name 排序"""
    return await get_model_list(db)


async def read_model(db: AsyncSession, model_id: int) -> ModelModel:
    """
    按 id 查询模型详情;
    不存在时抛 404
    """
    model = await get_model(db, model_id)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模型不存在")
    return model
