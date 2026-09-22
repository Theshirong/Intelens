"""小米 MiMo 官网「模型清单 & 价格」页抓取与解析

模型清单 `/docs/zh-CN/quick-start/summary/model`
    按 h2 分「文本生成模型」「语音识别模型（ASR）」「语音合成模型（TTS）」三组,
    每行一个模型: 模型 ID / 能力支持 / 长度限制 / 限流。

价格 `/docs/zh-CN/price/pay-as-you-go`
    「模型国内定价」下按 token 计费的表: 输入（命中缓存）/ 输入（未命中缓存）/ 输出,
    单位「元 / 百万 tokens」, 与 models 表价格字段语义一致;
    ASR 按音频时长计费, 不是 token 单价, 写入 price_note 而不混进 token 单价字段。
    海外定价是美元, 不取。

注意: 不带语言前缀的 `/docs/price/...` 返回的是 SPA 外壳（12KB, 无正文）,
必须带 `/docs/zh-CN/` 前缀才能拿到服务端渲染的页面。
"""

import re
from urllib.parse import urljoin

import lxml.etree

from app.crawlers.base import CrawlerError, ModelsCrawlerBase
from app.models.source_model import SourceModel

MODELS_PATH = "/docs/zh-CN/quick-start/summary/model"
PRICING_PATH = "/docs/zh-CN/price/pay-as-you-go"

# 平台统一入口, 见 /docs/zh-CN/quick-start/summary/first-api-call; 所有模型共用
BASE_URL_OPENAI = "https://api.xiaomimimo.com/v1"
BASE_URL_ANTHROPIC = "https://api.xiaomimimo.com/anthropic"

COMPANY = "mimo"

# 长度限制单元格形如 "上下文窗口：1M 最大输出：128K"
CONTEXT_WINDOW = re.compile(r"上下文窗口[:：]\s*([0-9.]+\s*[KMB]?)", re.IGNORECASE)
MAX_OUTPUT = re.compile(r"最大输出[:：]\s*([0-9.]+\s*[KMB]?)", re.IGNORECASE)
# "1M" / "128K" / "8k" -> token 数
TOKEN_NUM = re.compile(r"([0-9]+(?:\.[0-9]+)?)\s*([KMB])", re.IGNORECASE)
TOKEN_MULTIPLIER = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
# "¥0.025" / "$0.435"
PRICE = re.compile(r"[¥$]\s*([0-9]+(?:\.[0-9]+)?)")

# 能力支持里的关键词 -> models 表布尔字段; 表里没有该能力即为不支持
CAPABILITY_FIELDS = {
    "函数调用": "support_tool_calls",
    "结构化输出": "support_json_output",
}
# 能力里出现即写思考模式说明, 未标注的模型留空
THINKING_CAPABILITY = "深度思考"

# 国内定价表列名 -> 价格字段; 未命中的列（如 ASR 的「输入音频时长」）不按 token 计价
PRICE_COLUMNS = {
    "输入（命中缓存）": "price_input_hit_idle",
    "输入（未命中缓存）": "price_input_miss_idle",
    "输出": "price_output_idle",
}
# 只取国内定价, 海外是美元价, 与价格字段的「元/百万 tokens」语义不一致
DOMESTIC_SECTION = "模型国内定价"

# 单元格里同一格的多项（能力、限流）之间的连接符
BLOCK_SEPARATOR = " / "


def _clean(text: str) -> str:
    """合并空白"""
    return re.sub(r"\s+", " ", text).strip()


def _tokens(text: str) -> int | None:
    """'1M' / '128K' -> token 数"""
    matched = TOKEN_NUM.search(text)
    if matched is None:
        return None
    return int(float(matched.group(1)) * TOKEN_MULTIPLIER[matched.group(2).upper()])


def _price(text: str) -> float | None:
    """'¥0.025' -> 0.025"""
    matched = PRICE.search(text)
    return float(matched.group(1)) if matched else None


def _content(et: lxml.etree._Element) -> lxml.etree._Element:
    """正文容器, 站点所有文档页共用 mdxContent"""
    found = et.xpath(
        "//div[contains(concat(' ', normalize-space(@class), ' '), ' mdxContent ')]"
    )
    if not found:
        raise CrawlerError("未找到正文容器 mdxContent")
    return found[0]


def _sections(body: lxml.etree._Element):
    """按文档顺序产出 (最近的小节标题, 表格), 用于把表归到它所属的 h2 下"""
    heading = ""
    for node in body.iter():
        if node.tag in ("h2", "h3"):
            heading = _clean("".join(node.itertext()))
        elif node.tag == "table":
            yield heading, node


def _cell_text(cell: lxml.etree._Element) -> str:
    """单元格文本

    能力/限流这类单元格把每一项放在独立的 li/span 里, 直接拼接会连成一片
    （"文本生成深度思考…"）, 所以多块结构用 BLOCK_SEPARATOR 连接;
    单块结构按原样取文本, 避免给内联标记之间塞进多余空格。
    """
    items = cell.xpath(".//li")
    if items:
        blocks = (_clean("".join(item.itertext())) for item in items)
        return BLOCK_SEPARATOR.join(block for block in blocks if block)
    spans = cell.xpath("./span")
    if len(spans) > 1:
        blocks = (_clean("".join(span.itertext())) for span in spans)
        return BLOCK_SEPARATOR.join(block for block in blocks if block)
    return _clean("".join(cell.itertext()))


def _rows(table: lxml.etree._Element) -> list[list[str]]:
    """表格 -> 二维文本矩阵 (合并单元格不做展开, 这些表都是规整矩形)"""
    return [
        [_cell_text(cell) for cell in tr.xpath("./th|./td")]
        for tr in table.xpath(".//tr")
    ]


def _column(header: list[str], keyword: str) -> int | None:
    """按表头关键词定位列下标"""
    for index, name in enumerate(header):
        if keyword in name:
            return index
    return None


def _cell(row: list[str], index: int | None) -> str:
    """TTS 部分行缺列, 越界一律当空串"""
    if index is None or index >= len(row):
        return ""
    return row[index]


def _describe(limit: str) -> str | None:
    """把没有独立字段的信息 (限流) 归到备注"""
    return f"限流：{limit}" if limit else None


def parse_model_tables(et: lxml.etree._Element) -> list[dict]:
    """解析模型清单页, 产出对齐 ModelModel 字段的模型字典列表

    只认表头含「Model ID」的表, 「快速选型指南」那类表会被跳过。
    """
    models: list[dict] = []
    seen: set[str] = set()

    for section, table in _sections(_content(et)):
        rows = _rows(table)
        if not rows:
            continue
        header = rows[0]
        id_column = _column(header, "Model ID")
        if id_column is None:
            continue
        capabilities_column = _column(header, "能力")
        length_column = _column(header, "长度")
        limit_column = _column(header, "限流")

        for row in rows[1:]:
            api_name = _cell(row, id_column)
            if not api_name or api_name in seen:
                continue
            seen.add(api_name)

            capabilities = _cell(row, capabilities_column)
            length = _cell(row, length_column)
            window = CONTEXT_WINDOW.search(length)
            output = MAX_OUTPUT.search(length)

            model: dict = {
                "api_name": api_name,
                "company": COMPANY,
                "base_url_openai": BASE_URL_OPENAI,
                "base_url_anthropic": BASE_URL_ANTHROPIC,
                "context_tokens": _tokens(window.group(1)) if window else None,
                "max_output_tokens": _tokens(output.group(1)) if output else None,
                "thinking_mode": (
                    THINKING_CAPABILITY if THINKING_CAPABILITY in capabilities else None
                ),
                # 能力原文单独成列, 前端直接当标签用, 不再从备注里解析
                "capabilities": capabilities or None,
                # 分组的 h2 就是官网自己的模型分类, 前端按它分组展示
                "category": section or None,
                "description": _describe(_cell(row, limit_column)),
            }
            for keyword, field in CAPABILITY_FIELDS.items():
                # 有明确能力清单时, 没列出的能力即不支持; 整格为空才算未标注
                model[field] = (keyword in capabilities) if capabilities else None
            models.append(model)

    return models


def parse_pricing(et: lxml.etree._Element) -> tuple[dict[str, dict], dict[str, str]]:
    """解析「模型国内定价」

    return: (按 token 计费的价格字段 {api_name: {字段: 价格}},
             其余计费说明 {api_name: 原文})
    """
    prices: dict[str, dict] = {}
    notes: dict[str, str] = {}

    for section, table in _sections(_content(et)):
        if section != DOMESTIC_SECTION:
            continue
        rows = _rows(table)
        if len(rows) < 2:
            continue

        # 表头第一格是分组名（如「MiMo-V2.5 系列」）, 之后才是计费项
        units = rows[0][1:]
        fields = [PRICE_COLUMNS.get(unit) for unit in units]

        for row in rows[1:]:
            api_name = row[0] if row else ""
            if not api_name:
                continue
            if not any(fields):
                # 非 token 计费（如 ASR 按音频时长）, 单独成字段交给前端展示
                detail = _cell(row, 1)
                if detail:
                    notes[api_name] = detail
                continue

            found: dict = {}
            for offset, field in enumerate(fields):
                if field is None:
                    continue
                value = _price(_cell(row, offset + 1))
                if value is not None:
                    found[field] = value
            if found:
                prices[api_name] = found

    return prices, notes


class MimoModelsCrawler(ModelsCrawlerBase):
    """小米 MiMo 官网模型清单与价格页, 产出结构化模型信息"""

    async def fetch_models(self, source: SourceModel) -> list[dict]:
        """抓取模型清单页与定价页, 合并成对齐 ModelModel 字段的字典列表"""
        models = await self._fetch_model_list(source)
        prices, notes = await self._fetch_pricing(source)

        for model in models:
            api_name = model["api_name"]
            model.update(prices.get(api_name, {}))
            # 非 token 计费 (如 ASR 按音频时长) 单独存字段, 不与 token 单价字段混用
            note = notes.get(api_name)
            if note:
                model["price_note"] = note
        return models

    async def _fetch_model_list(self, source: SourceModel) -> list[dict]:
        resp = await self._get(urljoin(source.url, MODELS_PATH), source)
        models = parse_model_tables(lxml.etree.HTML(resp.text))
        if not models:
            raise CrawlerError(
                "模型清单页未解析到模型", source_name=source.name, url=str(resp.url)
            )
        return models

    async def _fetch_pricing(
        self, source: SourceModel
    ) -> tuple[dict[str, dict], dict[str, str]]:
        resp = await self._get(urljoin(source.url, PRICING_PATH), source)
        return parse_pricing(lxml.etree.HTML(resp.text))
