from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_model import ModelModel
from app.models.popularity_model import ModelPopularityModel

# 榜单来源; 目前只有 OpenRouter 的周榜
POPULARITY_SOURCE = "openrouter"


async def save_popularity(
    db: AsyncSession,
    items: list[dict],
    source: str = POPULARITY_SOURCE,
    captured_on: date | None = None,
) -> int:
    """把周榜名次写进 model_popularity, 按 (模型, 来源, 采集日) 幂等

    名次是「当天快照」: 同一天重复采集只更新那一行 (与 price_history 同理,
    开发期频繁重启不会往同一天塞出多行)。新的采集日自然新增一行, 位次涨落
    就是在这些行之间比出来的。

    榜单里的型号名要先落到 models.api_name, 对不上的一律丢弃 —— 只给我们收录
    的型号留位次, 榜上另外几百个不关心的型号不写。
    """
    if not items:
        return 0

    day = captured_on or date.today()
    result = await db.execute(
        select(ModelModel).where(ModelModel.is_active.is_(True))
    )
    models = {model.api_name: model.id for model in result.scalars().all()}

    # 一次把当天已存在的行捞出来按模型索引: 一条条 SELECT 要几百次往返
    existing = await db.execute(
        select(ModelPopularityModel).where(
            ModelPopularityModel.source == source,
            ModelPopularityModel.captured_on == day,
        )
    )
    rows = {row.model_id: row for row in existing.scalars().all()}

    saved = 0
    for item in items:
        model_id = models.get(item["api_name"])
        if model_id is None:
            continue
        row = rows.get(model_id)
        if row is None:
            db.add(
                ModelPopularityModel(
                    model_id=model_id,
                    source=source,
                    rank=item["rank"],
                    captured_on=day,
                )
            )
        else:
            row.rank = item["rank"]
        saved += 1

    await db.flush()
    return saved


async def get_popularity_history(
    db: AsyncSession, days: int = 30, source: str = POPULARITY_SOURCE
) -> list[ModelPopularityModel]:
    """近 days 个自然日的全部名次快照, 按日期、位次升序 (直接喂给时间轴)

    时间是「按天推进」的, 所以这里返回窗口内所有日期而不是只返回最新一期 ——
    位次趋势要靠多天拼出来。
    """
    since = date.today() - timedelta(days=days - 1)
    result = await db.execute(
        select(ModelPopularityModel)
        .where(
            ModelPopularityModel.source == source,
            ModelPopularityModel.captured_on >= since,
        )
        .order_by(ModelPopularityModel.captured_on, ModelPopularityModel.rank)
    )
    return list(result.scalars().all())
