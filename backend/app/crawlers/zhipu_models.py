"""智谱 GLM 官网「模型总览 & 价格」页抓取与解析

模型总览 `https://docs.bigmodel.cn/cn/guide/start/model-overview`
    页面按 h2 分组: 「推荐模型」是当前主推的 9 款核心模型, 其余分组
    (文本模型/视觉理解模型/图像生成模型/视频生成模型/音视频模型/向量模型与其他)
    是仍在官网的历史型号。产品只要主推的那批, 所以只取「推荐模型」这一组。
    (智谱会把历史模型一直挂在官网上, 这是和 MiMo 不一样的地方)

价格 `https://docs.bigmodel.cn/cn/guide/start/pricing`
    表头: 模型名称 / 上下文 / 输入单价（元/百万 Tokens）/ 输出单价 / 缓存存储 / 缓存命中
    注意部分模型是**分段计价**, 一个模型占多行 (如 GLM-5.1 分 [0,32K) 与 ≥32K),
    这里取首档 (通常是最便宜那档), 并把分段情况写进备注。

注意 robots: open.bigmodel.cn 的 robots.txt 禁止 /dev/, 但 docs.bigmodel.cn 允许
(只禁 /_next/ 和 /cdn-cgi/), 所以文档站可以抓。
"""

import re
from urllib.parse import urljoin

import lxml.etree

from app.crawlers.base import CrawlerError, ModelsCrawlerBase
from app.models.source_model import SourceModel

MODELS_PATH = "/cn/guide/start/model-overview"
PRICING_PATH = "/cn/guide/start/pricing"

COMPANY = "zhipu"

# 当前主推模型所在的分组标题
FLAGSHIP_SECTION = "推荐模型"

# 整格就是 "1M" / "128K" / "8K" 才算长度; 像「输入：单图 ≤ 10 MB」这种
# 说明性文本里也含 "10 M", 用全匹配挡住, 否则会把大小误当成 token 数
TOKEN_NUM = re.compile(r"^([0-9]+(?:\.[0-9]+)?)\s*([KMB])$", re.IGNORECASE)
TOKEN_MULTIPLIER = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
# 单元格里就是纯数字才算单价, "限时免费"/"不支持" 之类一律当没有
PLAIN_NUMBER = re.compile(r"^[0-9]+(?:\.[0-9]+)?$")
# 表头里定位列用的关键词
PRICE_HEADER = "输入单价"
CACHE_HIT_HEADER = "缓存命中"


def _clean(text: str) -> str:
    """合并空白并去掉零宽字符 (小标题里带了 \\u200b)"""
    return re.sub(r"\s+", " ", text.replace("\u200b", "")).strip()


def _tokens(text: str) -> int | None:
    """'1M' / '128K' / '8K' -> token 数; 拿不到就给 None"""
    matched = TOKEN_NUM.search(text)
    if matched is None:
        return None
    return int(float(matched.group(1)) * TOKEN_MULTIPLIER[matched.group(2).upper()])


def _price(text: str) -> float | None:
    """'8' / '0.8' -> 浮点价; '限时免费' / '不支持' -> None"""
    value = _clean(text)
    return float(value) if PLAIN_NUMBER.match(value) else None


def _sections(body: lxml.etree._Element):
    """按文档顺序产出 (最近的小节标题, 表格)"""
    heading = ""
    for node in body.iter():
        if node.tag in ("h2", "h3"):
            heading = _clean("".join(node.itertext()))
        elif node.tag == "table":
            yield heading, node


def _rows(table: lxml.etree._Element) -> list[list[str]]:
    return [
        [_clean("".join(cell.itertext())) for cell in tr.xpath("./th|./td")]
        for tr in table.xpath(".//tr")
    ]


def _cell(row: list[str], index: int | None) -> str:
    if index is None or index >= len(row):
        return ""
    return row[index]


def _column(header: list[str], keyword: str) -> int | None:
    for index, name in enumerate(header):
        if keyword in name:
            return index
    return None


def parse_models(et: lxml.etree._Element) -> list[dict]:
    """模型总览页「推荐模型」区块 -> 模型字典列表

    只认表头含「模型」的表, 并且只取「推荐模型」这一组; 历史型号不进来。
    """
    models: list[dict] = []

    for section, table in _sections(et):
        if section != FLAGSHIP_SECTION:
            continue
        rows = _rows(table)
        if not rows:
            continue
        header = rows[0]
        name_column = _column(header, "模型")
        feature_column = _column(header, "特点")
        context_column = _column(header, "上下文")
        output_column = _column(header, "最大输出")
        if name_column is None:
            continue

        for row in rows[1:]:
            api_name = _cell(row, name_column)
            if not api_name:
                continue
            features = _cell(row, feature_column)
            models.append(
                {
                    "api_name": api_name,
                    "company": COMPANY,
                    "context_tokens": _tokens(_cell(row, context_column)),
                    "max_output_tokens": _tokens(_cell(row, output_column)),
                    "description": features or None,
                    # 只取「推荐模型」一组, 分类字段没有区分度, 留空
                    "category": None,
                }
            )

    return models


def parse_pricing(et: lxml.etree._Element) -> dict[str, dict]:
    """定价页 -> {模型名: {价格字段, 分段说明}}

    分段计价时一个模型有多行, 取首档; 并把档位信息记进备注。
    """
    result: dict[str, dict] = {}

    for _section, table in _sections(et):
        rows = _rows(table)
        if not rows:
            continue
        header = rows[0]
        name_column = _column(header, "模型名称")
        if name_column is None:
            continue
        input_column = _column(header, PRICE_HEADER)
        output_column = _column(header, "输出单价")
        hit_column = _column(header, CACHE_HIT_HEADER)
        if input_column is None and output_column is None:
            continue

        for row in rows[1:]:
            api_name = _cell(row, name_column)
            if not api_name:
                continue
            entry = result.setdefault(api_name, {"tiers": 0})
            entry["tiers"] += 1
            # 首档为准, 后面的档位只计数
            if entry["tiers"] > 1:
                continue
            entry["price_input_miss_idle"] = _price(_cell(row, input_column))
            entry["price_output_idle"] = _price(_cell(row, output_column))
            entry["price_input_hit_idle"] = _price(_cell(row, hit_column))

    return result


class ZhipuModelsCrawler(ModelsCrawlerBase):
    """智谱 GLM 官网模型总览与价格页"""

    async def fetch_models(self, source: SourceModel) -> list[dict]:
        """抓模型总览页与定价页, 合并成对齐 ModelModel 字段的字典列表"""
        models = await self._fetch_model_list(source)
        pricing = await self._fetch_pricing(source)

        for model in models:
            entry = pricing.get(model["api_name"])
            if not entry:
                continue
            for field in (
                "price_input_hit_idle",
                "price_input_miss_idle",
                "price_output_idle",
            ):
                if entry.get(field) is not None:
                    model[field] = entry[field]
            # 分段计价的模型, 价格只取了首档, 说明写进备注免得看起来像唯一价
            if entry.get("tiers", 1) > 1:
                note = f"分段计价（{entry['tiers']} 档），此处取首档"
                model["description"] = " | ".join(
                    part for part in (model.get("description"), note) if part
                )
        return models

    async def _fetch_model_list(self, source: SourceModel) -> list[dict]:
        resp = await self._get(urljoin(source.url, MODELS_PATH), source)
        models = parse_models(lxml.etree.HTML(resp.text))
        if not models:
            raise CrawlerError(
                "模型总览页未解析到「推荐模型」",
                source_name=source.name,
                url=str(resp.url),
            )
        return models

    async def _fetch_pricing(self, source: SourceModel) -> dict[str, dict]:
        resp = await self._get(urljoin(source.url, PRICING_PATH), source)
        return parse_pricing(lxml.etree.HTML(resp.text))
