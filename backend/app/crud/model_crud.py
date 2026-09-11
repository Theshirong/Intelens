from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_model import ModelModel


async def save_models(
    db: AsyncSession, source_id: int, items: list[dict]
) -> tuple[int, int]:
    """批量入库模型信息, 按 api_name upsert

    与新闻不同, 模型参数/价格会随官方页面更新, 属于「可变数据」:
    已存在则覆盖非主键字段, 不存在则插入。
    return: (新增条数, 更新条数)
    """
    if not items:
        return 0, 0

    result = await db.execute(
        select(ModelModel).where(
            ModelModel.api_name.in_([item["api_name"] for item in items])
        )
    )
    existing = {m.api_name: m for m in result.scalars().all()}

    added = updated = 0
    for item in items:
        model = existing.get(item["api_name"])
        if model is None:
            db.add(ModelModel(source_id=source_id, **item))
            added += 1
        else:
            # 官网为权威数据源, 直接覆盖; fetched_at 由 server_default 维护
            for field, value in item.items():
                setattr(model, field, value)
            model.source_id = source_id
            updated += 1

    await db.flush()
    return added, updated


async def get_model_list(db: AsyncSession) -> list[ModelModel]:
    """查询全部模型, 按公司、api_name 排序"""
    result = await db.execute(
        select(ModelModel).order_by(ModelModel.company, ModelModel.api_name)
    )
    return list(result.scalars().all())


async def get_model(db: AsyncSession, model_id: int) -> ModelModel | None:
    """按 id 查询单个模型"""
    return await db.scalar(select(ModelModel).where(ModelModel.id == model_id))
