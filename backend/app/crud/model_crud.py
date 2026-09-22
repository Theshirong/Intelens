from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pricing import price_fields
from app.models.model_model import ModelModel
from app.models.price_history_model import PriceHistoryModel

# 价格快照的字段; 由 models.pricing (原样 JSON) 派生出空闲/高峰价
PRICE_FIELDS = (
    "price_input_hit_idle",
    "price_input_hit_peak",
    "price_input_miss_idle",
    "price_input_miss_peak",
    "price_output_idle",
    "price_output_peak",
)


async def _snapshot_prices(db: AsyncSession, models: list[ModelModel]) -> None:
    """把当前价格按天记一行快照, 当天已有则覆盖

    models 表是覆盖式 upsert, 只留当前值; 价格变动对比要靠这里的逐日快照。
    按天去重而不是按轮次: 采集任务在每次进程启动时也会跑一轮, 开发期频繁
    重载会往同一天塞出多行, 时间轴就没法看了。

    价格原文 (美元/token) 在 models.pricing 里, 这里存的是派生后的
    「美元/百万 tokens、空闲/高峰」, 取法见 app/core/pricing.py。
    """
    today = date.today()
    for model in models:
        row = await db.scalar(
            select(PriceHistoryModel).where(
                PriceHistoryModel.model_id == model.id,
                PriceHistoryModel.captured_on == today,
            )
        )
        derived = price_fields(model.pricing)
        values = {field: derived.get(field) for field in PRICE_FIELDS}
        if row is None:
            db.add(PriceHistoryModel(model_id=model.id, captured_on=today, **values))
        else:
            for field, value in values.items():
                setattr(row, field, value)


async def save_models(
    db: AsyncSession, source_id: int, items: list[dict]
) -> tuple[int, int, int]:
    """批量入库模型信息, 按 api_name upsert

    与新闻不同, 模型参数/价格会随官方数据更新, 属于「可变数据」:
    已存在则覆盖非主键字段, 不存在则插入。

    产品只要各家的旗舰, 换新旗舰后老型号就不再出现, 因此本轮没抓到的同源
    模型标记为下架 (is_active=False) 而不是删除 —— 抓取失败的某一轮不会把
    型号清空, 下一轮正常抓取就能重新置回在售。

    每轮还会为涉及的模型写一条当天的价格快照, 供价格时间轴使用。

    return: (新增条数, 更新条数, 本次下线条数)
    """
    if not items:
        return 0, 0, 0

    api_names = [item["api_name"] for item in items]
    result = await db.execute(
        select(ModelModel).where(ModelModel.api_name.in_(api_names))
    )
    existing = {m.api_name: m for m in result.scalars().all()}

    added = updated = 0
    touched: list[ModelModel] = []
    for item in items:
        model = existing.get(item["api_name"])
        if model is None:
            model = ModelModel(source_id=source_id, **item)
            db.add(model)
            added += 1
        else:
            # OpenRouter 是模型信息的唯一来源, 直接覆盖
            for field, value in item.items():
                setattr(model, field, value)
            model.source_id = source_id
            model.is_active = True
            # 显式写采集时间: 字段值没变时 SQLAlchemy 不发 UPDATE,
            # 只靠 onupdate 的话 fetched_at 会一直停在首次入库时间
            model.fetched_at = func.now()
            updated += 1
        touched.append(model)

    # 快照要用模型 id, 新插入的必须先 flush 拿到
    await db.flush()
    await _snapshot_prices(db, touched)

    stale = (
        await db.execute(
            select(ModelModel).where(
                ModelModel.source_id == source_id,
                ModelModel.is_active.is_(True),
                ModelModel.api_name.not_in(api_names),
            )
        )
    ).scalars().all()
    for model in stale:
        model.is_active = False

    await db.flush()
    return added, updated, len(stale)


async def get_model_list(db: AsyncSession, q: str | None = None) -> list[ModelModel]:
    """
    查询在售模型, 按公司、api_name 排序 (下架的历史模型不返回);
    q 不为 None 时按厂商/模型名模糊匹配
    """
    query = select(ModelModel).where(ModelModel.is_active.is_(True))
    if q:
        keyword = f"%{q.strip()}%"
        query = query.where(
            or_(
                ModelModel.api_name.ilike(keyword),
                ModelModel.company.ilike(keyword),
                ModelModel.version.ilike(keyword),
            )
        )
    result = await db.execute(query.order_by(ModelModel.company, ModelModel.api_name))
    return list(result.scalars().all())


async def get_model(db: AsyncSession, model_id: int) -> ModelModel | None:
    """按 id 查询单个模型"""
    return await db.scalar(select(ModelModel).where(ModelModel.id == model_id))


async def get_price_history(
    db: AsyncSession, model_id: int
) -> list[PriceHistoryModel]:
    """某模型的价格快照, 按日期升序 (直接喂给时间轴)"""
    result = await db.execute(
        select(PriceHistoryModel)
        .where(PriceHistoryModel.model_id == model_id)
        .order_by(PriceHistoryModel.captured_on)
    )
    return list(result.scalars().all())
