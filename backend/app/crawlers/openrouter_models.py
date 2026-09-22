"""OpenRouter -> 各厂热门模型信息 (模型信息的唯一来源)

模型信息统一取自 OpenRouter 的公开接口: 各厂官网「模型 & 价格」页的采集已
作废 (新闻采集不受影响)。入库字段就是 OpenRouter 模型对象的字段, 嵌套结构
(architecture / pricing / top_provider / benchmarks 等) 原样存 JSON, 不做
派生: 目录条目给规格与基准测试, 自营端点给该厂商的定价口径。

``pricing`` 里的 ``overrides`` 有两种条目, 含义不同: 带 ``utc_start`` /
``utc_end`` / ``utc_days`` 的是时段价 (峰谷), 带 ``min_prompt_tokens`` 的是长
上下文档位价。界面要的「空闲/高峰价」与中文说明不落库, 由
app/core/pricing.py 在响应时算出, 只有 price_history 快照用它派生。

数据源 (公开接口, 无需鉴权, 也不依赖 sources 表):

- ``GET /api/v1/models?sort=top-weekly`` 按近一周 token 量排序的模型榜
- ``GET /api/v1/models``                  全量目录, 给规格/架构/基准测试
- ``GET /api/v1/models/{id}/endpoints``   各渠道端点, 逐个模型查 (定价取自营端点)

四层筛选:

1. **热度** —— 按周榜从高到低取, 攒够 `HOT_LIMIT` 条就停。榜单按上榜厂商
   的实际调用量排, 所以「收哪些」不需要人工维护;
2. **厂商** —— 只取 `VENDORS` 白名单里的 10 家热门厂商 (口径见该常量注释);
3. **渠道** —— 只取厂商自营渠道: 端点 tag 的第一段命中该厂商的自营 tag 集合。
   第三方托管 (Together / Novita / 硅基流动等) 的价格一概不取 —— 它们不是
   厂商官方口径, 同一模型不同托管的价差可以到几倍。
4. **配额** —— 单家厂商最多收 `PER_VENDOR_LIMIT` 条, 否则热度榜会被大厂
   刷屏 (见该常量注释)。

多数厂商的自营 tag 就是作者段本身, 但有两家不是, 必须单独列出来:

    deepseek/...  -> tag "deepseek"
    google/...    -> tag "google-ai-studio" / "google-vertex"
    qwen/...      -> tag "alibaba"  (通义由阿里云自营)

有的厂商在 OpenRouter 上拿不到官方口径的报价, 因此不在白名单里: NVIDIA 的
自营 tag 只挂在 ``:free`` 免费变体上 (免费档对价格情报没有意义), 付费型号的
端点全是 baseten / deepinfra 这类第三方托管。
"""

import asyncio
from dataclasses import dataclass
from datetime import UTC, date, datetime

from loguru import logger

from app.crawlers.base import CrawlerError, ModelsCrawlerBase
from app.models.source_model import SourceModel

CATALOG_URL = "https://openrouter.ai/api/v1/models"
RANKING_URL = "https://openrouter.ai/api/v1/models?sort=top-weekly&limit={limit}"
ENDPOINTS_URL = "https://openrouter.ai/api/v1/models/{model_id}/endpoints"

# 入库的模型条数上限, 按周热度从高到低取; 嫌少/嫌多改这里
HOT_LIMIT = 50

# 单家厂商的收录条数上限
#
# 不设上限时热度榜会被大厂刷屏: 实测 google 12 条 / openai 11 条 /
# anthropic 9 条, 而 deepseek、kimi、小米、腾讯每家只剩 2 条 —— 榜单前 50
# 里大厂占掉三十二个席位, 小厂型号全被挤到榜外。上限压到 5 条后各家席位
# 基本拉平, 但总数会掉到 39 条上下 (够格的候选就这么多, 不强行凑满 50)。
PER_VENDOR_LIMIT = 5

# 周榜往下翻多少个候选。白名单厂商的模型里约五分之一没有自营渠道会被跳过,
# 所以候选要留出余量; 翻得越深越能凑满 HOT_LIMIT, 但请求也越多。
HOT_POOL = 200

# 端点请求的并发上限, 以及每批处理多少个候选 (按批推进才能攒够就停)
CONCURRENCY = 6
BATCH = 20


@dataclass(frozen=True)
class Vendor:
    """一家厂商的采集配置"""

    # 写进 models 表的 company
    company: str
    # 该厂商自营渠道的端点 tag 首段
    official_tags: tuple[str, ...]


# 热门厂商白名单: OpenRouter 作者段 -> 采集配置
#
# 厂商选取口径 (2026-09-20 快照): 取 /api/v1/models?sort=top-weekly 前 200 名,
# 按「热度质量」= Σ(1/名次) 排序, 兼顾上榜数量与名次高低, 前三名依次是
# deepseek / z-ai / openai。在此基础上补足到 10 家, 剔除没有自营渠道的 NVIDIA。
#
# 这一层是必要的上限: OpenRouter 目录里有四百多个模型, 不限定厂商会收录一堆
# 只在小圈子流行的小厂型号。
VENDORS: dict[str, Vendor] = {
    "deepseek": Vendor("deepseek", ("deepseek",)),
    "z-ai": Vendor("zhipu", ("z-ai",)),
    "xiaomi": Vendor("mimo", ("xiaomi",)),
    "moonshotai": Vendor("kimi", ("moonshotai",)),
    "openai": Vendor("openai", ("openai",)),
    "tencent": Vendor("tencent", ("tencent",)),
    "google": Vendor("google", ("google-ai-studio", "google-vertex")),
    "qwen": Vendor("qwen", ("alibaba",)),
    "anthropic": Vendor("anthropic", ("anthropic",)),
    "meta": Vendor("meta", ("meta",)),
}

def _pick_official_endpoint(
    endpoints: list[dict], official_tags: tuple[str, ...]
) -> dict | None:
    """挑出厂商自营渠道的端点, 没有则返回 None"""
    for endpoint in endpoints:
        if (endpoint.get("tag") or "").split("/")[0] in official_tags:
            return endpoint
    return None


def _company_of(model_id: str) -> str:
    """模型 id 的作者段 -> 厂商名 (白名单外的作者段调用方已过滤)"""
    return VENDORS[model_id.partition("/")[0]].company


def _to_model_fields(model: dict, endpoint: dict, company: str) -> dict:
    """OpenRouter 目录 + 自营端点 -> 对齐 ModelModel 字段的字典

    目录条目给模型对象 (规格、架构、基准测试), 定价优先取自营端点 —— 端点价才是
    该厂商自己的报价口径, 拿不到时退回目录价。字段原样透传, 不做派生; 值为 None
    的字段也一并返回, 免得上游删字段后库里留着上一轮的旧值。
    """
    return {
        "api_name": model["id"].split("/", 1)[1],
        "company": company,
        "canonical_slug": model.get("canonical_slug"),
        "name": model.get("name"),
        "created": _created_at(model.get("created")),
        "context_length": model.get("context_length"),
        "architecture": model.get("architecture"),
        "pricing": endpoint.get("pricing") or model.get("pricing"),
        "top_provider": model.get("top_provider"),
        "per_request_limits": model.get("per_request_limits"),
        "supported_parameters": model.get("supported_parameters"),
        "default_parameters": model.get("default_parameters"),
        "supported_voices": model.get("supported_voices"),
        "knowledge_cutoff": _date(model.get("knowledge_cutoff")),
        "expiration_date": _date(model.get("expiration_date")),
        "benchmarks": model.get("benchmarks"),
    }


def _created_at(created: int | None) -> datetime | None:
    """OpenRouter 的 unix 秒 -> UTC 时间"""
    if created is None:
        return None
    return datetime.fromtimestamp(int(created), tz=UTC)


def _date(value: str | None) -> date | None:
    """"2026-02-16" -> date; 上游给非标准写法时留空, 不猜"""
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


class OpenRouterModelsCrawler(ModelsCrawlerBase):
    """OpenRouter 热度榜, 产出白名单厂商热门型号的信息"""

    async def fetch_models(
        self, source: SourceModel | None = None, limit: int = HOT_LIMIT
    ) -> list[dict]:
        """按热度取模型信息, 返回对齐 ModelModel 字段的字典列表

        source 不参与请求 (OpenRouter 不是厂商官网), 保留参数是为了与
        ModelsCrawlerBase 的契约一致, 也让 _get 的报错带上源名。
        """
        catalog = await self._fetch_catalog()
        candidates = await self._fetch_ranking(catalog)
        if not candidates:
            raise CrawlerError("热度榜里没有白名单厂商的模型", url=RANKING_URL)

        sem = asyncio.Semaphore(CONCURRENCY)
        items: list[dict] = []
        taken: dict[str, int] = {}
        exhausted = True
        # 按热度从高到低分批查端点, 攒够 limit 就停 —— 榜单剩下的没必要跑
        for start in range(0, len(candidates), BATCH):
            # 已经收满配额的厂商不必再查端点, 省掉一批请求
            batch = [
                model
                for model in candidates[start : start + BATCH]
                if taken.get(_company_of(model["id"]), 0) < PER_VENDOR_LIMIT
            ]
            results = await asyncio.gather(
                *(self._fetch_one(sem, model, source) for model in batch)
            )
            for item in results:
                if item is None:
                    continue
                company = item["company"]
                if taken.get(company, 0) >= PER_VENDOR_LIMIT:
                    continue
                taken[company] = taken.get(company, 0) + 1
                items.append(item)
            if len(items) >= limit:
                exhausted = False
                break

        if exhausted and len(items) < limit:
            # 配额卡住导致的缺口是设计使然, 只有查遍候选池还凑不齐才算异常
            capped = any(count >= PER_VENDOR_LIMIT for count in taken.values())
            log = logger.info if capped else logger.warning
            log(
                f"OpenRouter 凑到 {len(items)} 个有自营渠道的模型 "
                f"(目标 {limit}, 候选 {len(candidates)} 个, 每家上限 "
                f"{PER_VENDOR_LIMIT} 条)"
                + (", 缺口由厂商配额造成" if capped else ", 可调大 HOT_POOL")
            )
        logger.info(
            "OpenRouter 收录分布: "
            + ", ".join(
                f"{company} {count}"
                for company, count in sorted(taken.items(), key=lambda kv: -kv[1])
            )
        )
        return items[:limit]

    async def _fetch_catalog(self) -> dict[str, dict]:
        """拉全量目录, 返回 {模型 id: 模型} 映射"""
        resp = await self._get(CATALOG_URL)
        try:
            catalog = resp.json()["data"]
        except (KeyError, ValueError) as e:
            raise CrawlerError(
                f"目录响应结构异常: {type(e).__name__}", url=CATALOG_URL
            ) from e
        return {model["id"]: model for model in catalog if model.get("id")}

    async def _fetch_ranking(self, catalog: dict[str, dict]) -> list[dict]:
        """取周热度榜, 按榜单顺序过滤出白名单厂商的正式型号

        变体后缀 (:free / :batch) 不是独立型号, 由基础型号那一行代表, 跳过。
        """
        url = RANKING_URL.format(limit=HOT_POOL)
        resp = await self._get(url)
        try:
            ranking = resp.json()["data"]
        except (KeyError, ValueError) as e:
            raise CrawlerError(
                f"热度榜响应结构异常: {type(e).__name__}", url=url
            ) from e

        candidates = []
        for model in ranking:
            model_id = model.get("id") or ""
            author, separator, slug = model_id.partition("/")
            if not (separator and slug and ":" not in model_id):
                continue
            if author not in VENDORS or model_id not in catalog:
                continue
            # 用目录里的条目, 榜单条目的字段没有目录全 (缺架构/定价等)
            candidates.append(catalog[model_id])
        return candidates

    async def _fetch_one(
        self, sem: asyncio.Semaphore, model: dict, source: SourceModel | None
    ) -> dict | None:
        """查单个模型的端点, 没有自营渠道就跳过 (不取第三方价)"""
        model_id = model["id"]
        author, _, _ = model_id.partition("/")
        vendor = VENDORS[author]

        try:
            async with sem:
                resp = await self._get(ENDPOINTS_URL.format(model_id=model_id), source)
            endpoints = resp.json()["data"]["endpoints"]
        except CrawlerError as e:
            logger.warning(f"OpenRouter 端点查询失败, 跳过 {model_id}: {e}")
            return None
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"OpenRouter 端点响应结构异常, 跳过 {model_id}: {e}")
            return None

        endpoint = _pick_official_endpoint(endpoints, vendor.official_tags)
        if endpoint is None:
            logger.debug(f"OpenRouter 上 {model_id} 没有自营渠道, 跳过")
            return None
        return _to_model_fields(model, endpoint, vendor.company)

    async def fetch_popularity(self, limit: int = HOT_POOL) -> list[dict]:
        """周榜名次快照, 返回 ``[{api_name, rank}]``, 供 model_popularity 入库

        与 _fetch_ranking 的区别是不做厂商白名单过滤: 名次要的是全局位次,
        按白名单滤一遍位数就串了 (中间那几名会消失)。所以这里对整张榜计数,
        匹配不到 models 表的条目由入库侧丢弃。

        变体后缀 (:free / :batch) 仍然跳过 —— 它们是同一型号的不同计费档,
        基础和变体都记会让一个型号在同一期占两个位次; 跳过时保留原始位次不重排,
        所以名次会出现空档 (真实位次本来就有空档)。

        用的 URL 与 _fetch_ranking 是同一个, 一轮采集因此请求两次 (一次按白名单
        挑型号, 一次取全局位次)。一天一轮, 这点重复不值得把两个方法的返回值并成
        一个元组 —— 那样调用方反而更难读。
        """
        url = RANKING_URL.format(limit=limit)
        resp = await self._get(url)
        try:
            ranking = resp.json()["data"]
        except (KeyError, ValueError) as e:
            raise CrawlerError(
                f"热度榜响应结构异常: {type(e).__name__}", url=url
            ) from e

        items: list[dict] = []
        for position, model in enumerate(ranking, start=1):
            model_id = model.get("id") or ""
            _, separator, slug = model_id.partition("/")
            if not (separator and slug and ":" not in model_id):
                continue
            items.append({"api_name": slug, "rank": position})
        logger.info(f"OpenRouter 热度榜: 取到 {len(items)} 个型号的位次")
        return items
